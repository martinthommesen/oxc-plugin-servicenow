export interface CompatibilityCheckResult {
  cells: number;
  matrix: { include: Array<{ cell: string; node: string }> };
}

export function checkSupportPolicy(matrix: unknown, pkg: unknown): string[];
export function checkCompatibilityMatrix(): CompatibilityCheckResult;
export function main(): CompatibilityCheckResult;
