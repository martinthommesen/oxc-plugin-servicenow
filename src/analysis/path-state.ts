import type { ESTree } from "@oxlint/plugins";
import { getName, isNode, WALK_SKIP_KEYS } from "../utils/ast.js";
import { staticPropertyName } from "./members.js";
import type { ProvenanceKind, ProvenanceQuery } from "./provenance.js";

export interface SharedRecord<T> {
  id: number;
  escaped: boolean;
  invalid: boolean;
  data: T;
}

export interface PathCallInput<T> {
  call: ESTree.CallExpression;
  rec: SharedRecord<T> | undefined;
  objectName: string | null;
  property: string | null;
  records: Map<string, SharedRecord<T>>;
}

export interface PathAnalysisOptions<T> {
  program: ESTree.Node;
  analysis: ProvenanceQuery;
  kinds: readonly ProvenanceKind[];
  emptyData: () => T;
  cloneData: (data: T) => T;
  mergeData: (left: T, right: T) => T;
  onCall: (input: PathCallInput<T>) => void;
}

export function snapshotShared<T>(
  map: Map<string, SharedRecord<T>>,
  cloneData: (data: T) => T,
): Map<string, SharedRecord<T>> {
  const seen = new Map<SharedRecord<T>, SharedRecord<T>>();
  const out = new Map<string, SharedRecord<T>>();
  for (const [name, rec] of map) {
    let copy = seen.get(rec);
    if (!copy) {
      copy = { id: rec.id, escaped: rec.escaped, invalid: rec.invalid, data: cloneData(rec.data) };
      seen.set(rec, copy);
    }
    out.set(name, copy);
  }
  return out;
}

export function mergeTri(left: boolean | "unknown", right: boolean | "unknown"): boolean | "unknown" {
  if (left === right) return left;
  return "unknown";
}

export function visitChildren(
  node: ESTree.Node,
  visit: (child: unknown, traverseRoot: boolean) => void,
): void {
  for (const key of Object.keys(node)) {
    if (WALK_SKIP_KEYS.has(key)) continue;
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const child of value) visit(child, false);
    } else {
      visit(value, false);
    }
  }
}

