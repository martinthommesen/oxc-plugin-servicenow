import { defineRule } from "@oxlint/plugins";
import type { Context, ESTree } from "@oxlint/plugins";
import {
  builtInCallMayWritePlatformProperty,
  directPlatformGlobalName,
  findStablePlatformConstructorCalls,
  findStablePlatformStaticMethodCalls,
  isAvailabilityGuarded,
  isInvocationAvailabilityGuarded,
  isNewExpressionFinding,
  platformGlobalNamespaceAccess,
  resolveConstValue,
  resolvePlatformGlobalName,
  staticPropertyName,
  type AvailabilityGuardOptions,
  type PlatformConstructorCallFinding,
  type PlatformStaticMethodCallFinding,
} from "../analysis/internal.js";
import type { EngineFeatureId } from "../engine/index.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { nodeStart } from "../utils/ast.js";
import { beginRuleFile, platformNamespaceIsSafe } from "./helpers.js";

export type UnsupportedGlobalInvocation =
  | (PlatformConstructorCallFinding & { readonly kind: "construct" })
  | (PlatformStaticMethodCallFinding & { readonly kind: "staticMethod" });

interface UnsupportedGlobalInvocationOptions {
  readonly names: readonly string[];
  /** `"new"` reports only `new Name(...)`; the default also reports `Name(...)`. */
  readonly constructorForm?: "new" | "any";
  readonly staticMethods?: Readonly<Record<string, readonly string[]>>;
}

/**
 * Stable constructor and static-method invocations of unsupported globals in
 * source order, minus those an availability guard or polyfill protects. Rules
 * for one engine feature map each finding to their own message.
 */
export function findUnprotectedGlobalInvocations(
  context: Context,
  program: ESTree.Node,
  options: UnsupportedGlobalInvocationOptions,
): readonly UnsupportedGlobalInvocation[] {
  const file = beginRuleFile(context);
  const shared = {
    program,
    file,
    namespaces: ["globalThis"],
    mutationSemantics: "callable",
  } as const;
  let constructors = findStablePlatformConstructorCalls({ ...shared, names: options.names });
  if (options.constructorForm === "new") constructors = constructors.filter(isNewExpressionFinding);
  const findings: UnsupportedGlobalInvocation[] = constructors.map((finding) => ({
    ...finding,
    kind: "construct",
  }));
  if (options.staticMethods) {
    for (const finding of findStablePlatformStaticMethodCalls({
      ...shared,
      methods: options.staticMethods,
    })) {
      findings.push({ ...finding, kind: "staticMethod" });
    }
  }
  findings.sort((left, right) => nodeStart(left.node) - nodeStart(right.node));
  return findings.filter((finding) => !isUnsupportedGlobalInvocationProtected(context, finding));
}

interface UnsupportedConstructorRuleOptions {
  description: string;
  url: string;
  message: string;
  messageId?: "unsupported" | "weak";
  features: Readonly<Record<string, EngineFeatureId>>;
}

export function unsupportedConstructorRule(options: UnsupportedConstructorRuleOptions) {
  const names = Object.keys(options.features);
  const messageId = options.messageId ?? "weak";
  return defineRule({
    meta: {
      type: "problem",
      docs: { description: options.description, url: options.url },
      messages: { [messageId]: options.message },
    },
    createOnce(context) {
      return {
        before() {
          const { script } = beginRuleFile(context);
          if (!names.some((name) => shouldDiagnoseFeature(script, options.features[name]!)))
            return false;
          return undefined;
        },
        Program(node) {
          const file = beginRuleFile(context);
          for (const finding of findStablePlatformConstructorCalls({
            program: node as ESTree.Node,
            file,
            names,
            namespaces: ["globalThis"],
            mutationSemantics: "callable",
          })) {
            if (!shouldDiagnoseFeature(file.script, options.features[finding.name]!)) continue;
            if (isUnsupportedGlobalInvocationProtected(context, finding)) {
              continue;
            }
            context.report({
              node: finding.node,
              messageId,
              data: { name: finding.name },
            });
          }
        },
      };
    },
  });
}

export function isUnsupportedGlobalInvocationProtected(
  context: Context,
  finding: PlatformConstructorCallFinding | PlatformStaticMethodCallFinding,
): boolean {
  return unsupportedGlobalInvocationIsProtected(context, finding, false);
}

/**
 * Return whether a static-method call is protected when its owner exists in
 * the configured engine but the selected method may not.
 */
export function isUnsupportedStaticMethodInvocationProtected(
  context: Context,
  finding: PlatformStaticMethodCallFinding,
): boolean {
  return unsupportedGlobalInvocationIsProtected(context, finding, true);
}

