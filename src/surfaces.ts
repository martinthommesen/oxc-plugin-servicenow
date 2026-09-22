export const SURFACE_VALUES = [
  "client",
  "server",
  "acl",
  "business-rule",
  "script-include",
  "ui-action",
  "scheduled-script",
  "fix-script",
] as const;

/** Classic instance surfaces, including UI Actions whose execution side varies. */
export const CLASSIC_SURFACES = SURFACE_VALUES;

/** Surfaces that may execute server-side. UI Actions intentionally overlap client surfaces. */
export const SERVER_SURFACES = [
  "server",
  "acl",
  "business-rule",
  "script-include",
  "ui-action",
  "scheduled-script",
  "fix-script",
] as const;

export const CLIENT_SURFACES = ["client", "ui-action"] as const;

/** Surfaces that cannot execute in the browser. */
export const SERVER_ONLY_SURFACES = [
  "acl",
  "business-rule",
  "script-include",
  "server",
  "scheduled-script",
  "fix-script",
] as const;
