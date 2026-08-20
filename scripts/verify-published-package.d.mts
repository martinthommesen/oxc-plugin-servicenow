export function isTransientRegistryError(error: unknown): boolean;
export function retryBounded<T>(operation: () => T | Promise<T>, options?: { timeoutMs?: number | string; intervalMs?: number | string }): Promise<T>;
export function waitForView<T extends object>(name: string, version: string, timeoutMs: number | string, intervalMs: number | string, accept?: (view: T) => boolean): Promise<T>;
export function hasProvenanceAttestation(view: {
  dist?: {
    tarball?: string;
    integrity?: string;
    attestations?: {
      url?: string;
      provenance?: Record<string, unknown>;
    };
  };
}): boolean;
export function main(argv?: string[]): Promise<{
  ok: boolean;
  name: string;
  version: string;
  tarball: string;
  integrity: string;
  provenance: boolean;
}>;
