export interface ReleaseAsset { name?: unknown; digest?: unknown; [key: string]: unknown }
export interface ReleaseView { tagName?: string; assets?: ReleaseAsset[]; [key: string]: unknown }
export function parseReleaseView(raw: string | ReleaseView): ReleaseView;
export function releaseAction(existing: ReleaseView | undefined, assetName: string): "create" | "verify-asset" | "upload-asset";
export function releaseAssetNames(view: ReleaseView | undefined): string[];
export function main(argv?: string[]): Record<string, unknown>;
