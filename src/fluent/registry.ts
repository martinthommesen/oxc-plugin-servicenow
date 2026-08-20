import { ServiceNowSettingsError } from "../settings/errors.js";
import { DEFAULT_FLUENT_MANIFEST, type FluentApiCapability, type FluentSdkManifest } from "./manifest.js";

export const CURRENT_FLUENT_SDK_VERSION = "4.1.0";
export const LEGACY_FLUENT_SDK_VERSION = "3.0.0";

export const SUPPORTED_FLUENT_SDK_VERSIONS = [LEGACY_FLUENT_SDK_VERSION, CURRENT_FLUENT_SDK_VERSION] as const;

export type SupportedFluentSdkVersion = (typeof SUPPORTED_FLUENT_SDK_VERSIONS)[number];

function withSdkVersion(manifest: FluentSdkManifest, sdkVersion: string): FluentSdkManifest {
  return { ...manifest, sdkVersion };
}

function olderSdkManifest(): FluentSdkManifest {
  const apis: FluentApiCapability[] = DEFAULT_FLUENT_MANIFEST.apis
    .filter((api) => api.name !== "CatalogItemRecordProducer")
    .map((api) => (api.name === "Table" ? { ...api, idRequirement: "required" } : api));
  return {
    ...DEFAULT_FLUENT_MANIFEST,
    version: "sdk-3.0.0",
    sdkVersion: LEGACY_FLUENT_SDK_VERSION,
    apis,
  };
}

const CURRENT_MANIFEST = withSdkVersion(DEFAULT_FLUENT_MANIFEST, CURRENT_FLUENT_SDK_VERSION);
const LEGACY_MANIFEST = olderSdkManifest();

const REGISTRY: Record<string, FluentSdkManifest> = {
  [CURRENT_FLUENT_SDK_VERSION]: CURRENT_MANIFEST,
  [LEGACY_FLUENT_SDK_VERSION]: LEGACY_MANIFEST,
};

export function supportedFluentSdkVersionList(): string {
  return SUPPORTED_FLUENT_SDK_VERSIONS.join(", ");
}

/**
 * Select a Fluent SDK manifest.
 *
 * An omitted version uses the current documented SDK (`4.1.0`).
 * An unsupported version throws a configuration error.
 */
export function resolveFluentManifest(version: string | undefined): FluentSdkManifest {
  if (version === undefined) return CURRENT_MANIFEST;
  const selected = REGISTRY[version];
  if (!selected) {
    throw new ServiceNowSettingsError(
      ".fluentSdkVersion",
      `unsupported Fluent SDK version ${JSON.stringify(version)}. Supported: ${supportedFluentSdkVersionList()}`,
    );
  }
  return selected;
}

export function fluentManifests(): readonly FluentSdkManifest[] {
  return SUPPORTED_FLUENT_SDK_VERSIONS.map((version) => REGISTRY[version]!);
}
