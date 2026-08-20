import { ServiceNowSettingsError } from "../settings/errors.js";
import { DEFAULT_FLUENT_MANIFEST, type FluentApiCapability, type FluentSdkManifest } from "./manifest.js";

/** Current @servicenow/sdk release observed from the public npm registry. */
export const CURRENT_FLUENT_SDK_VERSION = "4.11.0";
export const LEGACY_FLUENT_SDK_VERSION = "3.0.0";
export const SDK_4_1_FLUENT_SDK_VERSION = "4.1.0";
export const SDK_4_8_FLUENT_SDK_VERSION = "4.8.0";
export const SDK_4_10_FLUENT_SDK_VERSION = "4.10.0";

export const SUPPORTED_FLUENT_SDK_VERSIONS = [
  LEGACY_FLUENT_SDK_VERSION,
  SDK_4_1_FLUENT_SDK_VERSION,
  SDK_4_8_FLUENT_SDK_VERSION,
  SDK_4_10_FLUENT_SDK_VERSION,
  CURRENT_FLUENT_SDK_VERSION,
] as const;

export type SupportedFluentSdkVersion = (typeof SUPPORTED_FLUENT_SDK_VERSIONS)[number];

function versionTuple(version: string): [number, number, number] {
  const [major = "0", minor = "0", patch = "0"] = version.split(".");
  return [Number(major), Number(minor), Number(patch)];
}

function atLeast(version: string, minimum: string): boolean {
  const left = versionTuple(version);
  const right = versionTuple(minimum);
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return left[i]! > right[i]!;
  }
  return true;
}

/**
 * Introduction boundaries verified from the versioned @servicenow/sdk-core
 * package exports. Keeping this table explicit prevents a modern capability
 * from silently leaking into synthesized historical manifests.
 */
const INTRODUCED: Readonly<Record<string, string>> = {
  AliasTemplate: "4.8.0",
  CatalogItemRecordProducer: "4.8.0",
  SPMenu: "4.8.0",
  ScheduledScript: "4.8.0",
  UiAction: "4.8.0",
  UiPage: "4.8.0",
  StateModel: "4.10.0",
};

function withSdkVersion(manifest: FluentSdkManifest, sdkVersion: string): FluentSdkManifest {
  return { ...manifest, version: `sdk-${sdkVersion}`, sdkVersion };
}

function manifestForVersion(sdkVersion: string): FluentSdkManifest {
  const apis: FluentApiCapability[] = DEFAULT_FLUENT_MANIFEST.apis
    .filter((api) => {
      const introduced = api.introduced ?? INTRODUCED[api.name];
      return !introduced || atLeast(sdkVersion, introduced);
    })
    .map((api) => {
      if (api.name === "List" && !atLeast(sdkVersion, "4.1.0")) {
        return { ...api, idRequirement: "required" as const, deprecated: undefined };
      }
      return { ...api };
    });
  return withSdkVersion({ ...DEFAULT_FLUENT_MANIFEST, apis }, sdkVersion);
}

const REGISTRY: Record<string, FluentSdkManifest> = Object.fromEntries(
  SUPPORTED_FLUENT_SDK_VERSIONS.map((version) => [version, manifestForVersion(version)]),
);

export function supportedFluentSdkVersionList(): string {
  return SUPPORTED_FLUENT_SDK_VERSIONS.join(", ");
}

/**
 * Select a Fluent SDK manifest. An omitted version uses the current public
 * @servicenow/sdk release; unsupported versions fail closed rather than
 * borrowing a nearby manifest.
 */
export function resolveFluentManifest(version: string | undefined): FluentSdkManifest {
  if (version === undefined) return REGISTRY[CURRENT_FLUENT_SDK_VERSION]!;
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
