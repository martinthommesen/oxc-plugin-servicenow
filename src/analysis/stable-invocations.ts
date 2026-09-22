import type { ESTree } from "@oxlint/plugins";
import { isNode, unwrapExpression, walk } from "../utils/ast.js";
import { isFunctionLike, type FileBindings } from "./bindings.js";
import type { BindingWriteQuery } from "./binding-writes.js";
import { resolveConstValue, resolveDominatingConstValue } from "./members.js";

const MAX_STABLE_CALL_SITES = 20_000;

export interface ImmediateFunction {
  readonly type: "FunctionDeclaration" | "FunctionExpression" | "ArrowFunctionExpression";
  readonly params: readonly ESTree.Node[];
  readonly body: ESTree.Node;
  readonly generator?: boolean;
}

export interface StableInvocationQuery {
  /** Resolve a function body proven to execute immediately at this call site. */
  resolve(callee: unknown): ImmediateFunction | null;
}

export function isFunctionNode(node: unknown): node is ImmediateFunction {
  return isFunctionLike(node);
}

function executesImmediately(node: ImmediateFunction): boolean {
  return node.type === "ArrowFunctionExpression" || !node.generator;
}

export interface StableCallableOptions {
  readonly temporal?: "possible" | "dominating";
  /** Require calling the function to run its body immediately. */
  readonly requireImmediateExecution?: boolean;
}

/** Resolve function syntax whose identity is stable at this exact use. */
export function resolveStableCallable(
  node: unknown,
  bindings: FileBindings,
  bindingWrites: BindingWriteQuery,
  options: StableCallableOptions = {},
): ImmediateFunction | null {
  if (bindingWrites.hasDynamicScope()) return null;
  const { temporal = "dominating", requireImmediateExecution = false } = options;
  const value =
    temporal === "possible"
      ? resolveConstValue(node, bindings)
      : resolveDominatingConstValue(node, bindings);
  if (!value) return null;
  if (isFunctionNode(value)) {
    return !requireImmediateExecution || executesImmediately(value) ? value : null;
  }
  if (value.type !== "Identifier") return null;
  const binding = bindings.resolve(value.name, value);
  if (
    binding?.kind !== "function" ||
    binding.node.type !== "FunctionDeclaration" ||
    bindingWrites.isWritten(binding.id) ||
    !isFunctionNode(binding.node)
  ) {
    return null;
  }
  return !requireImmediateExecution || executesImmediately(binding.node) ? binding.node : null;
}

/**
 * Index local functions whose runtime identity is stable enough to expand at
 * one direct call site. Multiple call sites stay unknown because the shared
 * provenance view is intentionally not call-context-sensitive.
 */
export function analyzeStableInvocations(
  program: ESTree.Node,
  bindings: FileBindings,
  bindingWrites: BindingWriteQuery,
): StableInvocationQuery {
  const calls: ESTree.CallExpression[] = [];
  let callBudgetExceeded = false;

  walk(program, {
    CallExpression(node) {
      const call = node as ESTree.CallExpression;
      if (calls.length < MAX_STABLE_CALL_SITES) calls.push(call);
      else callBudgetExceeded = true;
    },
  });

  const resolveBase = (callee: unknown): ImmediateFunction | null => {
    const direct = unwrapExpression(callee);
    if (!isNode(direct)) return null;
    if (isFunctionNode(direct)) return executesImmediately(direct) ? direct : null;
    // Member, conditional, and sequence calls can evaluate additional code.
    // Expansion stays limited to direct bindings and immutable aliases.
    if (direct.type !== "Identifier") return null;
    return resolveStableCallable(direct, bindings, bindingWrites, {
      temporal: "possible",
      requireImmediateExecution: true,
    });
  };

  const callCounts = new WeakMap<ImmediateFunction, number>();
  if (!callBudgetExceeded) {
    for (const call of calls) {
      const fn = resolveBase(call.callee);
      if (fn) callCounts.set(fn, (callCounts.get(fn) ?? 0) + 1);
    }
  }

  const cache = new WeakMap<ESTree.Node, ImmediateFunction | null>();
  return Object.freeze({
    resolve(callee: unknown): ImmediateFunction | null {
      const direct = unwrapExpression(callee);
      if (!isNode(direct)) return null;
      if (cache.has(direct)) return cache.get(direct) ?? null;
      if (isFunctionNode(direct) && executesImmediately(direct)) {
        cache.set(direct, direct);
        return direct;
      }
      const fn = callBudgetExceeded ? null : resolveBase(direct);
      const resolved = fn && callCounts.get(fn) === 1 ? fn : null;
      cache.set(direct, resolved);
      return resolved;
    },
  });
}
