const PUBLIC_MEDIA_PREFIXES = new Set(["products", "categories", "blog", "pages"]);
const SAFE_KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._~-]*$/;
const MAX_KEY_LENGTH = 1024;

/** Next has already decoded dynamic route params; never decode them again. */
export function resolvePublicMediaKey(segments: readonly string[] | undefined): string | null {
  if (!segments || segments.length < 2 || !PUBLIC_MEDIA_PREFIXES.has(segments[0])) return null;
  if (segments.length > 12) return null;

  for (const segment of segments) {
    if (
      segment.length > 255
      || !SAFE_KEY_SEGMENT.test(segment)
      || segment === "."
      || segment === ".."
      || segment.includes("%")
      || segment.includes("\\")
    ) {
      return null;
    }
  }

  const key = segments.join("/");
  return key.length <= MAX_KEY_LENGTH ? key : null;
}
