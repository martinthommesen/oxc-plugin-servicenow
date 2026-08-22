export interface AcceptanceSource {
  heading: string;
  line: number;
  text: string;
  digest: string;
}

export interface AcceptanceCriterion {
  id: string;
  source: AcceptanceSource;
  owner: { plan: string | null; pr: number; branch: string };
}

export function repoFilePath(path: string): string;
export function searchableRepoFiles(): string[];
export function parseCriteria(source: string): AcceptanceCriterion[];
export function criteriaSha256(criteria: AcceptanceCriterion[]): string;
export function validateMapping(
  parsed: AcceptanceCriterion[],
  mapping: { criteria?: Array<AcceptanceCriterion & { disposition: string }> },
): string[];
export function validateSnapshot(mapping: {
  goal?: { criteria?: number; criteriaSha256?: string };
  criteria?: Array<AcceptanceCriterion & { disposition: string }>;
}): string[];
export function main(argv?: string[]): Promise<Record<string, unknown>>;
