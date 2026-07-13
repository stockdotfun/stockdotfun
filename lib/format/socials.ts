/**
 * Normalize creator-supplied social strings into safe, clickable https URLs.
 *
 * Values are pinned to IPFS verbatim as the user typed them ("@handle",
 * "t.me/foo", bare domains), so normalization happens at render time. Every
 * result is validated to be http(s) only — never javascript:/data: — so a
 * malicious pinned string can't produce a dangerous link.
 */

/** Prepend https:// when missing; return the href only for http(s) URLs. */
export function safeHttpUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (!v) return undefined;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/** "@handle" / "handle" → x.com URL; otherwise treat as a full URL. */
export function twitterUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim().replace(/^@/, "");
  if (/^[A-Za-z0-9_]{1,15}$/.test(v)) return `https://x.com/${v}`;
  return safeHttpUrl(v);
}

/** "@handle" / "handle" → t.me URL; otherwise treat as a full URL. */
export function telegramUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim().replace(/^@/, "");
  if (/^[A-Za-z0-9_]{3,32}$/.test(v)) return `https://t.me/${v}`;
  return safeHttpUrl(v);
}