function unsupportedGlobalInvocationIsProtected(
  context: Context,
  finding: PlatformConstructorCallFinding | PlatformStaticMethodCallFinding,
  platformRootIsSupported: boolean,
): boolean {
  const { aliasOrigin, name, node: invocation } = finding;
  const method = "method" in finding ? finding.method : undefined;
  const file = beginRuleFile(context);
  const { provenance, script } = file;
  const isRootCallInvalidation = (call: ESTree.CallExpression): boolean =>
    builtInCallMayWritePlatformProperty(
      call,
      "globalThis",
      name,
      script.javascriptMode,
      provenance,
      file,
    );
  const isMethodCallInvalidation = (call: ESTree.CallExpression): boolean =>
    isRootCallInvalidation(call) ||
    Boolean(
      method &&
      builtInCallMayWritePlatformProperty(
        call,
        name,
        method,
        script.javascriptMode,
        provenance,
        file,
      ),
    );
  const globalThisIsSafeAt = (namespace: ESTree.Node): boolean =>
    platformNamespaceIsSafe(context, namespace, file);
  const isConstructorAccess = (candidate: unknown): boolean => {
    if (resolvePlatformGlobalName(candidate, provenance.bindings) !== name) return false;
    const candidateNamespace = platformGlobalNamespaceAccess(candidate, provenance.bindings);
    return candidateNamespace === null || globalThisIsSafeAt(candidateNamespace);
  };
  const isConstructorPropertyExistenceTest = (property: string, object: ESTree.Node): boolean => {
    const origin = resolveConstValue(object, provenance.bindings);
    return (
      property === name &&
      origin !== null &&
      directPlatformGlobalName(origin, provenance.bindings) === "globalThis" &&
      globalThisIsSafeAt(origin)
    );
  };
  const namespace = platformGlobalNamespaceAccess(invocation.callee, provenance.bindings);
  if (namespace && !globalThisIsSafeAt(namespace)) return false;

  const rootIsGuaranteed = platformRootIsSupported && !file.mutations.isGlobalAuthorityLost(name);

  if (aliasOrigin?.qualified) {
    const originNamespace =
      platformGlobalNamespaceAccess(aliasOrigin.node, provenance.bindings) ??
      (directPlatformGlobalName(aliasOrigin.node, provenance.bindings) === "globalThis"
        ? aliasOrigin.node
        : null);
    if (!originNamespace || !globalThisIsSafeAt(originNamespace)) return false;
  } else if (
    aliasOrigin &&
    !rootIsGuaranteed &&
    !isAvailabilityGuarded(context, aliasOrigin.node, provenance, isConstructorAccess, {
      allowDirectAccessGuard: false,
      isCallInvalidation: isRootCallInvalidation,
      isPropertyExistenceTest: isConstructorPropertyExistenceTest,
    })
  ) {
    return false;
  }

  const staticMethodNode = (candidate: unknown): ESTree.MemberExpression | null => {
    const value = resolveConstValue(candidate, provenance.bindings);
    return value?.type === "MemberExpression" &&
      staticPropertyName(value) === method &&
      resolvePlatformGlobalName(value.object, provenance.bindings) === name
      ? value
      : null;
  };
  const hasSafeQualifiedOrigin = (candidate: unknown): boolean =>
    isConstructorAccess(candidate) &&
    platformGlobalNamespaceAccess(candidate, provenance.bindings) !== null;
  const rootGuardOptions = {
    allowDirectAccessGuard: hasSafeQualifiedOrigin,
    isCallInvalidation: isRootCallInvalidation,
    isPropertyExistenceTest: isConstructorPropertyExistenceTest,
    isOptionalInvocation: (candidate) => {
      if (candidate.type !== "CallExpression" || !candidate.optional) return false;
      if (method === undefined) return hasSafeQualifiedOrigin(candidate.callee);
      const callee = staticMethodNode(candidate.callee);
      return Boolean(
        callee?.optional && platformGlobalNamespaceAccess(callee, provenance.bindings),
      );
    },
  } satisfies AvailabilityGuardOptions;
  const rootIsProtected =
    rootIsGuaranteed ||
    isInvocationAvailabilityGuarded(
      context,
      invocation,
      provenance,
      isConstructorAccess,
      rootGuardOptions,
    );
  if (!method || !rootIsProtected) return rootIsProtected;

  const isStaticMethodAccess = (candidate: unknown): boolean => {
    const value = staticMethodNode(candidate);
    return Boolean(
      value &&
      (rootIsGuaranteed ||
        isAvailabilityGuarded(context, value, provenance, isConstructorAccess, rootGuardOptions)),
    );
  };
  const optionalMethodInvocationIsSafe = (candidate: ESTree.CallExpression): boolean => {
    const callee = resolveConstValue(candidate.callee, provenance.bindings);
    return Boolean(
      candidate.optional &&
      callee?.type === "MemberExpression" &&
      staticMethodNode(callee) &&
      (rootIsGuaranteed ||
        (callee.optional && platformGlobalNamespaceAccess(callee, provenance.bindings))),
    );
  };

  return isInvocationAvailabilityGuarded(context, invocation, provenance, isStaticMethodAccess, {
    allowDirectAccessGuard: isStaticMethodAccess,
    isCallInvalidation: isMethodCallInvalidation,
    isPropertyExistenceTest: (property, object) =>
      property === method &&
      isConstructorAccess(object) &&
      (rootIsGuaranteed ||
        isAvailabilityGuarded(context, object, provenance, isConstructorAccess, rootGuardOptions)),
    isOptionalInvocation: (candidate) =>
      candidate.type === "CallExpression" && optionalMethodInvocationIsSafe(candidate),
  });
}
