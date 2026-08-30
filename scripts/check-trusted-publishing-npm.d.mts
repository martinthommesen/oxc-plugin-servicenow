export const TRUSTED_PUBLISHING_NPM_MINIMUM: string;
export const TRUSTED_PUBLISHING_NPM_BELOW: string;
/** @deprecated Use TRUSTED_PUBLISHING_NPM_MINIMUM. */
export const TRUSTED_PUBLISHING_NPM_VERSION: string;
export function parseNpmVersion(raw: string): string;
export function assertTrustedPublishingNpm(
  actual: string,
  minimum?: string,
  below?: string,
): string;
export function main(argv?: string[]): Record<string, unknown>;
export function readExecutableNpmVersion(command?: string): string;
