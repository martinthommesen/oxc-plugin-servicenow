import type { ValidatedSettingsResult } from "../../src/settings/validate.js";
import type { ValidatedServiceNowSettings } from "../../src/types.js";

declare const result: ValidatedSettingsResult;
declare const settings: ValidatedServiceNowSettings;

// @ts-expect-error Validated settings are immutable at every level.
result.settings.allowedSysIds.push("97c04b3b1b12100043ab85e5bd0713e2");
// @ts-expect-error The result collection is readonly.
result.deprecations.push({ path: "x", message: "x" });
// @ts-expect-error Top-level settings cannot be reassigned.
settings.scope = "global";
