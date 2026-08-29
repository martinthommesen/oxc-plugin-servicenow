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
 * The sys_id pattern only ever matches 32 hex characters, so this predicate
 * tests exactly that length for every digest-like name. Longer digest forms
 * (sha1, sha256) can never produce a sys_id match and need no branch here.
 */
export function looksLikeDigestContext(name: string | null, value: string): boolean {
  if (!name) return false;
  return /(md5|sha|hash|checksum|etag|digest)/i.test(name) && ALL_HEX.test(value.trim());
}
