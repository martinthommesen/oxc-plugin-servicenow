export interface ReleaseAsset {
  name?: unknown;
  digest?: unknown;
  [key: string]: unknown;
}
export interface ReleaseView {
  tagName?: string;
  name?: string;
  isDraft?: boolean;
  isPrerelease?: boolean;
  body?: string;
  assets?: ReleaseAsset[];
  [key: string]: unknown;
}
export function parseReleaseView(raw: string | ReleaseView): ReleaseView;
export function releaseAction(
  existing: ReleaseView | undefined,
  assetName: string,
): "create" | "verify-asset" | "upload-asset";
export function releaseAssetNames(view: ReleaseView | undefined): string[];
export function changelogReleaseNotes(source: string, version: string): string;
export function validateExistingRelease(
  existing: ReleaseView | undefined,
  expected: {
    tag: string;
    version: string;
    assetName: string;
    prerelease: boolean;
    notes: string;
  },
): ReleaseView;
export function resolveTagCommit(options: {
  tag: string;
  expectedCommit: string;
  readRef: (tag: string) => { object?: { type?: string; sha?: string } };
  readTag: (sha: string) => { object?: { type?: string; sha?: string } };
  maxDepth?: number;
}): string;
export function githubReleaseCreateArgs(
  tag: string,
  version: string,
  tarball: string,
  notesFile: string,
): string[];
export function main(argv?: string[]): Record<string, unknown>;
