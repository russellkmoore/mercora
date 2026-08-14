export function parseSitemapSlug(value: unknown): string | null {
  let candidate = value;
  if (typeof candidate === "string" && candidate.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      candidate = Object.values(parsed).find((item) => typeof item === "string");
    } catch {
      return null;
    }
  }
  if (typeof candidate !== "string") return null;
  const slug = candidate.trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}
