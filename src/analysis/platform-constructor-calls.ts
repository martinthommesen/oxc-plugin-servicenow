import type { ESTree } from "@oxlint/plugins";
import { isNode, propertyKeyName, unwrapExpression, walk } from "../utils/ast.js";
import { forEachResolvedPatternBinding } from "./bindings.js";
import type { MutationQuery } from "./mutations.js";
import { staticPropertyName } from "./members.js";
import type { ProvenanceQuery } from "./provenance.js";

const MAX_CONSTRUCTOR_CALL_SITES = 20_000;

export interface PlatformConstructorCallFinding {
  readonly name: string;
  readonly node: ESTree.CallExpression | ESTree.NewExpression;
}

export interface PlatformConstructorCallOptions {
  readonly program: ESTree.Node;
  readonly analysis: ProvenanceQuery;
  readonly mutations: MutationQuery;
  readonly names: readonly string[];
  readonly namespaces?: readonly string[];
}

interface DeclaratorFacts {
  readonly executionBoundary: ESTree.Node;
  readonly isDirectStatement: boolean;
}

interface CallSite {
  readonly callee: unknown;
  readonly executionBoundary: ESTree.Node;
  readonly node: ESTree.CallExpression | ESTree.NewExpression;
}

function functionLike(node: ESTree.Node | undefined): boolean {
  return (
    node?.type === "FunctionDeclaration" ||
    node?.type === "FunctionExpression" ||
    node?.type === "ArrowFunctionExpression"
  );
}

function executionBoundary(ancestors: readonly ESTree.Node[]): ESTree.Node | null {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];
    if (ancestor && (ancestor.type === "Program" || functionLike(ancestor))) return ancestor;
  }
  return null;
}

function isDirectExecutionStatement(ancestors: readonly ESTree.Node[]): boolean {
  const declaration = ancestors.at(-2);
  const container = ancestors.at(-3);
  if (declaration?.type !== "VariableDeclaration" || !container) return false;
  if (container.type === "Program") return true;
  if (container.type !== "BlockStatement") return false;
  const owner = ancestors.at(-4) as (ESTree.Node & { body?: unknown }) | undefined;
  return Boolean(owner && functionLike(owner) && owner.body === container);
}

function definitelyPrecedes(left: unknown, right: ESTree.Node): boolean {
  const leftEnd = isNode(left) ? (left as { end?: number }).end : undefined;
  const rightStart = (right as { start?: number }).start;
  return typeof leftEnd === "number" && typeof rightStart === "number" && leftEnd <= rightStart;
}

/**
 * Find calls to platform constructors whose identity is structurally stable.
 *
 * Mutable and path-dependent aliases deliberately stay unknown. This analysis
 * is intended for recommended diagnostics where silence is safer than
 * attributing a local replacement to the ServiceNow API.
 */
