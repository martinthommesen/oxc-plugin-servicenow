import type { ESTree } from "@oxlint/plugins";
import { getName, isNode, isValueReference, unwrapExpression, WALK_SKIP_KEYS, walk } from "../utils/ast.js";
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

type AbruptCompletion = Exclude<Completion, "normal">;

interface EnvState<T> {
  env: Map<BindingId, ObjectId | undefined>;
  objects: Map<ObjectId, SharedRecord<T>>;
  completion: Completion;
  /** Label on break/continue completions, if any. */
  completionLabel?: string | null;
  /** Alternative abrupt paths retained until their owning construct consumes them. */
  abrupt: Map<AbruptCompletion, EnvState<T>[]>;
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

function cloneAbrupt<T>(
  abrupt: Map<AbruptCompletion, EnvState<T>[]>,
  cloneData: (data: T) => T,
): Map<AbruptCompletion, EnvState<T>[]> {
  const copy = new Map<AbruptCompletion, EnvState<T>[]>();
  for (const [kind, paths] of abrupt) {
    copy.set(kind, paths.map((path) => snapshotState(path, cloneData)));
  }
  return copy;
}

function clearAbrupt<T>(state: EnvState<T>): void {
  state.abrupt.clear();
}

function pathWithoutAlternatives<T>(state: EnvState<T>, cloneData: (data: T) => T): EnvState<T> {
  const copy = snapshotState(state, cloneData);
  copy.abrupt.clear();
  return copy;
}

/** Return every reachable completion represented by one abstract state. */
function completionPaths<T>(state: EnvState<T>, cloneData: (data: T) => T): EnvState<T>[] {
  const paths: EnvState<T>[] = [];
  const add = (path: EnvState<T>): void => {
    const copy = pathWithoutAlternatives(path, cloneData);
    paths.push(copy);
    for (const nested of path.abrupt.values()) {
      for (const child of nested) add(child);
    }
  };
  add(state);
  return paths;
}

function setCompletion<T>(state: EnvState<T>, completion: Completion, label: string | null = null): void {
  state.completion = completion;
  state.completionLabel = label;
}

function resetLoopCompletion<T>(state: EnvState<T>): void {
  if (state.completion === "break" || state.completion === "continue") {
    setCompletion(state, "normal");
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
    completionLabel: state.completionLabel,
    abrupt: cloneAbrupt(state.abrupt, cloneData),
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
  return { env, objects, completion: "normal", abrupt: new Map() };
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

function replaceWith<T>(target: EnvState<T>, source: EnvState<T>, cloneData?: (data: T) => T): void {
  target.env.clear();
  for (const [id, objectId] of source.env) target.env.set(id, objectId);
  target.objects.clear();
  for (const [id, rec] of source.objects) target.objects.set(id, rec);
  target.completion = source.completion;
  target.completionLabel = source.completionLabel;
  target.abrupt.clear();
  if (cloneData) {
    for (const [kind, paths] of source.abrupt) {
      target.abrupt.set(kind, paths.map((path) => snapshotState(path, cloneData)));
    }
  } else {
    for (const [kind, paths] of source.abrupt) target.abrupt.set(kind, paths);
  }
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
): BindingId[] {
  const found = new Set<BindingId>();
  const ancestors: ESTree.Node[] = [];
  const visit = (node: unknown): void => {
    if (!isNode(node)) return;
    // A nested closure has its own capture set. Do not accidentally attribute
    // its references to the containing function.
    if (isFunctionLike(node) && node !== fn) return;
    ancestors.push(node);
    if (node.type === "Identifier" && isValueReference(node, ancestors)) {
      const binding = bindings.tree.resolve(getName(node) ?? "", node, ancestors);
      const declared = binding ? bindings.tree.scopeById(binding.scopeId) : null;
      if (binding && !scopeContains(declared, fn)) found.add(binding.id);
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
  const ancestors: ESTree.Node[] = [];
  const newExpressionIds = new WeakMap<ESTree.Node, ObjectId>();
  const platformObjects = new Map<string, ObjectId>();
  const capturedBindingIds = new Set<BindingId>();
  const functionDefs = new Map<BindingId, ESTree.Node>();
  const activeFunctions = new Set<ESTree.Node>();
  const PLATFORM_ALIASES = new Set(["g_form", "gs", "current"]);

  // Collect captures before execution so a hoisted function declaration can
  // invalidate a later `var` assignment regardless of source order.
  walk(options.program, {
    FunctionDeclaration(node) {
      for (const id of capturedBindings(node, bindings)) capturedBindingIds.add(id);
    },
    FunctionExpression(node) {
      for (const id of capturedBindings(node, bindings)) capturedBindingIds.add(id);
    },
    ArrowFunctionExpression(node) {
      for (const id of capturedBindings(node, bindings)) capturedBindingIds.add(id);
    },
  });

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
    if (expr.type === "ConditionalExpression") {
      const conditional = expr as ESTree.ConditionalExpression;
      const left = objectFromExpr(state, conditional.consequent);
      const right = objectFromExpr(state, conditional.alternate);
      return left !== undefined && left === right ? left : undefined;
    }
    if (expr.type === "LogicalExpression") {
      const logical = expr as ESTree.LogicalExpression;
      const left = objectFromExpr(state, logical.left);
      const right = objectFromExpr(state, logical.right);
      // A logical expression can return either operand. Preserve an alias
      // only when every statically tracked outcome is the same identity. This
      // is safe for &&, ||, and ?? when both reachable operands are the same.
      return left !== undefined && left === right ? left : undefined;
    }
    if (expr.type === "AssignmentExpression") {
      const assignment = expr as ESTree.AssignmentExpression;
      // Assignment expressions evaluate to their right-hand result. Compound
      // assignments may retain/coerce the previous value, so stay unknown.
      return assignment.operator === "=" ? objectFromExpr(state, assignment.right) : undefined;
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

  const markCapturedBinding = (state: EnvState<T>, bindingId: BindingId): void => {
    if (!capturedBindingIds.has(bindingId)) return;
    const objectId = state.env.get(bindingId);
    if (objectId === undefined) return;
    const rec = state.objects.get(objectId);
    if (rec) rec.escaped = true;
  };

  const invalidatePattern = (state: EnvState<T>, pattern: unknown): void => {
    const inner = unwrapExpression(pattern);
    if (!isNode(inner)) return;
    if (inner.type === "Identifier") {
      const binding = resolveBinding(bindings, inner, ancestors);
      if (binding) {
        state.env.set(binding.id, undefined);
        markCapturedBinding(state, binding.id);
      }
      return;
    }
    if (inner.type === "AssignmentPattern") {
      invalidatePattern(state, (inner as ESTree.AssignmentPattern).left);
      return;
    }
    if (inner.type === "RestElement") {
      invalidatePattern(state, (inner as unknown as { argument?: unknown }).argument);
      return;
    }
    if (inner.type === "ObjectPattern") {
      for (const prop of (inner as ESTree.ObjectPattern).properties) {
        if (!isNode(prop)) continue;
        if (prop.type === "RestElement") invalidatePattern(state, prop.argument);
        else if (prop.type === "Property") invalidatePattern(state, (prop as ESTree.ObjectProperty).value);
      }
      return;
    }
    if (inner.type === "ArrayPattern") {
      for (const element of (inner as ESTree.ArrayPattern).elements) invalidatePattern(state, element);
    }
  };

  const bindPattern = (state: EnvState<T>, pattern: unknown, objectId: ObjectId | undefined): void => {
    const inner = unwrapExpression(pattern);
    if (!isNode(inner)) return;
    if (inner.type === "Identifier") {
      const binding = resolveBinding(bindings, inner, ancestors);
      if (binding) {
        state.env.set(binding.id, objectId);
        markCapturedBinding(state, binding.id);
      }
      return;
    }
    if (inner.type === "AssignmentPattern") {
      bindPattern(state, (inner as ESTree.AssignmentPattern).left, objectId);
      return;
    }
    if (inner.type === "RestElement") {
      invalidatePattern(state, inner.argument);
      if (objectId !== undefined) {
        const rec = state.objects.get(objectId);
        if (rec) rec.escaped = true;
      }
      return;
    }
    if (inner.type === "ObjectPattern" || inner.type === "ArrayPattern") {
      invalidatePattern(state, inner);
      if (objectId !== undefined) {
        const rec = state.objects.get(objectId);
        if (rec) rec.escaped = true;
      }
    }
  };

  const visitPatternExpressions = (state: EnvState<T>, pattern: unknown): void => {
    const inner = unwrapExpression(pattern);
    if (!isNode(inner)) return;
    if (inner.type === "AssignmentPattern") {
      visit((inner as ESTree.AssignmentPattern).right, state, false);
      visitPatternExpressions(state, (inner as ESTree.AssignmentPattern).left);
      return;
    }
    if (inner.type === "RestElement") {
      visitPatternExpressions(state, inner.argument);
      return;
    }
    if (inner.type === "ObjectPattern") {
      for (const prop of (inner as ESTree.ObjectPattern).properties) {
        if (!isNode(prop)) continue;
        if (prop.type === "RestElement") visitPatternExpressions(state, prop.argument);
        else if (prop.type === "Property") {
          const property = prop as ESTree.ObjectProperty;
          if (property.computed) visit(property.key, state, false);
          visitPatternExpressions(state, property.value);
        }
      }
      return;
    }
    if (inner.type === "ArrayPattern") {
      for (const element of (inner as ESTree.ArrayPattern).elements) visitPatternExpressions(state, element);
    }
  };

  const assignFrom = (state: EnvState<T>, left: unknown, right: unknown): void => {
    const target = unwrapExpression(left);
    if (isNode(target) && target.type === "MemberExpression") {
      markEscape(state, right);
      return;
    }
    const objectId = objectFromExpr(state, right);
    if (isNode(target) && (target.type === "ObjectPattern" || target.type === "ArrayPattern" || target.type === "RestElement")) {
      bindPattern(state, target, objectId);
      return;
    }
    bindPattern(state, left, objectId);
  };

  const joinInto = (state: EnvState<T>, paths: EnvState<T>[]): void => {
    const flattened = paths.flatMap((path) => completionPaths(path, cloneData));
    const normal = flattened.filter((path) => path.completion === "normal");
    const abrupt = flattened.filter((path) => path.completion !== "normal");
    const merged = mergeMany(normal, emptyData, mergeData);
    state.abrupt.clear();
    if (merged) {
      replaceWith(state, merged);
      state.completion = "normal";
      state.completionLabel = null;
    } else if (abrupt.length > 0) {
      // Keep one completion in the primary state and retain all other
      // alternatives. Owning loops/switches/try statements consume them.
      replaceWith(state, abrupt[0]!);
      for (const path of abrupt.slice(1)) {
        const kind = path.completion as AbruptCompletion;
        const list = state.abrupt.get(kind) ?? [];
        list.push(pathWithoutAlternatives(path, cloneData));
        state.abrupt.set(kind, list);
      }
    } else {
      setCompletion(state, "normal");
    }
  };

  const visit = (node: unknown, state: EnvState<T>, traverseRoot: boolean): void => {
    if (!isNode(node) || state.completion !== "normal") return;

    if (isFunctionLike(node) && !traverseRoot) {
      for (const bindingId of capturedBindings(node, bindings)) {
        const objectId = state.env.get(bindingId);
        if (objectId === undefined) continue;
        const rec = state.objects.get(objectId);
        if (rec) rec.escaped = true;
      }
      const closure = snapshotState(state, cloneData);
      const scope = bindings.tree.scopeForNode(node);
      if (scope) {
        for (const binding of scope.bindings.values()) closure.env.delete(binding.id);
      }
      visit(node, closure, true);
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
        // Evaluate loop headers before taking the zero-iteration snapshot. A
        // condition can mutate a tracked object even when it immediately
        // yields false, so the post-test state is the loop's zero-body path.
        if (node.type === "ForStatement" && (node as ESTree.ForStatement).init) {
          visit((node as ESTree.ForStatement).init, state, false);
        }
        if (node.type === "ForInStatement" || node.type === "ForOfStatement") {
          const iterable = node as ESTree.ForInStatement | ESTree.ForOfStatement;
          if (iterable.right) visit(iterable.right, state, false);
          if (iterable.left) visit(iterable.left, state, false);
        }

        const beforeTest = snapshotState(state, cloneData);
        const testState = snapshotState(beforeTest, cloneData);
        const isFor = node.type === "ForStatement";
        const isWhile = node.type === "WhileStatement";
        const isDoWhile = node.type === "DoWhileStatement";
        if (isFor) {
          const test = (node as ESTree.ForStatement).test;
          if (test) visit(test, testState, false);
        } else if (isWhile) {
          visit((node as ESTree.WhileStatement).test, testState, false);
        }

        if (isDoWhile) {
          // A do/while always enters its body once. `continue` still flows
          // through the owning condition before the next iteration.
          const bodyState = snapshotState(beforeTest, cloneData);
          visit((node as ESTree.DoWhileStatement).body, bodyState, false);
          const bodyCompletion = bodyState.completion;
          if (bodyCompletion === "break") {
            resetLoopCompletion(bodyState);
          } else if (bodyCompletion === "continue") {
            resetLoopCompletion(bodyState);
            visit((node as ESTree.DoWhileStatement).test, bodyState, false);
          } else if (bodyCompletion === "normal") {
            visit((node as ESTree.DoWhileStatement).test, bodyState, false);
          }
          const after = snapshotState(bodyState, cloneData);
          joinInto(state, [after]);
          break;
        }

        // While/for/for-in/for-of can take the zero-body path after their
        // header/test effects, or enter one iteration from that same state.
        const bodyState = snapshotState(testState, cloneData);
        if (isFor) {
          visit((node as ESTree.ForStatement).body, bodyState, false);
        } else if (isWhile) {
          visit((node as ESTree.WhileStatement).body, bodyState, false);
        } else {
          visit((node as ESTree.ForInStatement | ESTree.ForOfStatement).body, bodyState, false);
        }

        const bodyCompletion = bodyState.completion;
        if (bodyCompletion === "break") {
          // break exits the loop and skips a for-update expression.
          resetLoopCompletion(bodyState);
        } else {
          // Both labeled and unlabeled continue target the owning loop here;
          // consuming it before the update/test models JavaScript's target
          // semantics instead of dropping those side effects.
          if (bodyCompletion === "continue") resetLoopCompletion(bodyState);
          if (isFor) {
            const update = (node as ESTree.ForStatement).update;
            if (update) visit(update, bodyState, false);
          }
        }
        const after = snapshotState(bodyState, cloneData);
        joinInto(state, [testState, after]);
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

  visit(program, { env: new Map(), objects: new Map(), completion: "normal", abrupt: new Map() }, true);
}
