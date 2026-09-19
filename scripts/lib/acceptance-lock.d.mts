export interface AcceptanceLockHooks {
  readonly beforeLockPublish?: () => void | Promise<void>;
  readonly beforeReclaim?: () => void | Promise<void>;
}

export interface AcceptanceLockOptions {
  readonly hooks?: AcceptanceLockHooks;
  readonly lockPath?: string;
  readonly pollIntervalMs?: number;
  readonly waitTimeoutMs?: number;
}

export function acceptanceLockPath(root?: string): string;
export function withAcceptanceLock<T>(
  operation: () => T | Promise<T>,
  options?: AcceptanceLockOptions,
): Promise<T>;
