import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(() => ({ ctx: { waitUntil: vi.fn() } })),
}));
vi.mock('@/lib/models/admin', () => ({ isUserAdmin: vi.fn() }));
vi.mock('@/lib/models/auth', () => ({
  getApiTokenByHash: vi.fn(),
  updateApiTokenLastUsed: vi.fn(),
}));

import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/unified-auth';
import { getApiTokenByHash } from '@/lib/models/auth';

describe('authenticateRequest fail-closed behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ADMIN_VECTORIZE_TOKEN', 'expected-service-secret');
    vi.mocked(auth).mockResolvedValue({ userId: null, sessionClaims: null } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects an admin secret supplied in the query string', async () => {
    const result = await authenticateRequest(
      new NextRequest('http://localhost/api/orders?token=expected-service-secret'),
      ['orders:read']
    );

    expect(result.success).toBe(false);
    expect(result.response?.status).toBe(401);
    expect(vi.mocked(getApiTokenByHash)).not.toHaveBeenCalled();
  });

  it('accepts the same service secret from an Authorization header', async () => {
    const result = await authenticateRequest(
      new NextRequest('http://localhost/api/orders', {
        headers: { authorization: 'Bearer expected-service-secret' },
      }),
      ['orders:read']
    );

    expect(result.success).toBe(true);
    expect(result.tokenInfo?.tokenName).toBe('admin-service');
  });

  it('fails closed in production when no credentials are present', async () => {
    const result = await authenticateRequest(
      new NextRequest('http://localhost/api/orders'),
      ['orders:read']
    );

    expect(result.success).toBe(false);
    expect(result.response?.status).toBe(401);
  });
});
