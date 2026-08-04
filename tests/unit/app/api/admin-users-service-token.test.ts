import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkAdminPermissions: vi.fn(),
  getAllAdminUsers: vi.fn(),
  addAdminUser: vi.fn(),
  removeAdminUser: vi.fn(),
  getAdminUser: vi.fn(),
}));

vi.mock('@/lib/auth/admin-middleware', () => ({
  checkAdminPermissions: mocks.checkAdminPermissions,
}));
vi.mock('@/lib/models/admin', () => ({
  getAllAdminUsers: mocks.getAllAdminUsers,
  addAdminUser: mocks.addAdminUser,
  removeAdminUser: mocks.removeAdminUser,
  getAdminUser: mocks.getAdminUser,
}));

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/users/route';

describe('admin user service-identity restrictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAdminPermissions.mockResolvedValue({
      success: true,
      userId: 'interactive-admin',
    });
  });

  it('denies service-token GET before reading admin users', async () => {
    mocks.checkAdminPermissions.mockResolvedValueOnce({
      success: true,
      userId: 'admin-service',
      isServiceToken: true,
    });

    const response = await GET(new NextRequest('http://localhost/api/admin/users'));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Service credentials cannot manage admin users',
    });
    expect(mocks.getAllAdminUsers).not.toHaveBeenCalled();
  });

  it('denies service-token POST before reading or writing admin users', async () => {
    mocks.checkAdminPermissions.mockResolvedValueOnce({
      success: true,
      userId: 'admin-service',
      isServiceToken: true,
    });
    const request = new NextRequest('http://localhost/api/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'add', userId: 'user_newadmin' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(mocks.getAdminUser).not.toHaveBeenCalled();
    expect(mocks.addAdminUser).not.toHaveBeenCalled();
    expect(mocks.removeAdminUser).not.toHaveBeenCalled();
  });

  it('allows an interactive admin to list users', async () => {
    const admin = { userId: 'user_one', role: 'admin' };
    mocks.getAllAdminUsers.mockResolvedValue([admin]);

    const response = await GET(new NextRequest('http://localhost/api/admin/users'));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      adminUsers: ['user_one'],
      adminUserDetails: [admin],
      count: 1,
    });
  });

  it('allows an interactive admin to add a user', async () => {
    const newAdmin = { userId: 'user_newadmin', role: 'admin' };
    mocks.getAdminUser.mockResolvedValue(null);
    mocks.addAdminUser.mockResolvedValue(newAdmin);
    const request = new NextRequest('http://localhost/api/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        userId: 'user_newadmin',
        email: 'admin@example.test',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.addAdminUser).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_newadmin',
      createdBy: 'interactive-admin',
    }));
    expect(await response.json()).toMatchObject({ user: newAdmin });
  });
});
