import type { BlogPostStatus } from "./values";

export function parsePositiveInt(value: string | null, fallback: number, maximum: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  return Math.min(maximum, Math.max(1, Number(value)));
}

export function parseBlogPage(value: string | null | undefined): number {
  return parsePositiveInt(value ?? null, 1, 417);
}

export function parseOffset(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 0;
  return Math.min(10_000, Number(value));
}

export function parseBlogStatus(value: string | null): BlogPostStatus | undefined {
  if (!value) return undefined;
  if (value === "draft" || value === "published") return value;
  throw new Error("Status must be draft or published");
}

export function parseBlogId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function blogErrorStatus(error: unknown): 400 | 409 | 500 {
  if (!(error instanceof Error)) return 500;
  if (/UNIQUE constraint failed: blog_(?:posts|categories)\.slug|unique.*blog_(?:posts|categories).*slug/i.test(error.message)) return 409;
  if (/required|must be|is too long|is invalid|publication time|content|slug/i.test(error.message)) return 400;
  return 500;
}
