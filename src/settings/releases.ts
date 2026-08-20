/**
 * ServiceNow documentation releases for which this plugin has reviewed
 * capability metadata. Keep this list deliberately finite: accepting an
 * arbitrary string would make a typo silently select the current knowledge.
 */
export const SUPPORTED_SERVICENOW_RELEASES = ["zurich"] as const;

export type ServiceNowRelease = (typeof SUPPORTED_SERVICENOW_RELEASES)[number];

export function isSupportedServiceNowRelease(value: string): value is ServiceNowRelease {
  return (SUPPORTED_SERVICENOW_RELEASES as readonly string[]).includes(value);
}
