import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/models/admin', () => ({
  isUserAdmin: vi.fn(),
  updateAdminLastLogin: vi.fn(),
}));

import { auth } from '@clerk/nextjs/server';
import { isUserAdmin, updateAdminLastLogin } from '@/lib/models/admin';
import { NextRequest } from 'next/server';
import { checkAdminPermissions } from '@/lib/auth/admin-middleware';

describe('checkAdminPermissions credential transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ADMIN_VECTORIZE_TOKEN', 'service-secret');
    vi.mocked(auth).mockResolvedValue({ userId: null, sessionClaims: null } as never);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(updateAdminLastLogin).mockResolvedValue(undefined);
  });

  afterEach(() => vi.unstubAllEnvs());

  it('does not accept development or service credentials from query parameters', async () => {
    const result = await checkAdminPermissions(
      new NextRequest('http://localhost/api/products?dev=mercora-dev-bypass&token=service-secret')
    );

    expect(result.success).toBe(false);
  });

  it('retains the explicit development-only header bypass', async () => {
    const result = await checkAdminPermissions(
      new NextRequest('http://localhost/api/products', {
        method: 'POST',
        headers: { 'x-dev-admin': 'mercora-dev-bypass' },
      })
    );

    expect(result).toMatchObject({ success: true, isDevMode: true });
    expect(result.isServiceToken).not.toBe(true);
  });

  it('marks a matching header service token as a service identity', async () => {
    const result = await checkAdminPermissions(
      new NextRequest('http://localhost/api/admin/vectorize', {
        method: 'POST',
        headers: { Authorization: 'Bearer service-secret' },
      })
    );

    expect(result).toEqual({
      success: true,
      userId: 'admin-service',
      isServiceToken: true,
    });
    expect(auth).not.toHaveBeenCalled();
  });

  it('accepts a same-origin interactive mutation', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.mocked(auth).mockResolvedValue({
      userId: 'user_admin',
      sessionClaims: null,
    } as never);

    const result = await checkAdminPermissions(
      new NextRequest('https://store.example.test/api/products', {
        method: 'POST',
        headers: { Origin: 'https://store.example.test' },
      })
    );

    expect(result).toMatchObject({ success: true, userId: 'user_admin' });
    expect(isUserAdmin).toHaveBeenCalledWith('user_admin');
  });

  it.each([
    ['missing', undefined],
    ['null', 'null'],
    ['cross-origin', 'https://attacker.example.test'],
  ])('rejects an interactive mutation with %s Origin before Clerk or admin DB work', async (_case, origin) => {
    vi.stubEnv('NODE_ENV', 'production');
    const headers = origin ? { Origin: origin } : undefined;

    const result = await checkAdminPermissions(
      new NextRequest('https://store.example.test/api/products', {
        method: 'POST',
        headers,
      })
    );

    expect(result).toEqual({
      success: false,
      error: 'Request origin validation failed.',
    });
    expect(JSON.stringify(result)).not.toContain('attacker.example.test');
    expect(auth).not.toHaveBeenCalled();
    expect(isUserAdmin).not.toHaveBeenCalled();
  });

  it.each(['GET', 'HEAD'])('does not require Origin for interactive %s requests', async (method) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.mocked(auth).mockResolvedValue({
      userId: 'user_admin',
      sessionClaims: null,
    } as never);

    const result = await checkAdminPermissions(
      new NextRequest('https://store.example.test/api/products', { method })
    );

    expect(result).toMatchObject({ success: true, userId: 'user_admin' });
  });

  it('does not honor the development bypass header in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const result = await checkAdminPermissions(
      new NextRequest('http://localhost/api/products', {
        headers: { 'x-dev-admin': 'mercora-dev-bypass' },
      })
    );

    expect(result.success).toBe(false);
  });
});
