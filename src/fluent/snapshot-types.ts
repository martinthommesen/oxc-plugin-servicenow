/**
 * Shape of the generated SDK declaration snapshots. The generated module
 * annotates its constant with this interface instead of `as const`, because
 * the literal type of a 27-version snapshot emits a ~939 KB declaration file
 * that no consumer uses (FINDINGS.md PER-001).
 */
export interface DeclarationCapability {
  readonly module: "@servicenow/sdk/core";
  readonly exportName: string;
  readonly declarationPath: string;
  readonly declarationSha256: string;
  readonly sourceSha256: string;
  readonly kind: string;
  readonly idPolicy: "required" | "deprecated" | "unknown";
}

export interface DeclarationSnapshot {
  readonly capabilities: Readonly<Record<string, DeclarationCapability>>;
  readonly discoveredCapabilities: Readonly<Record<string, DeclarationCapability>>;
  readonly absent: readonly string[];
}
