import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
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
  isDefinitelyNonCallable,
  resolveConstValue,
  resolveDestructuredConstMember,
  staticPropertyName,
} from "../analysis/internal.js";
import { ruleDocsUrl, TYPED_ARRAY_CTORS } from "../constants.js";
import { isFeatureAllowed, shouldDiagnoseFeature } from "../engine/index.js";
import { isNode, unwrapExpression } from "../utils/ast.js";
import { beginRuleFile } from "./helpers.js";

const ALL = new Set<string>(TYPED_ARRAY_CTORS);
const BIGINT_ARRAYS = new Set(["BigInt64Array", "BigUint64Array"]);
const BIGINT_GETTERS = new Set(["getBigInt64", "getBigUint64"]);
const TYPED_ARRAY_FACTORIES = new Set(["from", "of"]);
const INVOCATION_HELPERS = new Set(["apply", "bind", "call"]);

function isPlatformStaticMember(
  node: unknown,
  owner: string,
  property: string,
  analysis: ReturnType<typeof beginRuleFile>["analysis"],
): boolean {
  const value = resolveConstValue(node, analysis.bindings);
  return Boolean(
    value?.type === "MemberExpression" &&
    staticPropertyName(value) === property &&
    resolvePlatformGlobalName(value.object, analysis.bindings) === owner,
  );
}

