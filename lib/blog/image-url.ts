export function absoluteBlogImageUrl(
  value: string | null | undefined,
  options: { imageCdn?: string; siteUrl: string },
): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    if (!options.imageCdn) return null;
    try {
      return new URL(value.replace(/^\//, ""), `${options.imageCdn}/`).href;
    } catch {
      return null;
    }
  }
}
