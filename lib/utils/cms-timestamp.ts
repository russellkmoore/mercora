export type CmsTimestamp = string | number | Date | null | undefined;

/** Parse CMS timestamps without inventing a current-time fallback. */
export function parseCmsTimestamp(value: CmsTimestamp): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const milliseconds = Math.abs(value) < 100_000_000_000 ? value * 1_000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;

  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return parseCmsTimestamp(Number(normalized));
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatCmsTimestamp(value: CmsTimestamp): string | null {
  const date = parseCmsTimestamp(value);
  if (!date) return null;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
