import type { ESTree } from "@oxlint/plugins";
import { getName, isNode, unwrapExpression } from "../utils/ast.js";
import { isFunctionLike, type FileBindings, type LexicalBinding } from "./bindings.js";
import { resolvePlatformGlobalName } from "./globals.js";
import { resolveConstValue } from "./members.js";
import {
  isPlatformAliasGlobal,
  ctorProvenanceKind,
  type ProvenanceKind,
  type ProvenanceQuery,
} from "./provenance.js";
import { constantValue, logicalRightOperandRuns } from "./constant-value.js";
import { spendWork, type WorkBudget } from "./path-budget.js";
import type {
  CallableValues,
  EnvState,
  ObjectId,
  PathRefInput,
  SharedRecord,
} from "./path-types.js";

function ctorKind(
  analysis: ProvenanceQuery,
  node: unknown,
  kinds: readonly ProvenanceKind[],
): ProvenanceKind | null {
  const expr = unwrapExpression(node);
  if (!isNode(expr) || expr.type !== "NewExpression") return null;
  const callee = resolveConstValue((expr as ESTree.NewExpression).callee, analysis.bindings);
  if (!callee) return null;
  const name = resolvePlatformGlobalName(callee, analysis.bindings);
  if (!name) return null;
  const kind = ctorProvenanceKind(name);
  if (!kind || !kinds.includes(kind)) return null;
  if (!analysis.isPlatformCtor(callee, [name])) return null;
  return kind;
}

export function resolveBinding(
  bindings: FileBindings,
  node: unknown,
  ancestors: readonly ESTree.Node[],
): LexicalBinding | null {
  const expr = unwrapExpression(node);
  const name = getName(expr);
  if (!name || !isNode(expr)) return null;
  return bindings.resolve(name, expr, ancestors);
}

interface PathValueContext<T> {
  bindings: FileBindings;
  analysis: ProvenanceQuery;
  kinds: readonly ProvenanceKind[];
  budget: WorkBudget;
  ancestors: ESTree.Node[];
  newExpressionIds: WeakMap<ESTree.Node, ObjectId>;
  retainedPlatformObjectIds: Set<ObjectId>;
  alloc: () => ObjectId;
  emptyData: () => T;
  ensure: (state: EnvState<T>, id: ObjectId) => SharedRecord<T>;
  publishRef: (input: PathRefInput<T>) => void;
  onValue: ((node: ESTree.Node) => T | undefined) | undefined;
  stopAtAwait: boolean;
}