export function isFunctionLikeNode(node: ESTree.Node): boolean {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

export function bindIfProven<T>(
  records: Map<string, SharedRecord<T>>,
  name: string,
  init: unknown,
  analysis: ProvenanceQuery,
  kinds: readonly ProvenanceKind[],
  emptyData: () => T,
  nextId: () => number,
): void {
  const proven = analysis.ofExpression(init);
  if (!proven || proven.invalid || !kinds.includes(proven.kind)) {
    if (records.has(name)) records.get(name)!.invalid = true;
    return;
  }
  const sourceName = getName(init);
  if (sourceName && records.has(sourceName)) {
    records.set(name, records.get(sourceName)!);
    return;
  }
  records.set(name, {
    id: nextId(),
    escaped: proven.escaped,
    invalid: false,
    data: emptyData(),
  });
}

export function markEscapeName<T>(records: Map<string, SharedRecord<T>>, node: unknown): void {
  if (!isNode(node) || node.type !== "Identifier") return;
  const name = getName(node);
  if (name && records.has(name)) records.get(name)!.escaped = true;
}

function replaceWithMerge<T>(
  target: Map<string, SharedRecord<T>>,
  left: Map<string, SharedRecord<T>>,
  right: Map<string, SharedRecord<T>>,
  emptyData: () => T,
  mergeData: (left: T, right: T) => T,
): void {
  target.clear();
  const names = new Set([...left.keys(), ...right.keys()]);
  for (const name of names) {
    const a = left.get(name);
    const b = right.get(name);
    const rec = a ?? b;
    if (!rec) continue;
    target.set(name, {
      id: rec.id,
      escaped: Boolean(a?.escaped || b?.escaped),
      invalid: Boolean(a?.invalid || b?.invalid),
      data: a && b ? mergeData(a.data, b.data) : mergeData(rec.data, emptyData()),
    });
  }
}

function mergeMany<T>(
  target: Map<string, SharedRecord<T>>,
  paths: Array<Map<string, SharedRecord<T>>>,
  emptyData: () => T,
  mergeData: (left: T, right: T) => T,
): void {
  if (paths.length === 0) return;
  const first = paths[0]!;
  target.clear();
  for (const [name, rec] of first) {
    target.set(name, {
      id: rec.id,
      escaped: rec.escaped,
      invalid: rec.invalid,
      data: rec.data,
    });
  }
  for (let i = 1; i < paths.length; i++) {
    const next = snapshotShared(target, (data) => data);
    replaceWithMerge(target, next, paths[i]!, emptyData, mergeData);
  }
}

/**
 * Path-sensitive binding tracker for proven Glide constructors.
 *
 * Nested functions are analyzed with a fresh map. Outer bindings escape.
 * Branch disagreement merges data conservatively through `mergeData`.
 */
export function analyzePathBindings<T>(options: PathAnalysisOptions<T>): void {
  const { program, analysis, kinds, emptyData, cloneData, mergeData, onCall } = options;
  let nextId = 1;
  const alloc = (): number => {
    nextId += 1;
    return nextId;
  };
  const seenFunctions = new Set<ESTree.Node>();

  const visit = (node: unknown, records: Map<string, SharedRecord<T>>, traverseRoot: boolean): void => {
    if (!isNode(node)) return;

    if (isFunctionLikeNode(node) && !traverseRoot) {
      if (seenFunctions.has(node)) return;
      seenFunctions.add(node);
      visit(node, new Map(), true);
      for (const rec of records.values()) rec.escaped = true;
      return;
    }

    switch (node.type) {
      case "VariableDeclarator": {
        const decl = node as ESTree.VariableDeclarator;
        const name = getName(decl.id);
        visitChildren(node, (child) => visit(child, records, false));
        if (name && decl.init) {
          bindIfProven(records, name, decl.init, analysis, kinds, emptyData, alloc);
        }
        return;
      }
      case "AssignmentExpression": {
        const assign = node as ESTree.AssignmentExpression;
        const name = getName(assign.left);
        visit(assign.right, records, false);
        if (name) {
          bindIfProven(records, name, assign.right, analysis, kinds, emptyData, alloc);
        } else {
          visit(assign.left, records, false);
        }
        return;
      }
      case "IfStatement": {
        const stmt = node as ESTree.IfStatement;
        visit(stmt.test, records, false);
        const before = snapshotShared(records, cloneData);
        const consequent = snapshotShared(before, cloneData);
        visit(stmt.consequent, consequent, false);
        const alternate = snapshotShared(before, cloneData);
        if (stmt.alternate) visit(stmt.alternate, alternate, false);
        replaceWithMerge(records, consequent, alternate, emptyData, mergeData);
        return;
      }
      case "ConditionalExpression": {
        const expr = node as ESTree.ConditionalExpression;
        visit(expr.test, records, false);
        const before = snapshotShared(records, cloneData);
        const consequent = snapshotShared(before, cloneData);
        visit(expr.consequent, consequent, false);
        const alternate = snapshotShared(before, cloneData);
        visit(expr.alternate, alternate, false);
        replaceWithMerge(records, consequent, alternate, emptyData, mergeData);
        return;
      }
      case "LogicalExpression": {
        const expr = node as ESTree.LogicalExpression;
        visit(expr.left, records, false);
        const afterLeft = snapshotShared(records, cloneData);
        visit(expr.right, records, false);
        const afterRight = snapshotShared(records, cloneData);
        replaceWithMerge(records, afterLeft, afterRight, emptyData, mergeData);
        return;
      }
      case "SwitchStatement": {
        const stmt = node as ESTree.SwitchStatement;
        visit(stmt.discriminant, records, false);
        const before = snapshotShared(records, cloneData);
        const paths: Array<Map<string, SharedRecord<T>>> = [];
        let hasDefault = false;
        for (const switchCase of stmt.cases) {
          if (!switchCase.test) hasDefault = true;
          const path = snapshotShared(before, cloneData);
          visit(switchCase, path, false);
          paths.push(path);
        }
        if (!hasDefault) paths.push(before);
        mergeMany(records, paths, emptyData, mergeData);
        return;
      }
      case "ForStatement": {
        const stmt = node as ESTree.ForStatement;
        if (stmt.init) visit(stmt.init, records, false);
        const before = snapshotShared(records, cloneData);
        if (stmt.test) visit(stmt.test, records, false);
        if (stmt.body) visit(stmt.body, records, false);
        if (stmt.update) visit(stmt.update, records, false);
        const after = snapshotShared(records, cloneData);
        replaceWithMerge(records, before, after, emptyData, mergeData);
        return;
      }
      case "WhileStatement":
      case "DoWhileStatement":
      case "ForInStatement":
      case "ForOfStatement": {
        const before = snapshotShared(records, cloneData);
        visitChildren(node, (child) => visit(child, records, false));
        const after = snapshotShared(records, cloneData);
        replaceWithMerge(records, before, after, emptyData, mergeData);
        return;
      }
      case "TryStatement": {
        const stmt = node as ESTree.TryStatement;
        const before = snapshotShared(records, cloneData);
        const tried = snapshotShared(before, cloneData);
        visit(stmt.block, tried, false);
        const caught = snapshotShared(before, cloneData);
        if (stmt.handler) visit(stmt.handler, caught, false);
        replaceWithMerge(records, tried, caught, emptyData, mergeData);
        if (stmt.finalizer) visit(stmt.finalizer, records, false);
        return;
      }
      case "CallExpression": {
        const call = node as ESTree.CallExpression;
        const property = staticPropertyName(call.callee);
        const objectName =
          isNode(call.callee) && call.callee.type === "MemberExpression"
            ? getName((call.callee as ESTree.MemberExpression).object)
            : null;
        const rec = objectName ? records.get(objectName) : undefined;
        onCall({
          call,
          rec: rec && !rec.invalid && !rec.escaped ? rec : undefined,
          objectName,
          property,
          records,
        });
        for (const arg of call.arguments) markEscapeName(records, arg);
        visitChildren(node, (child) => visit(child, records, false));
        return;
      }
      case "NewExpression": {
        for (const arg of (node as ESTree.NewExpression).arguments) markEscapeName(records, arg);
        visitChildren(node, (child) => visit(child, records, false));
        return;
      }
      case "ReturnStatement": {
        markEscapeName(records, (node as ESTree.ReturnStatement).argument);
        visitChildren(node, (child) => visit(child, records, false));
        return;
      }
      case "Property": {
        markEscapeName(records, (node as unknown as ESTree.ObjectProperty).value);
        visitChildren(node, (child) => visit(child, records, false));
        return;
      }
      case "ArrayExpression": {
        for (const element of (node as ESTree.ArrayExpression).elements) {
          markEscapeName(records, element);
        }
        visitChildren(node, (child) => visit(child, records, false));
        return;
      }
      default:
        visitChildren(node, (child) => visit(child, records, false));
    }
  };

  visit(program, new Map(), true);
}
