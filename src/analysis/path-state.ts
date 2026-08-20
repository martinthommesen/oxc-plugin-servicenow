import type { ESTree } from "@oxlint/plugins";
import { getName, isNode, isValueReference, unwrapExpression, WALK_SKIP_KEYS } from "../utils/ast.js";
import type { FileBindings, LexicalBinding, ScopeNode } from "./bindings.js";
import { isFunctionLike } from "./bindings.js";
import { staticPropertyName } from "./members.js";
import type { ProvenanceKind, ProvenanceQuery } from "./provenance.js";

export type BindingId = number;
export type ObjectId = number;
export type Completion = "normal" | "return" | "throw" | "break" | "continue";

export interface SharedRecord<T> {
  id: ObjectId;
  escaped: boolean;
  invalid: boolean;
  data: T;
}

export interface PathCallInput<T> {
  call: ESTree.CallExpression;
  rec: SharedRecord<T> | undefined;
  objectName: string | null;
  property: string | null;
}

export interface PathRefInput<T> {
  node: ESTree.Node;
  rec: SharedRecord<T> | undefined;
  name: string | null;
  bindingId: BindingId | null;
}

interface EnvState<T> {
  env: Map<BindingId, ObjectId | undefined>;
  objects: Map<ObjectId, SharedRecord<T>>;
  completion: Completion;
}

export interface PathAnalysisOptions<T> {
  program: ESTree.Node;
  analysis: ProvenanceQuery;
  kinds: readonly ProvenanceKind[];
  emptyData: () => T;
  cloneData: (data: T) => T;
  mergeData: (left: T, right: T) => T;
  onCall: (input: PathCallInput<T>) => void;
  onRef?: (input: PathRefInput<T>) => void;
  /** Allocate an object when an expression is a proven constructed value. */
  onValue?: (node: ESTree.Node) => T | undefined;
}

export function isFunctionLikeNode(node: ESTree.Node): boolean {
  return isFunctionLike(node);
}

export function mergeTri(left: boolean | "unknown", right: boolean | "unknown"): boolean | "unknown" {
  if (left === right) return left;
  return "unknown";
}

