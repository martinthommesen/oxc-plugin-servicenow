export {
  ENGINE_FEATURES,
  ENGINE_FEATURE_EVIDENCE,
  ENGINE_FEATURE_RELEASES,
  featureSupport,
  isFeatureAllowed,
  shouldDiagnoseFeature,
} from "./features.js";
export type {
  EngineFeature,
  EngineFeatureId,
  EngineFeatureRelease,
  EngineReleaseEvidenceSnapshot,
  FeatureSupport,
} from "./features.js";
export { AUSTRALIA_ENGINE_UPDATES, AUSTRALIA_ENGINE_UPDATE_EVIDENCE } from "./australia-updates.js";
export type {
  AustraliaEngineUpdate,
  AustraliaEngineUpdateDisposition,
  AustraliaEngineUpdateMode,
  AustraliaEngineUpdateType,
} from "./australia-updates.js";
