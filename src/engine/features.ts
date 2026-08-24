import type { ServiceNowRelease } from "../settings/releases.js";
import { SUPPORTED_SERVICENOW_RELEASES } from "../settings/releases.js";
import type { JavaScriptMode, ServiceNowScriptContext } from "../types.js";
import {
  appliesToInstanceScripts,
  isFluentContext,
  isMixedUiActionContext,
  isServerInstanceContext,
} from "../context/index.js";

/**
 * ServiceNow JavaScript engine capabilities, keyed by the documentation
 * release whose support table establishes each value.
 *
 * The official feature tables publish ES2021 and ES5 Standards columns, not a
 * Compatibility column. The plugin deliberately applies each ES5 cell to
 * Compatibility mode as package policy and records that basis separately.
 */
export type FeatureSupport = "supported" | "unsupported" | "disallowed";

export type EngineFeatureId =
  | "promise"
  | "async-await"
  | "bigint"
  | "at-method"
  | "typed-arrays"
  | "bigint64-arrays"
  | "dataview-bigint-getters"
  | "object-hasown"
  | "global-this"
  | "function-tostring-method-source"
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

type InstanceJavaScriptMode = Exclude<JavaScriptMode, "unknown">;

export interface EngineFeatureRelease {
  readonly evidence: string;
  readonly support: Readonly<Record<InstanceJavaScriptMode, FeatureSupport>>;
  readonly supportBasis: Readonly<
    Record<InstanceJavaScriptMode, "official-table" | "es5-compatibility-policy">
  >;
}

export interface EngineFeature {
  readonly id: EngineFeatureId;
  readonly title: string;
  readonly releases: Readonly<Record<ServiceNowRelease, EngineFeatureRelease>>;
}

const ZURICH =
  "https://www.servicenow.com/docs/r/zurich/api-reference/scripts/javascript-engine-feature-support.html";
const AUSTRALIA =
  "https://www.servicenow.com/docs/r/api-reference/scripts/javascript-engine-feature-support.html";

export interface EngineReleaseEvidenceSnapshot {
  readonly url: string;
  readonly officialReleaseLabel: string;
  readonly officialUpdatedAt: string | null;
  readonly reviewedAt: string;
}

export const ENGINE_FEATURE_EVIDENCE: Readonly<
  Record<ServiceNowRelease, EngineReleaseEvidenceSnapshot>
> = Object.freeze({
  zurich: Object.freeze({
    url: ZURICH,
    officialReleaseLabel: "Zurich",
    officialUpdatedAt: null,
    reviewedAt: "2026-08-22",
  }),
  australia: Object.freeze({
    url: AUSTRALIA,
    officialReleaseLabel: "Australia",
    officialUpdatedAt: "2026-03-12",
    reviewedAt: "2026-08-22",
  }),
});

export const ENGINE_FEATURE_RELEASES: Readonly<Record<ServiceNowRelease, string>> = Object.freeze({
  zurich: ENGINE_FEATURE_EVIDENCE.zurich.url,
  australia: ENGINE_FEATURE_EVIDENCE.australia.url,
});

function releaseFeature(
  evidence: string,
  es2021: FeatureSupport,
  es5: FeatureSupport,
): EngineFeatureRelease {
  return Object.freeze({
    evidence,
    support: Object.freeze({ compatibility: es5, es5, es2021 }),
    supportBasis: Object.freeze({
      compatibility: "es5-compatibility-policy",
      es5: "official-table",
      es2021: "official-table",
    }),
  });
}

function feature(
  id: EngineFeatureId,
  title: string,
  input: {
    readonly zurich: readonly [es2021: FeatureSupport, es5: FeatureSupport];
    readonly australia: readonly [es2021: FeatureSupport, es5: FeatureSupport];
  },
): EngineFeature {
  return Object.freeze({
    id,
    title,
    releases: Object.freeze({
      zurich: releaseFeature(ZURICH, ...input.zurich),
      australia: releaseFeature(AUSTRALIA, ...input.australia),
    }),
  });
}

function unchanged(
  id: EngineFeatureId,
  title: string,
  es2021: FeatureSupport,
  es5: FeatureSupport,
): EngineFeature {
  return feature(id, title, {
    zurich: [es2021, es5],
    australia: [es2021, es5],
  });
}

