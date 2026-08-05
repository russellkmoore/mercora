import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES = [
  'app/api/admin/knowledge/route.ts',
  'app/api/admin/knowledge/vectorize-status/route.ts',
  'app/api/admin/vectorize/route.ts',
  'app/api/admin/pages/route.ts',
  'app/api/admin/pages/[id]/route.ts',
  'app/api/admin/reviews/[id]/route.ts',
  'app/api/products/route.ts',
  'app/api/products/[id]/route.ts',
  'app/api/categories/route.ts',
  'app/api/categories/[id]/route.ts',
] as const;

describe('admin error response source policy', () => {
  it('does not put raw exception expressions directly into route JSON fields', () => {
    const offenders = ROUTES.filter((route) => {
      const contents = readFileSync(join(process.cwd(), route), 'utf8');
      return /(?:error|message|details)\s*:\s*(?:error\.message|String\(error\))/.test(contents);
    });

    expect(offenders).toEqual([]);
  });
});
