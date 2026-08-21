export interface CompatibilityCheckResult {
  cells: number;
  matrix: { include: Array<{ cell: string; node: string }> };
}

export function checkCompatibilityMatrix(): CompatibilityCheckResult;
export function main(): CompatibilityCheckResult;
