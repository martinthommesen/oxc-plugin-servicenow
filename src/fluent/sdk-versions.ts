/**
 * The reviewed Fluent SDK version axis.
 *
 * This is the single home for "which @servicenow/sdk versions have been
 * reviewed". It sits below both the manifest registry and the declaration
 * index, so neither has to reach through the other for the version list.
 */

/** Reviewed default used when `fluentSdkVersion` is omitted. */
export const DEFAULT_FLUENT_SDK_VERSION = "4.11.0";
export const LEGACY_FLUENT_SDK_VERSION = "3.0.0";
export const SDK_4_1_FLUENT_SDK_VERSION = "4.1.0";
export const SDK_4_8_FLUENT_SDK_VERSION = "4.8.0";
export const SDK_4_10_FLUENT_SDK_VERSION = "4.10.0";
export const SDK_4_10_1_FLUENT_SDK_VERSION = "4.10.1";

export const SUPPORTED_FLUENT_SDK_VERSIONS = [
  "3.0.0",
  "3.0.1",
  "3.0.2",
  "3.0.3",
  "4.0.0",
  "4.0.1",
  "4.0.2",
  "4.1.0",
  "4.1.1",
  "4.2.0",
  "4.3.0",
  "4.4.0",
  "4.4.1",
  "4.5.0",
  "4.6.0",
  "4.6.1",
  "4.7.0",
  "4.7.1",
  "4.7.2",
  "4.8.0",
  "4.8.1",
  "4.9.0",
  "4.9.1",
  "4.9.2",
  "4.10.0",
  "4.10.1",
  "4.11.0",
] as const;

export type SupportedFluentSdkVersion = (typeof SUPPORTED_FLUENT_SDK_VERSIONS)[number];
