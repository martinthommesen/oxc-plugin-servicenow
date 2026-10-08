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
import { constantValue, type ConstantValue } from "./constant-value.js";
import { MAX_PATH_DEPTH, spendWork, type WorkBudget } from "./path-budget.js";
import type {
  BindingId,
  CallableValues,
  EnvState,
  EvaluatedValue,
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

/** Read a saved value before unwrapping, so argument wrappers keep their own evaluation. */
export function savedExpressionValue<T>(
  state: EnvState<T>,
  node: unknown,
): EvaluatedValue | undefined {
  const saved = isNode(node) ? state.assignmentResults.get(node) : undefined;
  if (saved) return saved;
  const expr = unwrapExpression(node);
  return isNode(expr) ? state.assignmentResults.get(expr) : undefined;
}

/** Syntax selectors can also consume values already selected during this expression. */
export function evaluatedConstantValue<T>(
  state: EnvState<T>,
  node: unknown,
  budget: WorkBudget,
  depth = 0,
): ConstantValue | null {
  if (depth >= MAX_PATH_DEPTH) return null;
  spendWork(budget);
  const expr = unwrapExpression(node);
  if (!isNode(expr)) return null;
  const selected = savedExpressionValue(state, node);
  if (selected) return selected.constant;
  const syntax = constantValue(expr);
  if (syntax) return syntax;
  switch (expr.type) {
    case "SequenceExpression":
      return evaluatedConstantValue(state, expr.expressions.at(-1), budget, depth + 1);
    case "AssignmentExpression":
      return expr.operator === "="
        ? evaluatedConstantValue(state, expr.right, budget, depth + 1)
        : null;
    case "ConditionalExpression": {
      const test = evaluatedConstantValue(state, expr.test, budget, depth + 1);
      return test
        ? evaluatedConstantValue(
            state,
            test.truthy ? expr.consequent : expr.alternate,
            budget,
            depth + 1,
          )
        : null;
    }
    case "LogicalExpression": {
      const left = evaluatedConstantValue(state, expr.left, budget, depth + 1);
      if (!left) return null;
      const rightRuns =
        expr.operator === "&&" ? left.truthy : expr.operator === "||" ? !left.truthy : left.nullish;
      return evaluatedConstantValue(state, rightRuns ? expr.right : expr.left, budget, depth + 1);
    }
    default:
      return null;
  }
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
  argumentsBinding: (node: ESTree.Node) => BindingId | undefined;
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
    argumentsBinding,
  } = context;
  const platformObjects = new Map<string, ObjectId>();
  const objectFromExpr = (state: EnvState<T>, node: unknown): ObjectId | undefined => {
    const expr = unwrapExpression(node);
    if (!isNode(expr)) return undefined;
    const result = savedExpressionValue(state, node);
    if (result) return result.objectId;
    switch (expr.type) {
      case "Identifier": {
        const binding = resolveBinding(bindings, expr, ancestors);
        if (binding) return state.env.get(binding.id);
        const argumentId = argumentsBinding(expr);
        if (argumentId !== undefined) return state.env.get(argumentId);
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
        const selected = evaluatedConstantValue(state, conditional.test, budget);
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
        const selected = evaluatedConstantValue(state, logical.left, budget);
        const evaluateRight = selected
          ? logical.operator === "&&"
            ? selected.truthy
            : logical.operator === "||"
              ? !selected.truthy
              : selected.nullish
          : null;
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
    const assignment = savedExpressionValue(state, node);
    if (assignment) return assignment.functions;
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
        const selected = evaluatedConstantValue(state, expr.test, budget);
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
        const selected = evaluatedConstantValue(state, expr.left, budget);
        const rightRuns = selected
          ? expr.operator === "&&"
            ? selected.truthy
            : expr.operator === "||"
              ? !selected.truthy
              : selected.nullish
          : null;
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

  const constantFromExpr = (state: EnvState<T>, node: unknown): ConstantValue | null => {
    let expr = unwrapExpression(node);
    for (let depth = 0; isNode(expr) && depth < MAX_PATH_DEPTH; depth += 1) {
      spendWork(budget);
      const result = savedExpressionValue(state, depth === 0 ? node : expr);
      if (result) return result.constant;
      const constant = constantValue(expr);
      if (constant) return constant;
      if (expr.type === "Identifier") {
        const binding = resolveBinding(bindings, expr, ancestors);
        if (!binding) {
          return expr.name === "undefined" && bindings.isPlatformGlobal(expr)
            ? { truthy: false, nullish: true, nullishValue: "undefined" }
            : null;
        }
        const scalar = state.constants.get(binding.id);
        if (scalar !== undefined) return scalar;
        const functions = state.functions.get(binding.id);
        spendWork(budget, functions?.length ?? 0);
        return functions?.length && functions.every((fn) => fn !== undefined)
          ? { truthy: true, nullish: false }
          : null;
      }
      if (expr.type === "SequenceExpression") {
        expr = unwrapExpression(expr.expressions.at(-1));
      } else if (expr.type === "AssignmentExpression" && expr.operator === "=") {
        expr = unwrapExpression(expr.right);
      } else if (expr.type === "ConditionalExpression" || expr.type === "LogicalExpression") {
        return evaluatedConstantValue(state, expr, budget, depth);
      } else {
        return null;
      }
    }
    return null;
  };

  const valueFromExpr = (state: EnvState<T>, node: unknown): EvaluatedValue => ({
    objectId: objectFromExpr(state, node),
    functions: functionsFromExpr(state, node),
    constant: constantFromExpr(state, node),
  });

  const normalValueFromExpr = (state: EnvState<T>, node: unknown): ESTree.Node | null => {
    const expr = unwrapExpression(node);
    if (!isNode(expr)) return null;
    if (!stopAtAwait || savedExpressionValue(state, node)) return expr;
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
        const selected = evaluatedConstantValue(state, conditional.test, budget);
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
        const selected = evaluatedConstantValue(state, logical.left, budget);
        const rightRuns = selected
          ? logical.operator === "&&"
            ? selected.truthy
            : logical.operator === "||"
              ? !selected.truthy
              : selected.nullish
          : null;
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

  return {
    objectFromExpr,
    functionsFromExpr,
    constantFromExpr,
    valueFromExpr,
    normalValueFromExpr,
  };
}
