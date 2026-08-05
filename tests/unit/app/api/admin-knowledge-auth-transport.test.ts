import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { media } = vi.hoisted(() => ({
  media: {
    put: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
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
import { POST as UPDATE_VECTORIZE_STATUS } from '@/app/api/admin/knowledge/vectorize-status/route';

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
        filename: '  shipping.md  ',
        title: 'Shipping',
        content: '# Shipping',
      }),
    }));

    expect(response.status).toBe(200);
    expect(media.put).toHaveBeenCalledTimes(1);
    expect(media.put).toHaveBeenCalledWith(
      'knowledge_md/shipping.md',
      '# Shipping',
      expect.any(Object)
    );
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost/api/admin/vectorize',
      {
        method: 'POST',
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
        method: 'POST',
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

  it('rejects traversal on POST before writing or triggering vectorization', async () => {
    const response = await POST(new NextRequest('http://localhost/api/admin/knowledge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: '../escape.md',
        title: 'Escape',
        content: '# Escape',
      }),
    }));

    expect(response.status).toBe(400);
    expect(media.put).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects traversal on DELETE before deleting or triggering vectorization', async () => {
    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/knowledge?filename=..%2Fescape.md', {
        method: 'DELETE',
      })
    );

    expect(response.status).toBe(400);
    expect(media.delete).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects traversal before reading a knowledge object for a status update', async () => {
    const response = await UPDATE_VECTORIZE_STATUS(
      new NextRequest('http://localhost/api/admin/knowledge/vectorize-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: '..\\escape.md', vectorized: true }),
      })
    );

    expect(response.status).toBe(400);
    expect(media.get).not.toHaveBeenCalled();
    expect(media.put).not.toHaveBeenCalled();
  });

  it('rejects a POST stem whose appended .md suffix exceeds the key-segment bound', async () => {
    const response = await POST(new NextRequest('http://localhost/api/admin/knowledge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: 'a'.repeat(253),
        title: 'Too long',
        content: '# Too long',
      }),
    }));

    expect(response.status).toBe(400);
    expect(media.put).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects non-markdown names for DELETE and status updates', async () => {
    const deleteResponse = await DELETE(
      new NextRequest('http://localhost/api/admin/knowledge?filename=guide.txt', {
        method: 'DELETE',
      })
    );
    const statusResponse = await UPDATE_VECTORIZE_STATUS(
      new NextRequest('http://localhost/api/admin/knowledge/vectorize-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: 'guide.txt', vectorized: true }),
      })
    );

    expect(deleteResponse.status).toBe(400);
    expect(statusResponse.status).toBe(400);
    expect(media.delete).not.toHaveBeenCalled();
    expect(media.get).not.toHaveBeenCalled();
    expect(media.put).not.toHaveBeenCalled();
  });
});
