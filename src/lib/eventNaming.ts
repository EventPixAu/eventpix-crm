/**
 * Removes a redundant leading "LBA" token (with optional dash) from an
 * event or series display name, e.g. "LBA Hills" -> "Hills",
 * "LBA - Adelaide" -> "Adelaide", "LBA NSW 2026" -> "NSW 2026".
 * Names that do not start with the LBA token (Champions, SBC, "LBAR ...")
 * are returned unchanged. A name that is only "LBA" is kept as-is so it
 * never becomes blank.
 */
export const stripLbaPrefix = (name: string): string => {
  const stripped = name.replace(/^\s*LBA(?![A-Za-z])[\s\-–—]*/i, '').trim();
  return stripped || name.trim().replace(/[\s\-–—]+$/, '') || name.trim();
};
