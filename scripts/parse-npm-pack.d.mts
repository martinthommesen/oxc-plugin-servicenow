export interface NpmPackRecord {
  filename: string;
  name?: string;
  version?: string;
  [key: string]: unknown;
}

export function parseNpmPackJson(value: string | unknown): NpmPackRecord;