/** Resolve expression values without owning statement traversal or state joins. */
export function createPathValueResolver<T>(context: PathValueContext<T>) {
  const {
    bindings,
    analysis,
    kinds,
    budget,
    ancestors,
    newExpressionIds,
    retainedPlatformObjectIds,
    alloc,
    emptyData,
    ensure,
    publishRef,
    onValue,
    stopAtAwait,
  } = context;
  const platformObjects = new Map<string, ObjectId>();
  const objectFromExpr = (state: EnvState<T>, node: unknown): ObjectId | undefined => {
    const expr = unwrapExpression(node);
    if (!isNode(expr)) return undefined;
    switch (expr.type) {
      case "Identifier": {
        const binding = resolveBinding(bindings, expr, ancestors);
        if (binding) return state.env.get(binding.id);
        const name = getName(expr);
        if (name && isPlatformAliasGlobal(name) && analysis.isPlatformGlobal(expr)) {
          let objectId = platformObjects.get(name);
          if (objectId === undefined) {
            objectId = alloc();
            platformObjects.set(name, objectId);
            retainedPlatformObjectIds.add(objectId);
          }
          ensure(state, objectId);
          return objectId;
        }
        return undefined;
      }
      case "NewExpression": {
        if (ctorKind(analysis, expr, kinds)) {
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
          publishRef({
            node: expr,
            rec,
            name: getName((expr as ESTree.NewExpression).callee),
            bindingId: null,
          });
          return rec.id;
        }
        break;
      }
      case "SequenceExpression": {
        const expressions = (expr as ESTree.SequenceExpression).expressions;
        return objectFromExpr(state, expressions[expressions.length - 1]);
      }
      case "ConditionalExpression": {
        const conditional = expr as ESTree.ConditionalExpression;
        const selected = constantValue(conditional.test);
        if (selected)
          return objectFromExpr(
            state,
            selected.truthy ? conditional.consequent : conditional.alternate,
          );
        const left = objectFromExpr(state, conditional.consequent);
        const right = objectFromExpr(state, conditional.alternate);
        return left !== undefined && left === right ? left : undefined;
      }
      case "LogicalExpression": {
        const logical = expr as ESTree.LogicalExpression;
        const evaluateRight = logicalRightOperandRuns(logical);
        if (evaluateRight !== null)
          return objectFromExpr(state, evaluateRight ? logical.right : logical.left);
        const left = objectFromExpr(state, logical.left);
        const right = objectFromExpr(state, logical.right);
        // A logical expression can return either operand. Preserve an alias
        // only when every statically tracked outcome is the same identity. This
        // is safe for &&, ||, and ?? when both reachable operands are the same.
        return left !== undefined && left === right ? left : undefined;
      }
      case "AssignmentExpression": {
        const assignment = expr as ESTree.AssignmentExpression;
        // Assignment expressions evaluate to their right-hand result. Compound
        // assignments may retain/coerce the previous value, so stay unknown.
        return assignment.operator === "=" ? objectFromExpr(state, assignment.right) : undefined;
      }
    }
    if (onValue) {
      const existing = newExpressionIds.get(expr);
      if (existing !== undefined) {
        const record = state.objects.get(existing);
        if (!record || record.invalid || record.escaped) {
          const data = onValue(expr);
          if (data === undefined) return undefined;
          // Allocation sites are reused to keep loop fixpoints finite, but a
          // binding can still point at the site's value from an earlier
          // evaluation. Detach those stale aliases before publishing facts
          // for the newly evaluated host value.
          for (const [bindingId, objectId] of state.env) {
            if (objectId === existing) state.env.set(bindingId, undefined);
          }
          const refreshed: SharedRecord<T> = {
            id: existing,
            escaped: false,
            invalid: false,
            data,
          };
          state.objects.set(existing, refreshed);
          publishRef({ node: expr, rec: refreshed, name: getName(expr), bindingId: null });
        }
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
        publishRef({ node: expr, rec, name: getName(expr), bindingId: null });
        return rec.id;
      }
    }
    return undefined;
  };

  const functionsFromExpr = (state: EnvState<T>, node: unknown): CallableValues => {
    spendWork(budget);
    const expr = unwrapExpression(node);
    if (!isNode(expr)) return [undefined];
    const result = state.callableResults.get(expr);
    if (result) return result;
    if (isFunctionLike(expr)) return [expr];
    switch (expr.type) {
      case "Identifier": {
        const binding = resolveBinding(bindings, expr, ancestors);
        return (binding && state.functions.get(binding.id)) || [undefined];
      }
      case "SequenceExpression": {
        return functionsFromExpr(state, expr.expressions.at(-1));
      }
      case "AssignmentExpression": {
        if (expr.operator === "=") {
          return functionsFromExpr(state, expr.right);
        }
        break;
      }
      case "ConditionalExpression": {
        const selected = constantValue(expr.test);
        if (selected)
          return functionsFromExpr(state, selected.truthy ? expr.consequent : expr.alternate);
        return [
          ...new Set([
            ...functionsFromExpr(state, expr.consequent),
            ...functionsFromExpr(state, expr.alternate),
          ]),
        ];
      }
      case "LogicalExpression": {
        const rightRuns = logicalRightOperandRuns(expr);
        if (rightRuns !== null) return functionsFromExpr(state, rightRuns ? expr.right : expr.left);
        return [
          ...new Set([
            ...functionsFromExpr(state, expr.left),
            ...functionsFromExpr(state, expr.right),
          ]),
        ];
      }
    }
    return [undefined];
  };

  const normalValueFromExpr = (state: EnvState<T>, node: unknown): ESTree.Node | null => {
    const expr = unwrapExpression(node);
    if (!isNode(expr)) return null;
    if (!stopAtAwait) return expr;
    switch (expr.type) {
      case "AwaitExpression": {
        return null;
      }
      case "SequenceExpression": {
        const expressions = (expr as ESTree.SequenceExpression).expressions;
        for (const item of expressions.slice(0, -1)) {
          if (normalValueFromExpr(state, item) === null) return null;
        }
        return normalValueFromExpr(state, expressions[expressions.length - 1]);
      }
      case "ConditionalExpression": {
        const conditional = expr as ESTree.ConditionalExpression;
        const selected = constantValue(conditional.test);
        if (selected)
          return normalValueFromExpr(
            state,
            selected.truthy ? conditional.consequent : conditional.alternate,
          );
        const consequent = normalValueFromExpr(state, conditional.consequent);
        const alternate = normalValueFromExpr(state, conditional.alternate);
        if (consequent === null) return alternate;
        if (alternate === null) return consequent;
        const consequentId = objectFromExpr(state, consequent);
        const alternateId = objectFromExpr(state, alternate);
        if (consequentId !== undefined && consequentId === alternateId) return consequent;
        return expr;
      }
      case "LogicalExpression": {
        const logical = expr as ESTree.LogicalExpression;
        const rightRuns = logicalRightOperandRuns(logical);
        if (rightRuns !== null)
          return normalValueFromExpr(state, rightRuns ? logical.right : logical.left);
        const left = normalValueFromExpr(state, logical.left);
        if (left === null) return null;
        const right = normalValueFromExpr(state, logical.right);
        if (right === null) return left;
        const leftId = objectFromExpr(state, left);
        const rightId = objectFromExpr(state, right);
        return leftId !== undefined && leftId === rightId ? left : expr;
      }
      case "AssignmentExpression": {
        const assignment = expr as ESTree.AssignmentExpression;
        const right = normalValueFromExpr(state, assignment.right);
        if (right === null)
          return ["&&=", "||=", "??="].includes(assignment.operator) ? assignment.left : null;
        return assignment.operator === "=" ? right : expr;
      }
    }
    return expr;
  };

  return { objectFromExpr, functionsFromExpr, normalValueFromExpr };
}
