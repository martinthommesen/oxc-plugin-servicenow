export function verifyIntegrity(bytes: Buffer, integrity: string, label: string): void;
export function tarFiles(tgz: Buffer, label: string, maxOutputLength?: number): Map<string, Buffer>;
export function exportTarget(value: unknown): string | null;
export function parseModule(filename: string, source: string): unknown;
export function generatedSource(snapshot: unknown): string;
export function main(): Promise<void>;
