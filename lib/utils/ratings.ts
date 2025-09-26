import type { Rating } from '@/lib/types';

export interface NormalizedProductRating {
  average: number;
  count: number;
  distribution?: Record<number, number>;
  lastPublishedAt?: string;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function parseDistribution(raw: unknown): Record<number, number> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (!entries.length) return undefined;

  const distribution: Record<number, number> = {};
  for (const [key, value] of entries) {
    const bucket = coerceNumber(key);
    const count = coerceNumber(value);
    if (bucket === null || count === null) continue;
    const roundedBucket = Math.round(bucket);
    if (roundedBucket < 1 || roundedBucket > 5) continue;
    distribution[roundedBucket] = Math.max(0, Math.round(count));
  }

  return Object.keys(distribution).length ? distribution : undefined;
}

export function normalizeProductRating(raw?: Rating | string | null): NormalizedProductRating | null {
  if (!raw) return null;

  let value: Rating | undefined;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw) as Rating;
    } catch {
      return null;
    }
  } else {
    value = raw;
  }

  if (!value || typeof value !== 'object') return null;

  const average = coerceNumber((value as Rating).average);
  const count = coerceNumber((value as Rating).count);
  const lastPublishedAt = typeof (value as Rating & { lastPublishedAt?: unknown }).lastPublishedAt === 'string'
    ? (value as Rating & { lastPublishedAt?: string }).lastPublishedAt
    : undefined;

  if (average === null || count === null) {
    return null;
  }

  const safeAverage = Math.min(5, Math.max(0, Number(average.toFixed(2))));
  const safeCount = Math.max(0, Math.round(count));
  const distribution = parseDistribution((value as Rating & { distribution?: unknown }).distribution);

  return {
    average: safeAverage,
    count: safeCount,
    distribution,
    lastPublishedAt,
  };
}