export const noTypedArrays = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow TypedArray and DataView features that the configured ServiceNow release and JavaScript mode do not support.",
      url: ruleDocsUrl("no-typed-arrays"),
    },
    messages: {
      ctor: "`{{name}}` is not supported in Compatibility or ES5 Standards mode. Use a plain Array or a string of bytes.",
      bigintCtor:
        "`{{name}}` is not supported by the configured ServiceNow release and JavaScript mode. Use a plain Array.",
      factory:
        "`{{name}}.{{method}}()` is not supported by the configured ServiceNow release and JavaScript mode. Use a plain Array.",
      bigintGetter:
        "`DataView.prototype.{{name}}()` is not supported by the ServiceNow JavaScript engine.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { context: script } = beginRuleFile(context);
        const es5 = shouldDiagnoseFeature(script, "typed-arrays");
        const bigint = shouldDiagnoseFeature(script, "bigint64-arrays");
        const bigintGetter = shouldDiagnoseFeature(script, "dataview-bigint-getters");
        if (!es5 && !bigint && !bigintGetter) return false;
      },
      NewExpression: check,
      CallExpression(node) {
        checkDataViewGetter(node);
        checkStaticFactory(node);
        check(node);
      },
    };

    function constructorOriginIsSafe(
      candidate: unknown,
      name: string,
      originCacheKey: string,
      analysis: ReturnType<typeof beginRuleFile>["analysis"],
      script: ReturnType<typeof beginRuleFile>["context"],
    ): boolean {
      const namespaceAccess = platformGlobalNamespaceAccess(candidate, analysis.bindings);
      const namespaceIsSafe =
        namespaceAccess === null ||
        isFeatureAllowed("global-this", script.javascriptMode, script.settings.release) ||
        isAvailabilityGuarded(
          context,
          namespaceAccess,
          analysis,
          (node) => directPlatformGlobalName(node, analysis.bindings) === "globalThis",
          {
            allowDirectAccessGuard: false,
            guardCacheKey: "global-this",
          },
        );
      const origin = resolveConstValue(candidate, analysis.bindings);
      const bareOriginIsSafe =
        origin?.type !== "Identifier" ||
        directPlatformGlobalName(origin, analysis.bindings) !== name ||
        isAvailabilityGuarded(
          context,
          origin,
          analysis,
          (node) => directPlatformGlobalName(node, analysis.bindings) === name,
          {
            allowDirectAccessGuard: false,
            guardCacheKey: originCacheKey,
          },
        );
      return namespaceIsSafe && bareOriginIsSafe;
    }

    function check(node: ESTree.NewExpression | ESTree.CallExpression) {
      const { analysis, context: script, file } = beginRuleFile(context);
      const name = resolvePlatformGlobalName(node.callee, analysis.bindings);
      if (!name || !ALL.has(name)) return;
      if (file.mutations.isGlobalWritten(name)) return;
      const originIsSafe = constructorOriginIsSafe(
        node.callee,
        name,
        `no-typed-arrays:origin:${name}`,
        analysis,
        script,
      );
      const isCtorGuardAccess = (candidate: unknown): boolean => {
        if (directPlatformGlobalName(candidate, analysis.bindings) === name) return true;
        const terminal = resolveConstValue(candidate, analysis.bindings);
        return Boolean(
          terminal?.type === "MemberExpression" &&
          resolvePlatformGlobalName(terminal, analysis.bindings) === name,
        );
      };
      const hasSafeQualifiedOrigin = (candidate: unknown): boolean => {
        return Boolean(
          resolvePlatformGlobalName(candidate, analysis.bindings) === name &&
          platformGlobalNamespaceAccess(candidate, analysis.bindings),
        );
      };
      if (
        originIsSafe &&
        isInvocationAvailabilityGuarded(context, node, analysis, isCtorGuardAccess, {
          allowDirectAccessGuard: hasSafeQualifiedOrigin,
          guardCacheKey: `no-typed-arrays:constructor:${name}`,
          isPropertyExistenceTest: (property, object) =>
            property === name &&
            resolvePlatformGlobalName(object, analysis.bindings) === "globalThis",
          isOptionalInvocation: (invocation) => {
            if (invocation.type !== "CallExpression" || !invocation.optional) return false;
            return hasSafeQualifiedOrigin(invocation.callee);
          },
        })
      ) {
        return;
      }
      if (BIGINT_ARRAYS.has(name) && shouldDiagnoseFeature(script, "bigint64-arrays")) {
        context.report({ node, messageId: "bigintCtor", data: { name } });
        return;
      }
      if (shouldDiagnoseFeature(script, "typed-arrays")) {
        context.report({ node, messageId: "ctor", data: { name } });
      }
    }

    function checkDataViewGetter(node: ESTree.CallExpression) {
      const { analysis, context: script, file } = beginRuleFile(context);
      if (!shouldDiagnoseFeature(script, "dataview-bigint-getters")) return;
      // ES5 already reports the proven DataView constructor. Avoid a second
      // diagnostic for a method on the same unsupported object.
      if (shouldDiagnoseFeature(script, "typed-arrays")) return;

      let callee = isPlatformStaticMember(node.callee, "Reflect", "apply", analysis)
        ? resolveConstValue(node.arguments[0], analysis.bindings)
        : resolveConstValue(node.callee, analysis.bindings);
      if (
        callee?.type === "MemberExpression" &&
        INVOCATION_HELPERS.has(staticPropertyName(callee) ?? "")
      ) {
        callee = resolveConstValue(callee.object, analysis.bindings);
      }

      const getterAccess = (candidate: unknown) => {
        const value = resolveConstValue(candidate, analysis.bindings);
        if (!value) return null;
        const selected = resolveDestructuredConstMember(value, analysis.bindings);
        if (selected) {
          if (
            !BIGINT_GETTERS.has(selected.property) ||
            (selected.fallback !== null &&
              !isDefinitelyNonCallable(selected.fallback, analysis.bindings))
          ) {
            return null;
          }
          const receiver = analysis.ofExpression(selected.source);
          if (receiver?.kind === "DataView" && !receiver.invalid && !receiver.escaped) {
            return {
              name: selected.property,
              object: selected.source,
              receiver,
            } as const;
          }
          const source = resolveConstValue(selected.source, analysis.bindings);
          if (
            source?.type === "MemberExpression" &&
            staticPropertyName(source) === "prototype" &&
            resolvePlatformGlobalName(source.object, analysis.bindings) === "DataView"
          ) {
            return { name: selected.property, object: source, receiver: null } as const;
          }
          return null;
        }
        if (value.type !== "MemberExpression") return null;
        const name = staticPropertyName(value);
        if (!name || !BIGINT_GETTERS.has(name)) return null;
        const receiver = analysis.ofExpression(value.object);
        if (receiver?.kind === "DataView" && !receiver.invalid && !receiver.escaped) {
          return { name, object: value.object, receiver } as const;
        }
        const object = resolveConstValue(value.object, analysis.bindings);
        if (
          object?.type === "MemberExpression" &&
          staticPropertyName(object) === "prototype" &&
          resolvePlatformGlobalName(object.object, analysis.bindings) === "DataView"
        ) {
          return { name, object, receiver: null } as const;
        }
        return null;
      };
      const access = getterAccess(callee);
      if (!access) return;
      const { name } = access;

      const isSameGetterAccess = (candidate: unknown): boolean => {
        const candidateAccess = getterAccess(candidate);
        if (!candidateAccess || candidateAccess.name !== name) return false;
        return (
          candidateAccess.receiver === null ||
          !file.mutations.isObjectPropertyWritten(candidateAccess.object, name)
        );
      };
      const isOptionalGetterInvocation = (
        invocation: ESTree.CallExpression | ESTree.NewExpression,
      ): boolean => {
        if (invocation.type !== "CallExpression") return false;
        if (invocation.optional && isSameGetterAccess(invocation.callee)) return true;
        const rawCallee = unwrapExpression(invocation.callee);
        if (
          !isNode(rawCallee) ||
          rawCallee.type !== "MemberExpression" ||
          !rawCallee.optional ||
          !INVOCATION_HELPERS.has(staticPropertyName(rawCallee) ?? "")
        ) {
          return false;
        }
        return isSameGetterAccess(rawCallee.object);
      };
      const isGetterOwner = (object: ESTree.Node): boolean => {
        const receiver = analysis.ofExpression(object);
        if (receiver?.kind === "DataView" && !receiver.invalid && !receiver.escaped) {
          return !file.mutations.isObjectPropertyWritten(object, name);
        }
        const value = resolveConstValue(object, analysis.bindings);
        return Boolean(
          value?.type === "MemberExpression" &&
          staticPropertyName(value) === "prototype" &&
          resolvePlatformGlobalName(value.object, analysis.bindings) === "DataView",
        );
      };
      if (
        isInvocationAvailabilityGuarded(context, node, analysis, isSameGetterAccess, {
          guardCacheKey: `no-typed-arrays:getter:${name}`,
          isPropertyExistenceTest: (property, object) => property === name && isGetterOwner(object),
          isOptionalInvocation: isOptionalGetterInvocation,
        })
      ) {
        return;
      }
      if (file.mutations.isGlobalWritten("DataView")) return;
      if (file.mutations.isGlobalPathWritten(["DataView", "prototype"])) return;
      if (
        file.mutations.isGlobalPathWritten(["DataView", "prototype", name]) ||
        (access.receiver !== null && file.mutations.isObjectPropertyWritten(access.object, name))
      ) {
        return;
      }
      context.report({ node, messageId: "bigintGetter", data: { name } });
    }

    function checkStaticFactory(node: ESTree.CallExpression) {
      const { analysis, context: script, file } = beginRuleFile(context);
      const callee = resolveConstValue(node.callee, analysis.bindings);
      if (callee?.type !== "MemberExpression") return;
      const method = staticPropertyName(callee);
      if (!method || !TYPED_ARRAY_FACTORIES.has(method)) return;
      const name = resolvePlatformGlobalName(callee.object, analysis.bindings);
      if (!name || name === "DataView" || !ALL.has(name)) return;
      const shouldReport = BIGINT_ARRAYS.has(name)
        ? shouldDiagnoseFeature(script, "bigint64-arrays")
        : shouldDiagnoseFeature(script, "typed-arrays");
      if (!shouldReport) return;
      if (
        file.mutations.isGlobalWritten(name) ||
        file.mutations.isGlobalPathWritten([name, method])
      ) {
        return;
      }

      const originIsSafe = constructorOriginIsSafe(
        callee.object,
        name,
        `no-typed-arrays:factory-origin:${name}`,
        analysis,
        script,
      );
      const isConstructorAccess = (candidate: unknown): boolean =>
        resolvePlatformGlobalName(candidate, analysis.bindings) === name;
      if (
        originIsSafe &&
        isInvocationAvailabilityGuarded(context, node, analysis, isConstructorAccess, {
          allowDirectAccessGuard: (candidate) =>
            platformGlobalNamespaceAccess(candidate, analysis.bindings) !== null,
          guardCacheKey: `no-typed-arrays:factory:${name}`,
          isPropertyExistenceTest: (property, object) =>
            property === name &&
            resolvePlatformGlobalName(object, analysis.bindings) === "globalThis",
        })
      ) {
        return;
      }
      context.report({ node, messageId: "factory", data: { name, method } });
    }
  },
});
