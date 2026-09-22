const SYS_ID = /\b[0-9a-f]{32}\b/gi;
const ALL_HEX = /^[0-9a-f]{32}$/i;

/** ServiceNow sys_ids are 32-character lowercase hex strings. */
export function isSysId(value: string): boolean {
  return ALL_HEX.test(value);
}

export function findSysIds(value: string): string[] {
  return value.match(SYS_ID) ?? [];
}

/**
 * All sys_id matches with indices. Both `match` and a fully consumed
 * `matchAll` leave the shared pattern's `lastIndex` at zero, so sharing one
 * instance across the two call shapes is safe.
 */
export function matchSysIds(value: string): RegExpExecArray[] {
  return [...value.matchAll(SYS_ID)];
}

const DIGEST_WORDS = new Set(["md5", "sha", "hash", "checksum", "etag", "digest"]);

function isDigestComponent(component: string): boolean {
  const lower = component.toLowerCase();
  return DIGEST_WORDS.has(lower) || DIGEST_WORDS.has(lower.replace(/\d+$/, ""));
}

/**
 * A digest word must be a whole name component (`fileHash`, `sha256Digest`):
 * `sha` inside `shared` is not evidence of a digest, and an unanchored match
 * silently hid real sys_ids under such names (FINDINGS.md COR-008).
 */
export function looksLikeDigestContext(name: string | null, value: string): boolean {
  if (!name || !ALL_HEX.test(value.trim())) return false;
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1\0$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1\0$2")
    .split(/[^A-Za-z0-9]+/)
    .some(isDigestComponent);
}