function resetLoopCompletion<T>(state: EnvState<T>): void {
  const completion: Completion = state.completion;
  if (completion === "break" || completion === "continue") {
    state.completion = "normal";
  }
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

function cloneRecord<T>(rec: SharedRecord<T>, cloneData: (data: T) => T): SharedRecord<T> {
  return {
    id: rec.id,
    escaped: rec.escaped,
    invalid: rec.invalid,
    data: cloneData(rec.data),
  };
}

function snapshotState<T>(state: EnvState<T>, cloneData: (data: T) => T): EnvState<T> {
  const objects = new Map<ObjectId, SharedRecord<T>>();
  for (const [id, rec] of state.objects) {
    objects.set(id, cloneRecord(rec, cloneData));
  }
  return {
    env: new Map(state.env),
    objects,
    completion: state.completion,
  };
}

function mergeRecords<T>(
  left: SharedRecord<T> | undefined,
  right: SharedRecord<T> | undefined,
  emptyData: () => T,
  mergeData: (left: T, right: T) => T,
): SharedRecord<T> | undefined {
  if (!left) return right ? { ...right, escaped: true, invalid: true, data: mergeData(right.data, emptyData()) } : undefined;
  if (!right) return { ...left, escaped: true, invalid: true, data: mergeData(left.data, emptyData()) };
  if (left.id !== right.id) return undefined;
  return {
    id: left.id,
    escaped: left.escaped || right.escaped,
    invalid: left.invalid || right.invalid,
    data: mergeData(left.data, right.data),
  };
}

/**
 * Join reachable states. Must-facts come from matching object identities.
 * Risk facts union. Different identities become unknown.
 */
function mergeStates<T>(
  left: EnvState<T>,
  right: EnvState<T>,
  emptyData: () => T,
  mergeData: (left: T, right: T) => T,
): EnvState<T> {
  const env = new Map<BindingId, ObjectId | undefined>();
  const objects = new Map<ObjectId, SharedRecord<T>>();
  const ids = new Set([...left.env.keys(), ...right.env.keys()]);
  for (const bindingId of ids) {
    const leftId = left.env.get(bindingId);
    const rightId = right.env.get(bindingId);
    const leftHas = left.env.has(bindingId);
    const rightHas = right.env.has(bindingId);
    if (!leftHas || !rightHas || leftId === undefined || rightId === undefined || leftId !== rightId) {
      env.set(bindingId, undefined);
      continue;
    }
    const merged = mergeRecords(left.objects.get(leftId), right.objects.get(rightId), emptyData, mergeData);
    if (!merged) {
      env.set(bindingId, undefined);
      continue;
    }
    env.set(bindingId, leftId);
    objects.set(leftId, merged);
  }
  return { env, objects, completion: "normal" };
}

function mergeMany<T>(
  paths: EnvState<T>[],
  emptyData: () => T,
  mergeData: (left: T, right: T) => T,
): EnvState<T> | undefined {
  const reachable = paths.filter((path) => path.completion === "normal");
  if (reachable.length === 0) return undefined;
  let current = reachable[0]!;
  for (let i = 1; i < reachable.length; i++) {
    current = mergeStates(current, reachable[i]!, emptyData, mergeData);
  }
  return current;
}

function replaceWith<T>(target: EnvState<T>, source: EnvState<T>): void {
  target.env.clear();
  for (const [id, objectId] of source.env) target.env.set(id, objectId);
  target.objects.clear();
  for (const [id, rec] of source.objects) target.objects.set(id, rec);
  target.completion = source.completion;
}

function ctorKind(
  analysis: ProvenanceQuery,
  node: unknown,
  kinds: readonly ProvenanceKind[],
): ProvenanceKind | null {
  const expr = unwrapExpression(node);
  if (!isNode(expr) || expr.type !== "NewExpression") return null;
  const callee = (expr as ESTree.NewExpression).callee;
  const name = getName(callee);
  if (!name) return null;
  const map: Record<string, ProvenanceKind> = {
    GlideRecord: "GlideRecord",
    GlideRecordSecure: "GlideRecord",
    GlideAggregate: "GlideAggregate",
    GlideAjax: "GlideAjax",
    GlideDateTime: "GlideDateTime",
  };
  const kind = map[name];
  if (!kind || !kinds.includes(kind)) return null;
  if (!analysis.isPlatformCtor(callee, [name])) return null;
  return kind;
}

function resolveBinding(
  bindings: FileBindings,
  node: unknown,
  ancestors: readonly ESTree.Node[],
): LexicalBinding | null {
  const expr = unwrapExpression(node);
  const name = getName(expr);
  if (!name || !isNode(expr)) return null;
  return bindings.tree.resolve(name, expr, ancestors);
}

function scopeContains(scope: ScopeNode | null, block: ESTree.Node): boolean {
  let current = scope;
  while (current) {
    if (current.block === block) return true;
    current = current.parent;
  }
  return false;
}

function capturedBindings(
  fn: ESTree.Node,
  bindings: FileBindings,
  env: Map<BindingId, ObjectId | undefined>,
): BindingId[] {
  const found = new Set<BindingId>();
  const ancestors: ESTree.Node[] = [];
  const visit = (node: unknown): void => {
    if (!isNode(node)) return;
    if (isFunctionLike(node) && node !== fn) {
      visitChildren(node, (child) => visit(child));
      return;
    }
    ancestors.push(node);
    if (node.type === "Identifier" && isValueReference(node, ancestors)) {
      const binding = bindings.tree.resolve(getName(node) ?? "", node, ancestors);
      const declared = binding ? bindings.tree.scopeById(binding.scopeId) : null;
      if (binding && env.has(binding.id) && !scopeContains(declared, fn)) {
        found.add(binding.id);
      }
    }
    visitChildren(node, (child) => visit(child));
    ancestors.pop();
  };
  visit(fn);
  return [...found];
}

/**
 * Path-sensitive tracker keyed by lexical binding identity and runtime object
 * identity. Abrupt completions do not join into later statements.
 */
export function analyzePathBindings<T>(options: PathAnalysisOptions<T>): void {
  const { program, analysis, kinds, emptyData, cloneData, mergeData, onCall, onRef, onValue } = options;
  const bindings = analysis.bindings;
  let nextObjectId = 1;
  const alloc = (): ObjectId => {
    nextObjectId += 1;
    return nextObjectId;
  };
  const seenFunctions = new Set<ESTree.Node>();
  const ancestors: ESTree.Node[] = [];
  const newExpressionIds = new WeakMap<ESTree.Node, ObjectId>();
  const platformObjects = new Map<string, ObjectId>();
  const PLATFORM_ALIASES = new Set(["g_form", "gs", "current"]);

  const ensure = (state: EnvState<T>, objectId: ObjectId): SharedRecord<T> => {
    const existing = state.objects.get(objectId);
    if (existing) return existing;
    const created: SharedRecord<T> = {
      id: objectId,
      escaped: false,
      invalid: false,
      data: emptyData(),
    };
    state.objects.set(objectId, created);
    return created;
  };

  const recordOf = (state: EnvState<T>, objectId: ObjectId | undefined): SharedRecord<T> | undefined => {
    if (objectId === undefined) return undefined;
    const rec = state.objects.get(objectId);
    if (!rec || rec.invalid || rec.escaped) return undefined;
    return rec;
  };

  const objectFromExpr = (state: EnvState<T>, node: unknown): ObjectId | undefined => {
    const expr = unwrapExpression(node);
    if (!isNode(expr)) return undefined;
    if (expr.type === "Identifier") {
      const binding = resolveBinding(bindings, expr, ancestors);
      if (binding) return state.env.get(binding.id);
      const name = getName(expr);
      if (name && PLATFORM_ALIASES.has(name) && analysis.isPlatformGlobal(expr)) {
        let objectId = platformObjects.get(name);
        if (objectId === undefined) {
          objectId = alloc();
          platformObjects.set(name, objectId);
        }
        ensure(state, objectId);
        return objectId;
      }
      return undefined;
    }
    if (expr.type === "NewExpression" && ctorKind(analysis, expr, kinds)) {
      const existing = newExpressionIds.get(expr);
      if (existing !== undefined) {
        ensure(state, existing);
        return existing;
      }
      const rec: SharedRecord<T> = {
        id: alloc(),
        escaped: false,
        invalid: false,
        data: emptyData(),
      };
      state.objects.set(rec.id, rec);
      newExpressionIds.set(expr, rec.id);
      onRef?.({ node: expr, rec, name: getName((expr as ESTree.NewExpression).callee), bindingId: null });
      return rec.id;
    }
    if (expr.type === "SequenceExpression") {
      const expressions = (expr as ESTree.SequenceExpression).expressions;
      return objectFromExpr(state, expressions[expressions.length - 1]);
    }
    if (onValue) {
      const existing = newExpressionIds.get(expr);
      if (existing !== undefined) {
        ensure(state, existing);
        return existing;
      }
      const data = onValue(expr);
      if (data !== undefined) {
        const rec: SharedRecord<T> = {
          id: alloc(),
          escaped: false,
          invalid: false,
          data,
        };
        state.objects.set(rec.id, rec);
        newExpressionIds.set(expr, rec.id);
        onRef?.({ node: expr, rec, name: getName(expr), bindingId: null });
        return rec.id;
      }
    }
    return undefined;
  };

  const markEscape = (state: EnvState<T>, node: unknown): void => {
    const expr = unwrapExpression(node);
    if (!isNode(expr)) return;
    switch (expr.type) {
      case "Identifier": {
        const binding = resolveBinding(bindings, expr, ancestors);
        if (!binding) return;
        const objectId = state.env.get(binding.id);
        if (objectId === undefined) return;
        const rec = state.objects.get(objectId);
        if (rec) rec.escaped = true;
        return;
      }
      case "ArrayExpression":
        for (const element of (expr as ESTree.ArrayExpression).elements) markEscape(state, element);
        return;
      case "ObjectExpression":
        for (const prop of (expr as ESTree.ObjectExpression).properties) {
          if (!isNode(prop)) continue;
          if (prop.type === "SpreadElement") {
            markEscape(state, (prop as ESTree.SpreadElement).argument);
          } else if (prop.type === "Property") {
            const property = prop as ESTree.ObjectProperty;
            if (property.computed) markEscape(state, property.key);
            markEscape(state, property.value);
          }
        }
        return;
      case "NewExpression": {
        const objectId = objectFromExpr(state, expr);
        if (objectId !== undefined) {
          const rec = state.objects.get(objectId);
          if (rec) rec.escaped = true;
        }
        return;
      }
      case "SpreadElement":
        markEscape(state, (expr as ESTree.SpreadElement).argument);
        return;
      case "ConditionalExpression": {
        const cond = expr as ESTree.ConditionalExpression;
        markEscape(state, cond.consequent);
        markEscape(state, cond.alternate);
        return;
      }
      case "LogicalExpression": {
        const logical = expr as ESTree.LogicalExpression;
        markEscape(state, logical.left);
        markEscape(state, logical.right);
        return;
      }
      case "AssignmentExpression":
        markEscape(state, (expr as ESTree.AssignmentExpression).right);
        return;
      case "SequenceExpression":
        for (const item of (expr as ESTree.SequenceExpression).expressions) markEscape(state, item);
        return;
      default:
        return;
    }
  };

  const bindPattern = (state: EnvState<T>, pattern: unknown, objectId: ObjectId | undefined): void => {
    const inner = unwrapExpression(pattern);
    if (!isNode(inner)) return;
    if (inner.type === "Identifier") {
      const binding = resolveBinding(bindings, inner, ancestors);
      if (binding) state.env.set(binding.id, objectId);
      return;
    }
    if (inner.type === "AssignmentPattern") {
      bindPattern(state, (inner as ESTree.AssignmentPattern).left, objectId);
      return;
    }
    if (inner.type === "ObjectPattern" || inner.type === "ArrayPattern" || inner.type === "RestElement") {
      if (objectId !== undefined) {
        const rec = state.objects.get(objectId);
        if (rec) rec.escaped = true;
      }
    }
  };

  const assignFrom = (state: EnvState<T>, left: unknown, right: unknown): void => {
    const target = unwrapExpression(left);
    if (isNode(target) && target.type === "MemberExpression") {
      markEscape(state, right);
      return;
    }
    bindPattern(state, left, objectFromExpr(state, right));
  };

  const joinInto = (state: EnvState<T>, paths: EnvState<T>[]): void => {
    const merged = mergeMany(paths, emptyData, mergeData);
    if (!merged) {
      state.completion = paths[0]?.completion ?? "return";
      return;
    }
    replaceWith(state, merged);
  };

  const visit = (node: unknown, state: EnvState<T>, traverseRoot: boolean): void => {
    if (!isNode(node) || state.completion !== "normal") return;

    if (isFunctionLike(node) && !traverseRoot) {
      if (seenFunctions.has(node)) return;
      seenFunctions.add(node);
      for (const bindingId of capturedBindings(node, bindings, state.env)) {
        const objectId = state.env.get(bindingId);
        if (objectId === undefined) continue;
        const rec = state.objects.get(objectId);
        if (rec) rec.escaped = true;
      }
      visit(node, { env: new Map(), objects: new Map(), completion: "normal" }, true);
      return;
    }

    ancestors.push(node);
    switch (node.type) {
      case "ObjectExpression":
      case "ArrayExpression":
        visitChildren(node, (child) => visit(child, state, false));
        markEscape(state, node);
        break;
      case "VariableDeclarator": {
        const decl = node as ESTree.VariableDeclarator;
        if (decl.init) visit(decl.init, state, false);
        assignFrom(state, decl.id, decl.init);
        break;
      }
      case "AssignmentExpression": {
        const assign = node as ESTree.AssignmentExpression;
        visit(assign.right, state, false);
        if (assign.operator === "=") {
          assignFrom(state, assign.left, assign.right);
        } else {
          visit(assign.left, state, false);
        }
        break;
      }
      case "IfStatement": {
        const stmt = node as ESTree.IfStatement;
        visit(stmt.test, state, false);
        const consequent = snapshotState(state, cloneData);
        visit(stmt.consequent, consequent, false);
        const alternate = snapshotState(state, cloneData);
        if (stmt.alternate) visit(stmt.alternate, alternate, false);
        joinInto(state, [consequent, alternate]);
        break;
      }
      case "ConditionalExpression": {
        const expr = node as ESTree.ConditionalExpression;
        visit(expr.test, state, false);
        const consequent = snapshotState(state, cloneData);
        visit(expr.consequent, consequent, false);
        const alternate = snapshotState(state, cloneData);
        visit(expr.alternate, alternate, false);
        joinInto(state, [consequent, alternate]);
        break;
      }
      case "LogicalExpression": {
        const expr = node as ESTree.LogicalExpression;
        visit(expr.left, state, false);
        const afterLeft = snapshotState(state, cloneData);
        visit(expr.right, state, false);
        joinInto(state, [afterLeft, snapshotState(state, cloneData)]);
        break;
      }
      case "SwitchStatement": {
        const stmt = node as ESTree.SwitchStatement;
        visit(stmt.discriminant, state, false);
        const before = snapshotState(state, cloneData);
        const exits: EnvState<T>[] = [];
        let hasDefault = false;
        let fall = snapshotState(before, cloneData);
        for (const switchCase of stmt.cases) {
          if (!switchCase.test) hasDefault = true;
          const entry = mergeStates(snapshotState(before, cloneData), fall, emptyData, mergeData);
          if (switchCase.test) visit(switchCase.test, entry, false);
          for (const consequent of switchCase.consequent) visit(consequent, entry, false);
          if (entry.completion === "break") {
            entry.completion = "normal";
            exits.push(entry);
            fall = snapshotState(before, cloneData);
          } else if (entry.completion === "normal") {
            fall = entry;
          } else {
            fall = snapshotState(before, cloneData);
          }
        }
        if (!hasDefault) exits.push(before);
        else if (fall.completion === "normal") exits.push(fall);
        joinInto(state, exits.length > 0 ? exits : [before]);
        break;
      }
      case "ForStatement":
      case "WhileStatement":
      case "DoWhileStatement":
      case "ForInStatement":
      case "ForOfStatement": {
        if (node.type === "ForStatement" && (node as ESTree.ForStatement).init) {
          visit((node as ESTree.ForStatement).init, state, false);
        }
        if (
          (node.type === "ForInStatement" || node.type === "ForOfStatement") &&
          (node as ESTree.ForInStatement | ESTree.ForOfStatement).left
        ) {
          visit((node as ESTree.ForInStatement).left, state, false);
          visit((node as ESTree.ForInStatement).right, state, false);
        }
        const before = snapshotState(state, cloneData);
        if (node.type === "ForStatement") {
          const stmt = node as ESTree.ForStatement;
          if (stmt.test) visit(stmt.test, state, false);
          if (stmt.body) visit(stmt.body, state, false);
          if (stmt.update && state.completion === "normal") visit(stmt.update, state, false);
        } else if (node.type === "WhileStatement" || node.type === "DoWhileStatement") {
          const stmt = node as ESTree.WhileStatement | ESTree.DoWhileStatement;
          if (node.type === "WhileStatement") visit(stmt.test, state, false);
          visit(stmt.body, state, false);
          if (node.type === "DoWhileStatement" && state.completion === "normal") visit(stmt.test, state, false);
        } else {
          visit((node as ESTree.ForInStatement).body, state, false);
        }
        resetLoopCompletion(state);
        const after = snapshotState(state, cloneData);
        const zero = node.type === "DoWhileStatement" ? after : before;
        joinInto(state, [zero, after]);
        break;
      }
      case "TryStatement": {
        const stmt = node as ESTree.TryStatement;
        const before = snapshotState(state, cloneData);
        const tried = snapshotState(before, cloneData);
        visit(stmt.block, tried, false);
        const caught = snapshotState(before, cloneData);
        if (stmt.handler) visit(stmt.handler, caught, false);
        const afterTry = mergeMany([tried, caught], emptyData, mergeData);
        if (afterTry) replaceWith(state, afterTry);
        else replaceWith(state, tried.completion === "normal" ? tried : caught);
        if (stmt.finalizer) visit(stmt.finalizer, state, false);
        break;
      }
      case "CallExpression": {
        const call = node as ESTree.CallExpression;
        const callee = unwrapExpression(call.callee);
        const property = staticPropertyName(callee);
        let objectName: string | null = null;
        let rec: SharedRecord<T> | undefined;
        if (isNode(callee) && callee.type === "MemberExpression") {
          const object = unwrapExpression((callee as ESTree.MemberExpression).object);
          objectName = getName(object);
          const objectId = objectFromExpr(state, object);
          rec = recordOf(state, objectId);
        }
        onCall({ call, rec, objectName, property });
        for (const arg of call.arguments) markEscape(state, arg);
        visitChildren(node, (child) => visit(child, state, false));
        break;
      }
      case "NewExpression": {
        for (const arg of (node as ESTree.NewExpression).arguments) markEscape(state, arg);
        objectFromExpr(state, node);
        visitChildren(node, (child) => visit(child, state, false));
        break;
      }
      case "ReturnStatement":
        markEscape(state, (node as ESTree.ReturnStatement).argument);
        visit((node as ESTree.ReturnStatement).argument, state, false);
        state.completion = "return";
        break;
      case "ThrowStatement":
        markEscape(state, (node as ESTree.ThrowStatement).argument);
        visit((node as ESTree.ThrowStatement).argument, state, false);
        state.completion = "throw";
        break;
      case "BreakStatement":
        state.completion = "break";
        break;
      case "ContinueStatement":
        state.completion = "continue";
        break;
      case "Identifier": {
        if (isValueReference(node, ancestors)) {
          const name = getName(node);
          const binding = resolveBinding(bindings, node, ancestors);
          const objectId = objectFromExpr(state, node);
          onRef?.({
            node,
            rec: objectId !== undefined ? state.objects.get(objectId) : undefined,
            name,
            bindingId: binding?.id ?? null,
          });
        }
        break;
      }
      case "MemberExpression":
        objectFromExpr(state, node);
        visitChildren(node, (child) => visit(child, state, false));
        break;
      default:
        visitChildren(node, (child) => visit(child, state, false));
    }
    ancestors.pop();
  };

  visit(program, { env: new Map(), objects: new Map(), completion: "normal" }, true);
}
