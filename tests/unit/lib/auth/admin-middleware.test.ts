import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/models/admin', () => ({
  isUserAdmin: vi.fn(),
  updateAdminLastLogin: vi.fn(),
}));

import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { checkAdminPermissions } from '@/lib/auth/admin-middleware';

describe('checkAdminPermissions credential transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ADMIN_VECTORIZE_TOKEN', 'service-secret');
    vi.mocked(auth).mockResolvedValue({ userId: null, sessionClaims: null } as never);
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
        headers: { 'x-dev-admin': 'mercora-dev-bypass' },
      })
    );

    expect(result).toMatchObject({ success: true, isDevMode: true });
    expect(result.isServiceToken).not.toBe(true);
  });

  it('marks a matching header service token as a service identity', async () => {
    const result = await checkAdminPermissions(
      new NextRequest('http://localhost/api/admin/vectorize', {
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
