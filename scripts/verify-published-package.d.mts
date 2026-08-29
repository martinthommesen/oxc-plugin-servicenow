export interface RetryOptions {
  timeoutMs?: number | string;
  intervalMs?: number | string;
  initialDelayMs?: number | string;
  maxDelayMs?: number | string;
  maxAttempts?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  shouldRetry?: (error: unknown) => boolean;
}
export function isTransientRegistryError(error: unknown): boolean;
export function parseNpmCommandResult(result: unknown, context: string): unknown;
export function retryBounded<T>(
  operation: (attempt: number) => T | Promise<T>,
  options?: RetryOptions,
): Promise<T>;
export function waitForView<T extends object>(
  name: string,
  version: string,
  timeoutMs: number | string,
  intervalMs: number | string,
  accept?: (view: T) => boolean,
  options?: RetryOptions & { view?: (name: string, version: string) => T },
): Promise<T>;
export function registryIntegrityMatches(view: unknown, expectedIntegrity: string): boolean;
export function verificationInstallArgs(name: string, version: string): string[];
export function canonicalAttestationUrl(view: unknown, name: string, version: string): string;
export function parseRetryAfterMs(value: unknown, now?: () => number): number | undefined;
export function fetchAttestations(
  view: unknown,
  name: string,
  version: string,
  fetchFn?: typeof fetch,
  now?: () => number,
): Promise<Record<string, unknown>>;
export function verifyProvenanceAttestation(
  response: unknown,
  expected: Record<string, string>,
  verifyBundle?: (bundle: unknown, options: unknown) => Promise<unknown>,
): Promise<Record<string, string>>;
export function verifyInstallWithRetry(
  name: string,
  version: string,
  options?: RetryOptions & Record<string, unknown>,
): Promise<{ attempts: number }>;
export function inspectInstalledPackageExports(
  consumer: string,
  name: string,
  expectedVersion: string,
): { pkg: Record<string, unknown>; packageRoot: string };
export function importInstalledPackage(
  consumer: string,
  name: string,
  version: string,
): Promise<Record<string, unknown>>;
export function main(argv?: string[]): Promise<Record<string, unknown>>;
