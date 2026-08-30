export function verifyIntegrity(bytes: Buffer, integrity: string, label: string): void;
export function canonicalRegistryTarballUrl(value: string, name: string, version: string): string;
export function readResponseBytes(
  response: Response,
  label: string,
  maxBytes: number,
): Promise<Buffer>;
export function tarFiles(tgz: Buffer, label: string, maxOutputLength?: number): Map<string, Buffer>;
export function exportTarget(value: unknown): string | null;
export function parseModule(filename: string, source: string): unknown;
export interface AuditModuleOwner {
  readonly name: string;
  readonly files: Map<string, Buffer>;
  readonly manifest?: { readonly exports?: Readonly<Record<string, unknown>> };
}
export interface AuditDeclarationEvidence {
  readonly declarationPath: string;
}
export function moduleResolver(
  sdk: AuditModuleOwner,
  core: AuditModuleOwner & {
    readonly manifest: { readonly exports?: Readonly<Record<string, unknown>> };
  },
): {
  inspect(owner: AuditModuleOwner, filename: string): Map<string, AuditDeclarationEvidence>;
  unresolvedBareExports: Set<string>;
};
export function generatedSource(snapshot: unknown): string;
export function main(): Promise<void>;
export interface AuditRuntimeVersionEntry {
  readonly capabilities?: unknown;
  readonly discoveredCapabilities?: unknown;
  readonly absent?: unknown;
  readonly typos?: unknown;
  readonly lifecycle?: unknown;
}
export function runtimeSnapshot(snapshot: {
  versions: Record<string, AuditRuntimeVersionEntry>;
}): Record<string, unknown>;
