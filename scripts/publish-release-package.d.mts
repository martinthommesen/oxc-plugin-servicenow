export type PublicationOutcome = "published" | "ambiguous" | "verify-existing";
export function releaseDistTag(version: string): "latest" | "next";
export function compareReleaseVersions(left: string, right: string): number;
export function validateRegistryVersionOrder(
  metadata: { versions: string[]; "dist-tags": Record<string, string> },
  candidate: string,
): { existing: boolean; highest?: string | null };
export function classifyPublishResult(result: {
  status: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
}): { outcome: PublicationOutcome; code?: string };
export function inspectPublishInput(inputDir: string): {
  manifest: Record<string, unknown>;
  npmPackManifest: {
    schemaVersion: number;
    name: string;
    version: string;
    filename: string;
    size: number;
    sha256: string;
    integrity: string;
    files: Array<{ path: string; size: number; mode: number; link: string | null; sha256: string }>;
  };
  tarball: string;
};
export function publicationStateResult(
  result: { status: number | null; signal: string | null; stdout: string; stderr: string },
  name: string,
  version: string,
): { state: "absent" | "existing"; integrity?: string };
export function runPublicationState(
  name: string,
  version: string,
  npmCommand?: string,
): { state: "absent" | "existing"; integrity?: string };
export function publishReleasePackage(options: {
  inputDir: string;
  expectedVersion: string;
  npmCommand?: string;
  spawn?: typeof import("node:child_process").spawnSync;
}): Record<string, unknown>;
export function main(argv?: string[]): Record<string, unknown>;
