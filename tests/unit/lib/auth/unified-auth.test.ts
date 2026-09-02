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
import { getApiTokenByHash, updateApiTokenLastUsed } from '@/lib/models/auth';
import { isUserAdmin } from '@/lib/models/admin';
import { DEPLOYMENT_GUARD_MESSAGE } from '@/lib/auth/deployment-guard';

describe('authenticateRequest fail-closed behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ADMIN_VECTORIZE_TOKEN', 'expected-service-secret');
    vi.mocked(auth).mockResolvedValue({ userId: null, sessionClaims: null } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects an admin secret supplied in the query string', async () => {
    const result = await authenticateRequest(
      new NextRequest('http://localhost/api/orders?token=expected-service-secret'),
      ['orders:read']
    );

    expect(result.success).toBe(false);
    expect(result.response?.status).toBe(401);
    expect(vi.mocked(updateApiTokenLastUsed)).not.toHaveBeenCalled();
    expect(vi.mocked(getApiTokenByHash)).not.toHaveBeenCalled();
  });

  it('accepts the same service secret from an Authorization header', async () => {
    const result = await authenticateRequest(
      new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        headers: { authorization: 'Bearer expected-service-secret' },
      }),
      ['orders:read']
    );

    expect(result.success).toBe(true);
    expect(result.tokenInfo?.tokenName).toBe('admin-service');
  });

  it('rejects a mutating Clerk-cookie request without an exact Origin', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_123', sessionClaims: null } as never);
    vi.mocked(isUserAdmin).mockResolvedValue(true);

    const result = await authenticateRequest(
      new NextRequest('https://shop.example/api/orders', { method: 'PUT' }),
      ['orders:write']
    );

    expect(result.success).toBe(false);
    expect(result.response?.status).toBe(403);
    expect(auth).not.toHaveBeenCalled();
  });

  it('accepts an exact-origin mutating Clerk admin request', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_123', sessionClaims: null } as never);
    vi.mocked(isUserAdmin).mockResolvedValue(true);

    const result = await authenticateRequest(
      new NextRequest('https://shop.example/api/orders', {
        method: 'PUT',
        headers: { origin: 'https://shop.example' },
      }),
      ['orders:write']
    );

    expect(result.success).toBe(true);
    expect(result.tokenInfo?.tokenName).toBe('clerk:user_123');
  });

  it('fails closed in production when no credentials are present', async () => {
    const result = await authenticateRequest(
      new NextRequest('http://localhost/api/orders'),
      ['orders:read']
    );

    expect(result.success).toBe(false);
    expect(result.response?.status).toBe(401);
  });

  it('rejects a database token with a malformed expiry timestamp', async () => {
    vi.mocked(getApiTokenByHash).mockResolvedValue({
      id: 1,
      tokenName: 'malformed-expiry',
      tokenHash: 'stored-hash',
      permissions: ['orders:read'],
      active: true,
      expiresAt: 'definitely-not-a-date',
      lastUsedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await authenticateRequest(
      new NextRequest('http://localhost/api/orders', {
        headers: { authorization: 'Bearer database-token' },
      }),
      ['orders:read']
    );

    expect(result.success).toBe(false);
    expect(result.response?.status).toBe(401);
    expect(vi.mocked(updateApiTokenLastUsed)).not.toHaveBeenCalled();
  });

  it('rejects a database token with an expired timestamp', async () => {
    vi.mocked(getApiTokenByHash).mockResolvedValue({
      id: 2,
      tokenName: 'expired-token',
      tokenHash: 'stored-hash',
      permissions: ['orders:read'],
      active: true,
      expiresAt: '2000-01-01T00:00:00.000Z',
      lastUsedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await authenticateRequest(
      new NextRequest('http://localhost/api/orders', {
        headers: { authorization: 'Bearer database-token' },
      }),
      ['orders:read']
    );

    expect(result.success).toBe(false);
    expect(result.response?.status).toBe(401);
    expect(vi.mocked(updateApiTokenLastUsed)).not.toHaveBeenCalled();
  });

  it('trips the deployment guard for a request with no credentials under a deployed development build', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });

    const result = await authenticateRequest(
      new NextRequest('http://localhost/api/orders'),
      ['orders:read']
    );

    expect(result.success).toBe(false);
    expect(result.response?.status).toBe(503);
  });

  it('trips the deployment guard before token extraction, denying a valid Bearer service token', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });

    const result = await authenticateRequest(
      new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        headers: { authorization: 'Bearer expected-service-secret' },
      }),
      ['orders:read']
    );

    expect(result.success).toBe(false);
    expect(result.response?.status).toBe(503);
  });

  it('trips the deployment guard for a signed-in Clerk user, making the development admin shortcut unreachable', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });
    vi.mocked(auth).mockResolvedValue({ userId: 'user_123', sessionClaims: null } as never);

    const result = await authenticateRequest(
      new NextRequest('http://localhost/api/orders'),
      ['orders:read']
    );

    expect(result.success).toBe(false);
    expect(result.response?.status).toBe(503);
  });

  it('does not trip in production under a deployed Workers build', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });
    vi.mocked(auth).mockResolvedValue({ userId: 'user_123', sessionClaims: null } as never);
    vi.mocked(isUserAdmin).mockResolvedValue(true);

    const result = await authenticateRequest(
      new NextRequest('http://localhost/api/orders'),
      ['orders:read']
    );

    expect(result.success).toBe(true);
  });

  it('does not trip under development with Node native user-agent, preserving local development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.mocked(auth).mockResolvedValue({ userId: 'user_123', sessionClaims: null } as never);

    const result = await authenticateRequest(
      new NextRequest('http://localhost/api/orders'),
      ['orders:read']
    );

    expect(result.success).toBe(true);
  });

  it('returns the shared deployment guard message in the 503 body', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });

    const result = await authenticateRequest(
      new NextRequest('http://localhost/api/orders'),
      ['orders:read']
    );

    expect(result.response?.status).toBe(503);
    const body = await result.response!.json();
    expect(body.error).toBe(DEPLOYMENT_GUARD_MESSAGE);
  });
});