export function findStablePlatformConstructorCalls({
  program,
  analysis,
  mutations,
  names,
  namespaces = [],
}: PlatformConstructorCallOptions): readonly PlatformConstructorCallFinding[] {
  const nameSet = new Set(names);
  const namespaceSet = new Set(namespaces);
  const written = new Set<number>();
  const declarators = new WeakMap<ESTree.VariableDeclarator, DeclaratorFacts>();
  const callSites: CallSite[] = [];
  const ancestors: ESTree.Node[] = [];
  let hasDynamicScope = false;
  let callBudgetExceeded = false;

  const recordWrittenPattern = (target: unknown): void => {
    forEachResolvedPatternBinding(target, analysis.bindings, ancestors, (binding) => {
      written.add(binding.id);
    });
  };

  const recordCallSite = (node: ESTree.CallExpression | ESTree.NewExpression): void => {
    if (callSites.length >= MAX_CONSTRUCTOR_CALL_SITES) {
      callBudgetExceeded = true;
      return;
    }
    const boundary = executionBoundary(ancestors);
    if (boundary) callSites.push({ callee: node.callee, executionBoundary: boundary, node });
  };

  walk(
    program,
    {
      VariableDeclarator(node) {
        const boundary = executionBoundary(ancestors);
        if (!boundary) return;
        declarators.set(node as ESTree.VariableDeclarator, {
          executionBoundary: boundary,
          isDirectStatement: isDirectExecutionStatement(ancestors),
        });
      },
      AssignmentExpression(node) {
        recordWrittenPattern((node as ESTree.AssignmentExpression).left);
      },
      UpdateExpression(node) {
        recordWrittenPattern((node as ESTree.UpdateExpression).argument);
      },
      ForInStatement(node) {
        recordWrittenPattern((node as ESTree.ForInStatement).left);
      },
      ForOfStatement(node) {
        recordWrittenPattern((node as ESTree.ForOfStatement).left);
      },
      WithStatement() {
        hasDynamicScope = true;
      },
      NewExpression(node) {
        recordCallSite(node as ESTree.NewExpression);
      },
      CallExpression(node) {
        const call = node as ESTree.CallExpression;
        const callee = unwrapExpression(call.callee);
        if (
          isNode(callee) &&
          callee.type === "Identifier" &&
          callee.name === "eval" &&
          analysis.bindings.isPlatformGlobal(callee)
        ) {
          hasDynamicScope = true;
        }
        recordCallSite(call);
      },
    },
    ancestors,
  );

  if (hasDynamicScope || callBudgetExceeded) return [];

  const constructorIdentityIsStable = (name: string): boolean =>
    !mutations.isGlobalAuthorityLost(name) &&
    namespaces.every((namespace) => !mutations.isGlobalPathAuthorityLost([namespace, name]));

  const directNamespace = (node: unknown): string | null => {
    const value = unwrapExpression(node);
    if (!isNode(value) || value.type !== "Identifier" || !namespaceSet.has(value.name)) {
      return null;
    }
    if (!analysis.bindings.isPlatformGlobal(value)) return null;
    return mutations.isGlobalAuthorityLost(value.name) ? null : value.name;
  };

  const destructuredName = (
    declaration: ESTree.VariableDeclarator,
    bindingId: number,
  ): string | null => {
    if (declaration.id.type !== "ObjectPattern" || !directNamespace(declaration.init)) return null;
    const facts = declarators.get(declaration);
    if (!facts) return null;
    for (const item of declaration.id.properties) {
      if (item.type !== "Property") continue;
      const property = item as ESTree.ObjectProperty;
      if (property.value.type !== "Identifier") continue;
      const local = property.value;
      const localBinding = analysis.bindings.resolve(local.name, local);
      if (localBinding?.id !== bindingId) continue;
      const name = propertyKeyName(property);
      return name && nameSet.has(name) ? name : null;
    }
    return null;
  };

  const resolveConstructor = (node: unknown, useBoundary: ESTree.Node): string | null => {
    let current = node;
    const seen = new Set<number>();
    while (true) {
      const value = unwrapExpression(current);
      if (!isNode(value)) return null;

      if (value.type === "MemberExpression") {
        const name = staticPropertyName(value);
        const namespace = directNamespace(value.object);
        return name &&
          namespace &&
          nameSet.has(name) &&
          constructorIdentityIsStable(name) &&
          !mutations.isGlobalPathAuthorityLost([namespace, name])
          ? name
          : null;
      }

      if (value.type !== "Identifier") return null;
      if (nameSet.has(value.name) && analysis.bindings.isPlatformGlobal(value)) {
        return constructorIdentityIsStable(value.name) ? value.name : null;
      }

      const binding = analysis.bindings.resolve(value.name, value);
      if (
        !binding ||
        seen.has(binding.id) ||
        written.has(binding.id) ||
        binding.declarations.length !== 1 ||
        binding.node.type !== "VariableDeclarator"
      ) {
        return null;
      }
      const declaration = binding.node as ESTree.VariableDeclarator;
      const facts = declarators.get(declaration);
      if (
        !facts?.isDirectStatement ||
        facts.executionBoundary !== useBoundary ||
        !declaration.init ||
        !definitelyPrecedes(declaration.init, value)
      ) {
        return null;
      }

      const selected = destructuredName(declaration, binding.id);
      if (selected) return constructorIdentityIsStable(selected) ? selected : null;
      if (declaration.id.type !== "Identifier" || declaration.id.name !== binding.name) return null;
      seen.add(binding.id);
      current = declaration.init;
    }
  };

  const findings: PlatformConstructorCallFinding[] = [];
  for (const callSite of callSites) {
    const name = resolveConstructor(callSite.callee, callSite.executionBoundary);
    if (name) findings.push({ name, node: callSite.node });
  }
  return findings;
}
