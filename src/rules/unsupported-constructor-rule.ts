import { defineRule } from "@oxlint/plugins";
import type { Context, ESTree } from "@oxlint/plugins";
import {
  isAvailabilityGuarded,
  isInvocationAvailabilityGuarded,
  type AvailabilityGuardOptions,
} from "../analysis/availability.js";
import {
  directPlatformGlobalName,
  platformGlobalNamespaceAccess,
  resolvePlatformGlobalName,
} from "../analysis/globals.js";
import {
  builtInCallMayWritePlatformProperty,
  findStablePlatformConstructorCalls,
  resolveConstValue,
  staticPropertyName,
  type PlatformConstructorCallFinding,
  type PlatformStaticMethodCallFinding,
} from "../analysis/internal.js";
import type { EngineFeatureId } from "../engine/index.js";
import { isFeatureAllowed, shouldDiagnoseFeature } from "../engine/index.js";
import { beginRuleFile } from "./helpers.js";

interface UnsupportedConstructorRuleOptions {
  description: string;
  url: string;
  message: string;
  features: Readonly<Record<string, EngineFeatureId>>;
}

export function unsupportedConstructorRule(options: UnsupportedConstructorRuleOptions) {
  const names = Object.keys(options.features);
  return defineRule({
    meta: {
      type: "problem",
      docs: { description: options.description, url: options.url },
      messages: { weak: options.message },
    },
    createOnce(context) {
      return {
        before() {
          const { context: script } = beginRuleFile(context);
          if (!names.some((name) => shouldDiagnoseFeature(script, options.features[name]!)))
            return false;
        },
        Program(node) {
          const { analysis, context: script, file } = beginRuleFile(context);
          for (const finding of findStablePlatformConstructorCalls({
            program: node as ESTree.Node,
            analysis,
            bindingWrites: file.bindingWrites,
            mutations: file.mutations,
            names,
            namespaces: ["globalThis"],
            mutationSemantics: "callable",
          })) {
            if (!shouldDiagnoseFeature(script, options.features[finding.name]!)) continue;
            if (isUnsupportedGlobalInvocationProtected(context, finding)) {
              continue;
            }
            context.report({ node: finding.node, messageId: "weak", data: { name: finding.name } });
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
  const { analysis, context: script, file } = beginRuleFile(context);
  const isConstructorAccess = (candidate: unknown): boolean =>
    resolvePlatformGlobalName(candidate, analysis.bindings) === name;
  const isRootCallInvalidation = (call: ESTree.CallExpression): boolean =>
    builtInCallMayWritePlatformProperty(
      call,
      "globalThis",
      name,
      script.javascriptMode,
      analysis,
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
        analysis,
        file,
      ),
    );
  const globalThisIsSafeAt = (namespace: ESTree.Node): boolean =>
    isFeatureAllowed("global-this", script.javascriptMode, script.settings.release) ||
    isAvailabilityGuarded(
      context,
      namespace,
      analysis,
      (candidate) => directPlatformGlobalName(candidate, analysis.bindings) === "globalThis",
      {
        allowDirectAccessGuard: false,
        guardCacheKey: "unsupported-constructor:global-this",
      },
    );
  const namespace = platformGlobalNamespaceAccess(invocation.callee, analysis.bindings);
  if (namespace && !globalThisIsSafeAt(namespace)) return false;

  const rootIsGuaranteed = platformRootIsSupported && !file.mutations.isGlobalAuthorityLost(name);

  if (aliasOrigin?.qualified) {
    const originNamespace =
      platformGlobalNamespaceAccess(aliasOrigin.node, analysis.bindings) ??
      (directPlatformGlobalName(aliasOrigin.node, analysis.bindings) === "globalThis"
        ? aliasOrigin.node
        : null);
    if (!originNamespace || !globalThisIsSafeAt(originNamespace)) return false;
  } else if (
    aliasOrigin &&
    !rootIsGuaranteed &&
    !isAvailabilityGuarded(context, aliasOrigin.node, analysis, isConstructorAccess, {
      allowDirectAccessGuard: false,
      guardCacheKey: `unsupported-constructor:origin:${name}`,
      isCallInvalidation: isRootCallInvalidation,
      isPropertyExistenceTest: (property, object) =>
        property === name && resolvePlatformGlobalName(object, analysis.bindings) === "globalThis",
    })
  ) {
    return false;
  }

  const staticMethodNode = (candidate: unknown): ESTree.MemberExpression | null => {
    const value = resolveConstValue(candidate, analysis.bindings);
    return value?.type === "MemberExpression" &&
      staticPropertyName(value) === method &&
      resolvePlatformGlobalName(value.object, analysis.bindings) === name
      ? value
      : null;
  };
  const hasSafeQualifiedOrigin = (candidate: unknown): boolean =>
    isConstructorAccess(candidate) &&
    platformGlobalNamespaceAccess(candidate, analysis.bindings) !== null;
  const rootGuardOptions = {
    allowDirectAccessGuard: hasSafeQualifiedOrigin,
    guardCacheKey: `unsupported-global:root:${name}`,
    isCallInvalidation: isRootCallInvalidation,
    isPropertyExistenceTest: (property, object) =>
      property === name && resolvePlatformGlobalName(object, analysis.bindings) === "globalThis",
    isOptionalInvocation: (candidate) => {
      if (candidate.type !== "CallExpression" || !candidate.optional) return false;
      if (method === undefined) return hasSafeQualifiedOrigin(candidate.callee);
      const callee = staticMethodNode(candidate.callee);
      return Boolean(callee?.optional && platformGlobalNamespaceAccess(callee, analysis.bindings));
    },
  } satisfies AvailabilityGuardOptions;
  const rootIsProtected =
    rootIsGuaranteed ||
    isInvocationAvailabilityGuarded(
      context,
      invocation,
      analysis,
      isConstructorAccess,
      rootGuardOptions,
    );
  if (!method || !rootIsProtected) return rootIsProtected;

  const isStaticMethodAccess = (candidate: unknown): boolean => {
    const value = staticMethodNode(candidate);
    return Boolean(
      value &&
      (rootIsGuaranteed ||
        isAvailabilityGuarded(context, value, analysis, isConstructorAccess, rootGuardOptions)),
    );
  };
  const optionalMethodInvocationIsSafe = (candidate: ESTree.CallExpression): boolean => {
    const callee = resolveConstValue(candidate.callee, analysis.bindings);
    return Boolean(
      candidate.optional &&
      callee?.type === "MemberExpression" &&
      staticMethodNode(callee) &&
      (rootIsGuaranteed ||
        (callee.optional && platformGlobalNamespaceAccess(callee, analysis.bindings))),
    );
  };

  return isInvocationAvailabilityGuarded(context, invocation, analysis, isStaticMethodAccess, {
    allowDirectAccessGuard: isStaticMethodAccess,
    guardCacheKey: `unsupported-global:method:${name}:${method}`,
    isCallInvalidation: isMethodCallInvalidation,
    isPropertyExistenceTest: (property, object) =>
      property === method &&
      isConstructorAccess(object) &&
      (rootIsGuaranteed ||
        isAvailabilityGuarded(context, object, analysis, isConstructorAccess, rootGuardOptions)),
    isOptionalInvocation: (candidate) =>
      candidate.type === "CallExpression" && optionalMethodInvocationIsSafe(candidate),
  });
}
