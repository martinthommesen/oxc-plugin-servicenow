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
