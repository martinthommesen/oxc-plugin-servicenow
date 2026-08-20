import type { JavaScriptMode, ServiceNowScriptContext } from "../types.js";
import { appliesInJavaScriptModes, appliesToInstanceScripts, isFluentContext } from "../context/index.js";

/**
 * ServiceNow JavaScript engine capabilities.
 *
 * Values follow the Zurich feature-support tables:
 * https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html
 *
 * Compatibility mode is treated as ES5 Standards unless a table documents a
 * stricter Compatibility-only difference.
 */
export type FeatureSupport = "supported" | "unsupported" | "disallowed";

export type EngineFeatureId =
  | "promise"
  | "async-await"
  | "bigint"
  | "at-method"
  | "typed-arrays"
  | "bigint64-arrays"
  | "proxy"
  | "optional-chaining"
  | "nullish-coalescing"
  | "logical-assignment"
  | "private-instance-members"
  | "private-static-members"
  | "lookbehind"
  | "weak-map"
  | "weak-set"
  | "weak-ref"
  | "finalization-registry"
  | "async-iterators";

export interface EngineFeature {
  id: EngineFeatureId;
  title: string;
  evidence: string;
  /** Features disallowed or unsupported in every instance mode. */
  unsupportedInAllInstanceModes: boolean;
  support: Record<"compatibility" | "es5" | "es2021", FeatureSupport>;
}

const ZURICH =
  "https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html";

function feature(
  id: EngineFeatureId,
  title: string,
  es2021: FeatureSupport,
  es5: FeatureSupport,
  extra: { unsupportedInAllInstanceModes?: boolean } = {},
): EngineFeature {
  return {
    id,
    title,
    evidence: ZURICH,
    unsupportedInAllInstanceModes: extra.unsupportedInAllInstanceModes === true,
    support: {
      compatibility: es5,
      es5,
      es2021,
    },
  };
}

export const ENGINE_FEATURES: Record<EngineFeatureId, EngineFeature> = {
  promise: feature("promise", "Promise", "supported", "disallowed"),
  "async-await": feature("async-await", "async/await", "supported", "disallowed"),
  bigint: feature("bigint", "BigInt", "supported", "unsupported"),
  "at-method": feature("at-method", "Array/String.prototype.at", "supported", "unsupported"),
  "typed-arrays": feature("typed-arrays", "TypedArray constructors", "supported", "disallowed"),
  "bigint64-arrays": feature("bigint64-arrays", "BigInt64Array / BigUint64Array", "unsupported", "unsupported", {
    unsupportedInAllInstanceModes: true,
  }),
  proxy: feature("proxy", "Proxy", "supported", "disallowed"),
  "optional-chaining": feature("optional-chaining", "optional chaining", "supported", "unsupported"),
  "nullish-coalescing": feature("nullish-coalescing", "nullish coalescing", "supported", "unsupported"),
  "logical-assignment": feature("logical-assignment", "logical assignment", "supported", "unsupported"),
  "private-instance-members": feature(
    "private-instance-members",
    "private instance class members",
    "supported",
    "unsupported",
  ),
  "private-static-members": feature(
    "private-static-members",
    "private static class members",
    "supported",
    "unsupported",
  ),
  lookbehind: feature("lookbehind", "RegExp lookbehind", "supported", "unsupported"),
  "weak-map": feature("weak-map", "WeakMap", "supported", "disallowed"),
  "weak-set": feature("weak-set", "WeakSet", "supported", "disallowed"),
  "weak-ref": feature("weak-ref", "WeakRef", "disallowed", "disallowed", {
    unsupportedInAllInstanceModes: true,
  }),
  "finalization-registry": feature("finalization-registry", "FinalizationRegistry", "disallowed", "disallowed", {
    unsupportedInAllInstanceModes: true,
  }),
  "async-iterators": feature("async-iterators", "async iteration", "disallowed", "disallowed", {
    unsupportedInAllInstanceModes: true,
  }),
};

export const ENGINE_FEATURE_RELEASE = "zurich";

export function featureSupport(id: EngineFeatureId, mode: JavaScriptMode): FeatureSupport | "unknown" {
  if (mode === "unknown") return "unknown";
  return ENGINE_FEATURES[id].support[mode];
}

export function isFeatureAllowed(id: EngineFeatureId, mode: JavaScriptMode): boolean {
  return featureSupport(id, mode) === "supported";
}

/**
 * Whether a mode-specific engine rule should run for this file.
 * Unknown mode never assumes ES5. Fluent metadata is never instance-executed.
 */
export function shouldDiagnoseFeature(ctx: ServiceNowScriptContext, id: EngineFeatureId): boolean {
  if (isFluentContext(ctx)) return false;
  const spec = ENGINE_FEATURES[id];
  if (spec.unsupportedInAllInstanceModes) return appliesToInstanceScripts(ctx);
  const restricted: Array<"compatibility" | "es5" | "es2021"> = [];
  for (const mode of ["compatibility", "es5", "es2021"] as const) {
    if (spec.support[mode] !== "supported") restricted.push(mode);
  }
  return appliesInJavaScriptModes(ctx, restricted);
}
