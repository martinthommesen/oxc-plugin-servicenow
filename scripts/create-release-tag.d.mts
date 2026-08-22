export interface CreateReleaseTagOptions {
  version: string;
  expectedCommit: string;
  repository: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export function createReleaseTag(options: CreateReleaseTagOptions): Promise<{
  tag: string;
  commit: string;
  repository: string;
}>;

export function main(env?: NodeJS.ProcessEnv): Promise<Record<string, string>>;
