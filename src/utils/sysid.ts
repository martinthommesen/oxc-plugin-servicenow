const SYS_ID = /\b[0-9a-f]{32}\b/gi;
const ALL_HEX = /^[0-9a-f]{32}$/i;

/** ServiceNow sys_ids are 32-character lowercase hex strings. */
export function isSysId(value: string): boolean {
  return ALL_HEX.test(value);
}

export function findSysIds(value: string): string[] {
  return value.match(SYS_ID) ?? [];
}

export function looksLikeMd5Context(name: string | null, value: string): boolean {
  if (!name) return false;
  const compact = value.trim();
  if (/md5/i.test(name)) return /^[0-9a-f]{32}$/i.test(compact);
  if (/sha1/i.test(name)) return /^[0-9a-f]{40}$/i.test(compact);
  if (/sha256/i.test(name)) return /^[0-9a-f]{64}$/i.test(compact);
  return (
    /(hash|checksum|etag|digest)/i.test(name) && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(compact)
  );
}
