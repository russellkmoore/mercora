/** Maximum length for a client-provided R2 object-key segment. */
export const MAX_SAFE_FILENAME_LENGTH = 255;

/**
 * Normalize and validate one client-provided filename/path segment.
 *
 * R2 uses a flat key namespace, but rejecting separators, traversal markers,
 * control characters, and unbounded names prevents callers from escaping an
 * intended prefix or creating ambiguous keys.
 */
export function normalizeSafeFilenameSegment(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > MAX_SAFE_FILENAME_LENGTH) {
    return null;
  }
  if (normalized.includes('/') || normalized.includes('\\')) return null;
  if (normalized.includes('..') || normalized === '.') return null;
  if (/[\u0000-\u001f\u007f]/.test(normalized)) return null;

  return normalized;
}

/** True when the value is a safe, bounded R2 key segment. */
export function isSafeFilenameSegment(value: unknown): value is string {
  return normalizeSafeFilenameSegment(value) !== null;
}

/** Knowledge-route compatibility name for the shared segment validator. */
export function isSafeKnowledgeFilename(value: unknown): value is string {
  return isSafeFilenameSegment(value);
}

/**
 * Normalize a knowledge article filename and enforce its `.md` contract.
 * When `appendExtension` is true, a missing `.md` suffix is added before the
 * final bounded-segment validation.
 */
export function normalizeKnowledgeFilename(
  value: unknown,
  appendExtension = false
): string | null {
  const normalized = normalizeSafeFilenameSegment(value);
  if (!normalized) return null;

  const filename = appendExtension && !normalized.endsWith('.md')
    ? `${normalized}.md`
    : normalized;

  if (!filename.endsWith('.md')) return null;
  return normalizeSafeFilenameSegment(filename);
}
