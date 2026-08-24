import { defineRule } from "@oxlint/plugins";
import type { Context, ESTree } from "@oxlint/plugins";
import {
  isAvailabilityGuarded,
  isInvocationAvailabilityGuarded,
} from "../analysis/availability.js";
import {
  directPlatformGlobalName,
  platformGlobalNamespaceAccess,
  resolvePlatformGlobalName,
} from "../analysis/globals.js";
import {
  builtInCallMayWritePlatformProperty,
  findStablePlatformConstructorCalls,
  type PlatformGlobalAliasOrigin,
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
            if (isAvailabilityProtected(context, finding.node, finding.name, finding.aliasOrigin)) {
              continue;
            }
            context.report({ node: finding.node, messageId: "weak", data: { name: finding.name } });
          }
        },
      };
    },
  });
}

function isAvailabilityProtected(
  context: Context,
  invocation: ESTree.CallExpression | ESTree.NewExpression,
  name: string,
  aliasOrigin: PlatformGlobalAliasOrigin | null,
): boolean {
  const { analysis, context: script, file } = beginRuleFile(context);
  const isConstructorAccess = (candidate: unknown): boolean =>
    resolvePlatformGlobalName(candidate, analysis.bindings) === name;
  const isCallInvalidation = (call: ESTree.CallExpression): boolean =>
    builtInCallMayWritePlatformProperty(
      call,
      "globalThis",
      name,
      script.javascriptMode,
      analysis,
      file,
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

  if (aliasOrigin?.qualified) {
    const originNamespace =
      platformGlobalNamespaceAccess(aliasOrigin.node, analysis.bindings) ??
      (directPlatformGlobalName(aliasOrigin.node, analysis.bindings) === "globalThis"
        ? aliasOrigin.node
        : null);
    if (!originNamespace || !globalThisIsSafeAt(originNamespace)) return false;
  } else if (
    aliasOrigin &&
    !isAvailabilityGuarded(context, aliasOrigin.node, analysis, isConstructorAccess, {
      allowDirectAccessGuard: false,
      guardCacheKey: `unsupported-constructor:origin:${name}`,
      isCallInvalidation,
      isPropertyExistenceTest: (property, object) =>
        property === name && resolvePlatformGlobalName(object, analysis.bindings) === "globalThis",
    })
  ) {
    return false;
  }

  const hasSafeQualifiedOrigin = (candidate: unknown): boolean =>
    isConstructorAccess(candidate) &&
    platformGlobalNamespaceAccess(candidate, analysis.bindings) !== null;

  return isInvocationAvailabilityGuarded(context, invocation, analysis, isConstructorAccess, {
    allowDirectAccessGuard: hasSafeQualifiedOrigin,
    guardCacheKey: `unsupported-constructor:${name}`,
    isCallInvalidation,
    isPropertyExistenceTest: (property, object) =>
      property === name && resolvePlatformGlobalName(object, analysis.bindings) === "globalThis",
    isOptionalInvocation: (candidate) =>
      candidate.type === "CallExpression" &&
      Boolean(candidate.optional) &&
      hasSafeQualifiedOrigin(candidate.callee),
  });
}
