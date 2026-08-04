import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { media } = vi.hoisted(() => ({
  media: {
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/auth/admin-middleware', () => ({
  checkAdminPermissions: vi.fn().mockResolvedValue({
    success: true,
    userId: 'admin-1',
  }),
}));
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn().mockResolvedValue({ env: { MEDIA: media } }),
}));

import { NextRequest } from 'next/server';
import { DELETE, POST } from '@/app/api/admin/knowledge/route';

function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSources(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}

describe('knowledge vectorization auth transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ADMIN_VECTORIZE_TOKEN', 'vectorize-service-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends the service token in the Authorization header after POST', async () => {
    const response = await POST(new NextRequest('http://localhost/api/admin/knowledge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: 'shipping.md',
        title: 'Shipping',
        content: '# Shipping',
      }),
    }));

    expect(response.status).toBe(200);
    expect(media.put).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost/api/admin/vectorize',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer vectorize-service-secret' },
      }
    );
  });

  it('sends the service token in the Authorization header after DELETE', async () => {
    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/knowledge?filename=shipping.md', {
        method: 'DELETE',
      })
    );

    expect(response.status).toBe(200);
    expect(media.delete).toHaveBeenCalledWith('knowledge_md/shipping.md');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost/api/admin/vectorize',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer vectorize-service-secret' },
      }
    );
  });

  it('has no production caller that constructs a token query parameter', () => {
    const files = [
      ...productionSources(join(process.cwd(), 'app')),
      ...productionSources(join(process.cwd(), 'lib')),
    ];
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /[?&]token=|searchParams\.set\(\s*['"]token['"]/.test(source);
    });

    expect(offenders).toEqual([]);
  });
});
