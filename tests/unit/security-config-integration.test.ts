import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import nextConfig from '@/next.config';
import { buildSecurityHeaders } from '@/lib/security-headers';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSources(path);
    return ['.ts', '.tsx'].includes(extname(path)) ? [path] : [];
  });
}

describe('security configuration integration', () => {
  it('adds the complete security header set to the global Next route', async () => {
    expect(nextConfig.headers).toBeTypeOf('function');
    const routes = await nextConfig.headers!();
    const globalRoute = routes.find((route) => route.source === '/(.*)');

    expect(globalRoute).toBeDefined();
    for (const expected of buildSecurityHeaders(process.env)) {
      expect(globalRoute?.headers).toContainEqual(expected);
    }

    const keys = globalRoute?.headers.map((header) => header.key) ?? [];
    expect(keys).not.toContain('Cross-Origin-Opener-Policy');
    expect(keys).not.toContain('Cross-Origin-Embedder-Policy');
  });

  it('imports and spreads environment-derived security headers in next.config', () => {
    const config = source('next.config.ts');

    expect(config).toContain(
      'import { buildSecurityHeaders } from "./lib/security-headers";'
    );
    expect(config).toContain('...buildSecurityHeaders(process.env)');
  });

  it('keeps Wrangler and the deployment example on the types baseline date', () => {
    const compatibilityDate = /"compatibility_date"\s*:\s*"([^"]+)"/g;
    expect([...source('wrangler.jsonc').matchAll(compatibilityDate)].map((match) => match[1]))
      .toEqual(['2026-08-01']);
    expect([...source('docs/DEPLOYMENT_SETUP.md').matchAll(compatibilityDate)].map((match) => match[1]))
      .toEqual(['2026-08-01']);
  });

  it('uses POST in all admin UI vectorize callers', () => {
    const callers = [
      'app/admin/products/ProductManagement.tsx',
      'app/admin/knowledge/KnowledgeManagement.tsx',
      'app/admin/settings/page.tsx',
    ];

    for (const caller of callers) {
      const contents = source(caller);
      expect(contents).toMatch(
        /fetch\("\/api\/admin\/vectorize",\s*\{\s*method:\s*"POST"\s*\}\)/
      );
    }
  });

  it('has no production vectorize fetch using GET or a default method', () => {
    const vectorizeCalls = productionSources(join(process.cwd(), 'app')).flatMap((file) => {
      const contents = readFileSync(file, 'utf8');
      return [...contents.matchAll(
        /fetch\(\s*(?:["']\/api\/admin\/vectorize["']|vectorizeUrl\.toString\(\))([\s\S]*?)\);/g
      )].map((match) => ({ file, options: match[1] }));
    });

    expect(vectorizeCalls).toHaveLength(5);
    expect(vectorizeCalls.filter(({ options }) => !/method:\s*["']POST["']/.test(options)))
      .toEqual([]);
  });
});
