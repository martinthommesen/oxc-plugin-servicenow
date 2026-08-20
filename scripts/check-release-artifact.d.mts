export const REQUIRED_TARBALL_PATHS: string[];
export const FORBIDDEN_TARBALL_PREFIXES: string[];
export function changelogVersionHeadingPattern(version: string): RegExp;
export function changelogHasVersionHeading(text: string, version: string): boolean;
export function inspectTarballListing(files: readonly string[]): string[];
export function sha256File(filePath: string): string;
export function tarballIntegrity(buffer: Uint8Array): string;
export function main(argv?: string[]): {
  ok: boolean;
  name?: string;
  version: string;
  tarball?: string;
  sha256?: string;
  integrity?: string;
  files?: number;
  consumer?: boolean;
  consumerAll?: boolean;
  changelog?: boolean;
};
