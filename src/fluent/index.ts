export {
  DEFAULT_FLUENT_MANIFEST,
  DEFAULT_FLUENT_MANIFEST_VERSION,
  FLUENT_CORE_MODULE,
  apisByName,
  entitiesRequiringId,
  importOwnedApis,
  knownDirectiveNames,
} from "./manifest.js";
export {
  CURRENT_FLUENT_SDK_VERSION,
  DEFAULT_FLUENT_SDK_VERSION,
  FLUENT_SDK_ARTIFACTS,
  LEGACY_FLUENT_SDK_VERSION,
  SDK_4_1_FLUENT_SDK_VERSION,
  SDK_4_8_FLUENT_SDK_VERSION,
  SDK_4_10_FLUENT_SDK_VERSION,
  SDK_4_10_1_FLUENT_SDK_VERSION,
  SUPPORTED_FLUENT_SDK_VERSIONS,
  fluentManifests,
  resolveFluentManifest,
  supportedFluentSdkVersionList,
} from "./registry.js";
export type { FluentSdkArtifactEvidence, SupportedFluentSdkVersion } from "./registry.js";
export type {
  FluentApiCapability,
  FluentApiKind,
  FluentDirectiveCapability,
  FluentEvidenceRecord,
  FluentIdRequirement,
  FluentSdkManifest,
} from "./manifest.js";
