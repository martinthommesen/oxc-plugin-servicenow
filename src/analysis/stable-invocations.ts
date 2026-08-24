import type { ESTree } from "@oxlint/plugins";
import { isNode, unwrapExpression, walk } from "../utils/ast.js";
import type { FileBindings } from "./bindings.js";
import { resolveConstValue } from "./members.js";

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
  return (
    isNode(node) &&
    (node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression")
  );
}

function executesImmediately(node: ImmediateFunction): boolean {
  return node.type === "ArrowFunctionExpression" || !node.generator;
}

function recordWrittenPattern(
  target: unknown,
  bindings: FileBindings,
  ancestors: readonly ESTree.Node[],
  written: Set<number>,
): void {
  const node = unwrapExpression(target);
  if (!isNode(node)) return;
  if (node.type === "Identifier") {
    const binding = bindings.resolve(node.name, node, ancestors);
    if (binding) written.add(binding.id);
    return;
  }
  if (node.type === "AssignmentPattern") {
    recordWrittenPattern(node.left, bindings, ancestors, written);
    return;
  }
  if (node.type === "RestElement") {
    recordWrittenPattern(node.argument, bindings, ancestors, written);
    return;
  }
  if (node.type === "ArrayPattern") {
    for (const element of node.elements) {
      recordWrittenPattern(element, bindings, ancestors, written);
    }
    return;
  }
  if (node.type === "ObjectPattern") {
    for (const property of node.properties) {
      if (property.type === "RestElement") {
        recordWrittenPattern(property.argument, bindings, ancestors, written);
      } else {
        recordWrittenPattern(
          (property as ESTree.ObjectProperty).value,
          bindings,
          ancestors,
          written,
        );
      }
    }
  }
}

/**
 * Index local functions whose runtime identity is stable enough to expand at
 * one direct call site. Multiple call sites stay unknown because the shared
 * provenance view is intentionally not call-context-sensitive.
 */
export function analyzeStableInvocations(
  program: ESTree.Node,
  bindings: FileBindings,
): StableInvocationQuery {
  const written = new Set<number>();
  const calls: ESTree.CallExpression[] = [];
  const ancestors: ESTree.Node[] = [];
  let hasDynamicScope = false;
  let callBudgetExceeded = false;

  walk(
    program,
    {
      AssignmentExpression(node) {
        recordWrittenPattern(
          (node as ESTree.AssignmentExpression).left,
          bindings,
          ancestors,
          written,
        );
      },
      UpdateExpression(node) {
        recordWrittenPattern(
          (node as ESTree.UpdateExpression).argument,
          bindings,
          ancestors,
          written,
        );
      },
      ForInStatement(node) {
        recordWrittenPattern((node as ESTree.ForInStatement).left, bindings, ancestors, written);
      },
      ForOfStatement(node) {
        recordWrittenPattern((node as ESTree.ForOfStatement).left, bindings, ancestors, written);
      },
      WithStatement() {
        hasDynamicScope = true;
      },
      CallExpression(node) {
        const call = node as ESTree.CallExpression;
        const callee = unwrapExpression(call.callee);
        if (
          isNode(callee) &&
          callee.type === "Identifier" &&
          callee.name === "eval" &&
          bindings.isPlatformGlobal(callee, ancestors)
        ) {
          hasDynamicScope = true;
        }
        if (calls.length < MAX_STABLE_CALL_SITES) calls.push(call);
        else callBudgetExceeded = true;
      },
    },
    ancestors,
  );

  const resolveBase = (callee: unknown): ImmediateFunction | null => {
    const direct = unwrapExpression(callee);
    if (!isNode(direct)) return null;
    if (isFunctionNode(direct)) return executesImmediately(direct) ? direct : null;
    // Calling a member, conditional, or sequence expression can evaluate
    // additional code at the call site. Keep expansion to a direct binding;
    // resolveConstValue may then follow its immutable aliases.
    if (direct.type !== "Identifier") return null;
    const value = resolveConstValue(direct, bindings);
    if (!value) return null;
    if (isFunctionNode(value)) return executesImmediately(value) ? value : null;
    if (value.type !== "Identifier" || hasDynamicScope) return null;
    const binding = bindings.resolve(value.name, value);
    if (
      binding?.kind !== "function" ||
      binding.node.type !== "FunctionDeclaration" ||
      written.has(binding.id)
    ) {
      return null;
    }
    if (!isFunctionNode(binding.node)) return null;
    return executesImmediately(binding.node) ? binding.node : null;
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