export const ENGINE_FEATURES: Readonly<Record<EngineFeatureId, EngineFeature>> = Object.freeze({
  promise: unchanged("promise", "Promise", "supported", "disallowed"),
  "async-await": unchanged("async-await", "async/await", "supported", "disallowed"),
  bigint: unchanged("bigint", "BigInt", "supported", "unsupported"),
  "at-method": unchanged("at-method", "Array/String.prototype.at", "supported", "unsupported"),
  "typed-arrays": unchanged("typed-arrays", "TypedArray constructors", "supported", "disallowed"),
  "bigint64-arrays": feature("bigint64-arrays", "BigInt64Array / BigUint64Array", {
    zurich: ["unsupported", "unsupported"],
    australia: ["supported", "unsupported"],
  }),
  "dataview-bigint-getters": unchanged(
    "dataview-bigint-getters",
    "DataView BigInt getter methods",
    "unsupported",
    "unsupported",
  ),
  "object-hasown": feature("object-hasown", "Object.hasOwn", {
    zurich: ["unsupported", "unsupported"],
    australia: ["supported", "unsupported"],
  }),
  "global-this": unchanged("global-this", "globalThis", "supported", "disallowed"),
  "function-tostring-method-source": feature(
    "function-tostring-method-source",
    "Function.prototype.toString source text for methods and computed property names",
    {
      zurich: ["disallowed", "disallowed"],
      australia: ["supported", "disallowed"],
    },
  ),
  proxy: unchanged("proxy", "Proxy", "supported", "disallowed"),
  "optional-chaining": unchanged(
    "optional-chaining",
    "optional chaining",
    "supported",
    "unsupported",
  ),
  "nullish-coalescing": unchanged(
    "nullish-coalescing",
    "nullish coalescing",
    "supported",
    "unsupported",
  ),
  "logical-assignment": unchanged(
    "logical-assignment",
    "logical assignment",
    "supported",
    "unsupported",
  ),
  "private-instance-members": unchanged(
    "private-instance-members",
    "private instance class members",
    "unsupported",
    "unsupported",
  ),
  "private-static-members": unchanged(
    "private-static-members",
    "private static class members",
    "supported",
    "unsupported",
  ),
  lookbehind: unchanged("lookbehind", "RegExp lookbehind", "supported", "unsupported"),
  "weak-map": unchanged("weak-map", "WeakMap", "supported", "disallowed"),
  "weak-set": unchanged("weak-set", "WeakSet", "supported", "disallowed"),
  "weak-ref": unchanged("weak-ref", "WeakRef", "disallowed", "disallowed"),
  "finalization-registry": unchanged(
    "finalization-registry",
    "FinalizationRegistry",
    "disallowed",
    "disallowed",
  ),
  "async-iterators": unchanged("async-iterators", "async iteration", "disallowed", "disallowed"),
});

function admissibleReleases(release: ServiceNowRelease | undefined): readonly ServiceNowRelease[] {
  return release === undefined ? SUPPORTED_SERVICENOW_RELEASES : [release];
}

/**
 * Resolve one capability. An omitted release returns a value only when every
 * supported release agrees; release-dependent facts remain unknown.
 */
export function featureSupport(
  id: EngineFeatureId,
  mode: JavaScriptMode,
  release?: ServiceNowRelease,
): FeatureSupport | "unknown" {
  if (mode === "unknown") return "unknown";
  const values = admissibleReleases(release).map(
    (candidate) => ENGINE_FEATURES[id].releases[candidate].support[mode],
  );
  const first = values[0];
  return first !== undefined && values.every((value) => value === first) ? first : "unknown";
}

export function isFeatureAllowed(
  id: EngineFeatureId,
  mode: JavaScriptMode,
  release?: ServiceNowRelease,
): boolean {
  return featureSupport(id, mode, release) === "supported";
}

/**
 * Whether a mode-specific engine rule should run for this file. A diagnostic
 * is emitted only when every admissible release documents the feature as
 * unavailable. Fluent metadata is never instance-executed.
 */
export function shouldDiagnoseFeature(ctx: ServiceNowScriptContext, id: EngineFeatureId): boolean {
  if (isFluentContext(ctx)) return false;
  // ServiceNow's instance JavaScript-mode table is a server-runtime contract.
  // Client scripts execute in the browser; a known client-only or otherwise
  // non-server surface must not inherit server engine restrictions.
  if (isMixedUiActionContext(ctx)) return false;
  if (ctx.surfaces.size > 0 && !isServerInstanceContext(ctx)) return false;
  const releases = admissibleReleases(ctx.settings.release);
  const spec = ENGINE_FEATURES[id];
  const allModesUnavailable = releases.every((release) =>
    (["compatibility", "es5", "es2021"] as const).every(
      (mode) => spec.releases[release].support[mode] !== "supported",
    ),
  );
  if (allModesUnavailable) {
    return (
      appliesToInstanceScripts(ctx) ||
      (ctx.javascriptMode !== "unknown" && ctx.sources.javascriptMode === "explicit")
    );
  }
  if (ctx.javascriptMode === "unknown") return false;
  const mode = ctx.javascriptMode;
  return releases.every((release) => spec.releases[release].support[mode] !== "supported");
}
