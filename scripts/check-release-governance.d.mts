export function validateDesiredGovernance(desired: unknown): string[];
export function normalizeLiveGovernance(raw: unknown, desired: any): any;
export function compareGovernance(
  desired: any,
  live: any,
): {
  ok: boolean;
  errors: string[];
  livePending: string[];
  repository: string;
  environment: string;
};
export function collectLiveGovernance(
  desired: any,
  command?: typeof import("node:child_process").execFileSync,
): any;
export function main(argv?: string[]): Record<string, unknown>;
