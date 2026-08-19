const SYS_ID = /\b[0-9a-fA-F]{32}\b/g;
const ALL_HEX = /^[0-9a-fA-F]{32}$/;

/** ServiceNow sys_ids are 32-character lowercase hex strings. */
export function isSysId(value: string): boolean {
  return ALL_HEX.test(value);
}

export function findSysIds(value: string): string[] {
  return value.match(SYS_ID) ?? [];
}

export function looksLikeMd5Context(name: string | null): boolean {
  if (!name) return false;
  return /(md5|sha1|sha256|hash|checksum|etag|digest)/i.test(name);
}
