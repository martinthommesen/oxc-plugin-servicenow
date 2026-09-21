import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import {
  directPlatformGlobalName,
  isAvailabilityGuarded,
  isDefinitelyNonCallable,
  isInvocationAvailabilityGuarded,
  platformGlobalNamespaceAccess,
  resolveConstValue,
  resolveDestructuredConstMember,
  resolvePlatformGlobalName,
  staticPropertyName,
} from "../analysis/internal.js";
import { INVOCATION_HELPERS, ruleDocsUrl, TYPED_ARRAY_CTORS } from "../constants.js";
import { shouldDiagnoseFeature } from "../engine/index.js";
import { isNode, unwrapExpression } from "../utils/ast.js";
import { beginRuleFile, isPlatformStaticMember, platformNamespaceIsSafe } from "./helpers.js";

const ALL = new Set<string>(TYPED_ARRAY_CTORS);
const BIGINT_ARRAYS = new Set(["BigInt64Array", "BigUint64Array"]);
const BIGINT_GETTERS = new Set(["getBigInt64", "getBigUint64"]);
const TYPED_ARRAY_FACTORIES = new Set(["from", "of"]);

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
        "`{{name}}.{{method}}()` is not supported by the configured ServiceNow release and JavaScript mode. Use a plain Array or a guarded polyfill; static TypedArray factories require Australia ES2021.",
      bigintGetter:
        "`DataView.prototype.{{name}}()` is not supported by the ServiceNow JavaScript engine.",
    },
  },
  createOnce(context) {
    return {
      before() {
        const { script } = beginRuleFile(context);
        const es5 = shouldDiagnoseFeature(script, "typed-arrays");
        const factories = shouldDiagnoseFeature(script, "typed-array-factories");
        const bigint = shouldDiagnoseFeature(script, "bigint64-arrays");
        const bigintGetter = shouldDiagnoseFeature(script, "dataview-bigint-getters");
        if (!es5 && !factories && !bigint && !bigintGetter) return false;
        return undefined;
      },
      NewExpression: check,
      CallExpression(node) {
        checkDataViewGetter(node);
        checkStaticFactory(node);
        check(node);
      },
    };

    function constructorOriginIsSafe(callee: unknown, name: string): boolean {
      const file = beginRuleFile(context);
      const { provenance } = file;
      const namespaceAccess = platformGlobalNamespaceAccess(callee, provenance.bindings);
      const namespaceIsSafe =
        namespaceAccess === null || platformNamespaceIsSafe(context, namespaceAccess, file);
      const origin = resolveConstValue(callee, provenance.bindings);
      const bareOriginIsSafe =
        origin?.type !== "Identifier" ||
        directPlatformGlobalName(origin, provenance.bindings) !== name ||
        isAvailabilityGuarded(
          context,
          origin,
          provenance,
          (node) => directPlatformGlobalName(node, provenance.bindings) === name,
          {
            allowDirectAccessGuard: false,
          },
        );
      return namespaceIsSafe && bareOriginIsSafe;
    }

    function check(node: ESTree.NewExpression | ESTree.CallExpression) {
      const file = beginRuleFile(context);
      const { provenance } = file;
      const name = resolvePlatformGlobalName(node.callee, provenance.bindings);
      if (!name || !ALL.has(name)) return;
      if (file.mutations.isGlobalWritten(name)) return;
      const isCtorGuardAccess = (candidate: unknown): boolean => {
        if (directPlatformGlobalName(candidate, provenance.bindings) === name) return true;
        const terminal = resolveConstValue(candidate, provenance.bindings);
        return Boolean(
          terminal?.type === "MemberExpression" &&
          resolvePlatformGlobalName(terminal, provenance.bindings) === name,
        );
      };
      const hasSafeQualifiedOrigin = (candidate: unknown): boolean => {
        return Boolean(
          resolvePlatformGlobalName(candidate, provenance.bindings) === name &&
          platformGlobalNamespaceAccess(candidate, provenance.bindings),
        );
      };
      if (
        constructorOriginIsSafe(node.callee, name) &&
        isInvocationAvailabilityGuarded(context, node, provenance, isCtorGuardAccess, {
          allowDirectAccessGuard: hasSafeQualifiedOrigin,
          isPropertyExistenceTest: (property, object) =>
            property === name &&
            resolvePlatformGlobalName(object, provenance.bindings) === "globalThis",
          isOptionalInvocation: (invocation) => {
            if (invocation.type !== "CallExpression" || !invocation.optional) return false;
            return hasSafeQualifiedOrigin(invocation.callee);
          },
        })
      ) {
        return;
      }
      if (BIGINT_ARRAYS.has(name) && shouldDiagnoseFeature(file.script, "bigint64-arrays")) {
        context.report({ node, messageId: "bigintCtor", data: { name } });
        return;
      }
      if (shouldDiagnoseFeature(file.script, "typed-arrays")) {
        context.report({ node, messageId: "ctor", data: { name } });
      }
    }

    function checkDataViewGetter(node: ESTree.CallExpression) {
      const file = beginRuleFile(context);
      const { provenance } = file;
      if (!shouldDiagnoseFeature(file.script, "dataview-bigint-getters")) return;
      // ES5 already reports the proven DataView constructor. Avoid a second
      // diagnostic for a method on the same unsupported object.
      if (shouldDiagnoseFeature(file.script, "typed-arrays")) return;

      let callee = isPlatformStaticMember(node.callee, "Reflect", "apply", provenance)
        ? resolveConstValue(node.arguments[0], provenance.bindings)
        : resolveConstValue(node.callee, provenance.bindings);
      if (
        callee?.type === "MemberExpression" &&
        INVOCATION_HELPERS.has(staticPropertyName(callee) ?? "")
      ) {
        callee = resolveConstValue(callee.object, provenance.bindings);
      }

      const classifyDataViewGetter = (target: unknown, getterName: string) => {
        const receiver = provenance.trustedExpression(target);
        if (receiver?.kind === "DataView") {
          return { name: getterName, object: target, receiver } as const;
        }
        const resolved = resolveConstValue(target, provenance.bindings);
        if (
          resolved?.type === "MemberExpression" &&
          staticPropertyName(resolved) === "prototype" &&
          resolvePlatformGlobalName(resolved.object, provenance.bindings) === "DataView"
        ) {
          return { name: getterName, object: resolved, receiver: null } as const;
        }
        return null;
      };
      const getterAccess = (candidate: unknown) => {
        const value = resolveConstValue(candidate, provenance.bindings);
        if (!value) return null;
        const selected = resolveDestructuredConstMember(value, provenance.bindings);
        if (selected) {
          if (
            !BIGINT_GETTERS.has(selected.property) ||
            (selected.fallback !== null &&
              !isDefinitelyNonCallable(selected.fallback, provenance.bindings))
          ) {
            return null;
          }
          return classifyDataViewGetter(selected.source, selected.property);
        }
        if (value.type !== "MemberExpression") return null;
        const name = staticPropertyName(value);
        if (!name || !BIGINT_GETTERS.has(name)) return null;
        return classifyDataViewGetter(value.object, name);
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
        const target = classifyDataViewGetter(object, name);
        if (!target) return false;
        if (target.receiver === null) return true;
        return !file.mutations.isObjectPropertyWritten(object, name);
      };
      if (
        isInvocationAvailabilityGuarded(context, node, provenance, isSameGetterAccess, {
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
      const file = beginRuleFile(context);
      const { provenance } = file;
      const callee = resolveConstValue(node.callee, provenance.bindings);
      if (callee?.type !== "MemberExpression") return;
      const method = staticPropertyName(callee);
      if (!method || !TYPED_ARRAY_FACTORIES.has(method)) return;
      const name = resolvePlatformGlobalName(callee.object, provenance.bindings);
      if (!name || name === "DataView" || !ALL.has(name)) return;
      const factoryUnavailable = shouldDiagnoseFeature(file.script, "typed-array-factories");
      const constructorUnavailable = shouldDiagnoseFeature(
        file.script,
        BIGINT_ARRAYS.has(name) ? "bigint64-arrays" : "typed-arrays",
      );
      if (!factoryUnavailable && !constructorUnavailable) return;
      if (
        file.mutations.isGlobalWritten(name) ||
        file.mutations.isGlobalPathWritten([name, method])
      ) {
        return;
      }

      const isConstructorAccess = (candidate: unknown): boolean =>
        resolvePlatformGlobalName(candidate, provenance.bindings) === name;
      const isFactoryAccess = (candidate: unknown): boolean =>
        isPlatformStaticMember(candidate, name, method, provenance);
      const factoryMethodIsProtected = (): boolean =>
        isInvocationAvailabilityGuarded(context, node, provenance, isFactoryAccess, {
          allowDirectAccessGuard: isFactoryAccess,
          isPropertyExistenceTest: (property, object) =>
            property === method && resolvePlatformGlobalName(object, provenance.bindings) === name,
          isOptionalInvocation: (invocation) =>
            invocation.type === "CallExpression" &&
            invocation.optional === true &&
            isFactoryAccess(invocation.callee),
        });
      if (factoryUnavailable && !constructorUnavailable && factoryMethodIsProtected()) {
        return;
      }
      if (
        constructorUnavailable &&
        constructorOriginIsSafe(callee.object, name) &&
        isInvocationAvailabilityGuarded(context, node, provenance, isConstructorAccess, {
          allowDirectAccessGuard: (candidate) =>
            platformGlobalNamespaceAccess(candidate, provenance.bindings) !== null,
          isPropertyExistenceTest: (property, object) =>
            property === name &&
            resolvePlatformGlobalName(object, provenance.bindings) === "globalThis",
        })
      ) {
        return;
      }
      context.report({ node, messageId: "factory", data: { name, method } });
    }
  },
});
