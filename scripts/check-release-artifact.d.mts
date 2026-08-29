export const REQUIRED_TARBALL_PATHS: string[];
export const FORBIDDEN_TARBALL_PREFIXES: string[];
export function isReleaseVersion(value: unknown): boolean;
export function changelogVersionHeadingPattern(version: string): RegExp;
export function changelogHasVersionHeading(text: string, version: string): boolean;
export function inspectTarballListing(files: readonly string[]): string[];
export function inspectTarballEntryTypes(verboseLines: readonly string[]): string[];
export function inspectNpmPackRecord(
  record: Record<string, unknown>,
  tarballFiles: readonly string[],
): string[];
export function collectPackageFileTargets(
  pkg: Record<string, unknown>,
): Array<{ path: string; target: string }>;
export function packageTargetPath(target: unknown): string | undefined;
export function inspectPackageExports(
  pkg: Record<string, unknown>,
  files: readonly string[],
): string[];
export function sha256File(filePath: string): string;
export function tarballIntegrity(buffer: Uint8Array): string;
export function normalizeNpmPackManifest(
  record: Record<string, unknown>,
  tarball: string,
): Record<string, unknown>;
export function createReleasePublishInput(
  inputDir: string,
  tarball: string,
  pkg: { name: string; version: string },
  npmPackManifest: Record<string, unknown>,
): Record<string, unknown>;
export function main(argv?: string[]): {
  ok: boolean;
  name?: string;
  version: string;
  tarball?: string;
  sha256?: string;
  integrity?: string;
  npmPackManifest?: Record<string, unknown>;
  files?: number;
  consumer?: boolean;
  consumerAll?: boolean;
  changelog?: boolean;
};
export function isValidIsoDate(value: string): boolean;
