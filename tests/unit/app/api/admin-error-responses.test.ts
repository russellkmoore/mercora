import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkAdminPermissions: vi.fn(),
  getCloudflareContext: vi.fn(),
  getDbAsync: vi.fn(),
  getPages: vi.fn(),
  createPage: vi.fn(),
  getPageStats: vi.fn(),
  searchPages: vi.fn(),
  getPageById: vi.fn(),
  updatePage: vi.fn(),
  deletePage: vi.fn(),
  getPageVersions: vi.fn(),
  publishPage: vi.fn(),
  unpublishPage: vi.fn(),
  archivePage: vi.fn(),
  recordReviewFlag: vi.fn(),
  respondToReview: vi.fn(),
  updateReviewStatus: vi.fn(),
  media: {
    list: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/auth/admin-middleware', () => ({
  checkAdminPermissions: mocks.checkAdminPermissions,
}));
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));
vi.mock('@/lib/db', () => ({ getDbAsync: mocks.getDbAsync }));
vi.mock('@/lib/models/pages', () => ({
  getPages: mocks.getPages,
  createPage: mocks.createPage,
  getPageStats: mocks.getPageStats,
  searchPages: mocks.searchPages,
  getPageById: mocks.getPageById,
  updatePage: mocks.updatePage,
  deletePage: mocks.deletePage,
  getPageVersions: mocks.getPageVersions,
  publishPage: mocks.publishPage,
  unpublishPage: mocks.unpublishPage,
  archivePage: mocks.archivePage,
  PAGE_STATUS: { PUBLISHED: 'published', DRAFT: 'draft', ARCHIVED: 'archived' },
}));
vi.mock('@/lib/models/reviews', () => ({
  recordReviewFlag: mocks.recordReviewFlag,
  respondToReview: mocks.respondToReview,
  updateReviewStatus: mocks.updateReviewStatus,
}));

import { NextRequest } from 'next/server';
import { GET as GET_KNOWLEDGE } from '@/app/api/admin/knowledge/route';
import { POST as UPDATE_VECTORIZE_STATUS } from '@/app/api/admin/knowledge/vectorize-status/route';
import {
  GET as GET_VECTORIZE,
  POST as RUN_VECTORIZE,
} from '@/app/api/admin/vectorize/route';
import { POST as CREATE_PAGE } from '@/app/api/admin/pages/route';
import { PUT as UPDATE_PAGE } from '@/app/api/admin/pages/[id]/route';
import { PATCH as UPDATE_REVIEW } from '@/app/api/admin/reviews/[id]/route';

function jsonRequest(url: string, method: string, body: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('admin route error responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
    mocks.checkAdminPermissions.mockResolvedValue({ success: true, userId: 'admin-1' });
    mocks.getCloudflareContext.mockResolvedValue({ env: { MEDIA: mocks.media } });
  });

  afterEach(() => vi.unstubAllEnvs());

  it('masks knowledge GET storage errors in production', async () => {
    mocks.media.list.mockRejectedValue(new Error('R2 secret knowledge failure'));

    const response = await GET_KNOWLEDGE(
      new NextRequest('http://localhost/api/admin/knowledge')
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to fetch knowledge articles' });
    expect(JSON.stringify(body)).not.toContain('R2 secret');
  });

  it('includes knowledge GET storage details in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    mocks.media.list.mockRejectedValue(new Error('local R2 diagnostic'));

    const response = await GET_KNOWLEDGE(
      new NextRequest('http://localhost/api/admin/knowledge')
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to fetch knowledge articles',
      details: 'local R2 diagnostic',
    });
  });

  it('masks vectorize-status storage errors in production', async () => {
    mocks.media.get.mockRejectedValue(new Error('R2 object metadata secret'));

    const response = await UPDATE_VECTORIZE_STATUS(jsonRequest(
      'http://localhost/api/admin/knowledge/vectorize-status',
      'POST',
      { filename: 'article.md', vectorized: true }
    ));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to update vectorization status' });
    expect(JSON.stringify(body)).not.toContain('metadata secret');
  });

  it('masks vectorize binding errors in production', async () => {
    mocks.getCloudflareContext.mockRejectedValueOnce(new Error('Cloudflare binding secret'));

    const response = await RUN_VECTORIZE(
      new NextRequest('http://localhost/api/admin/vectorize', { method: 'POST' })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(body)).not.toContain('binding secret');
  });

  it('rejects vectorize GET without authenticating or mutating bindings', async () => {
    const response = await GET_VECTORIZE();

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(mocks.checkAdminPermissions).not.toHaveBeenCalled();
    expect(mocks.getCloudflareContext).not.toHaveBeenCalled();
    expect(mocks.getDbAsync).not.toHaveBeenCalled();
  });

  it('allows a service-authenticated vectorize POST without Origin', async () => {
    const vectorize = {
      query: vi.fn().mockResolvedValue({ matches: [] }),
      deleteByIds: vi.fn(),
      upsert: vi.fn(),
    };
    const ai = { run: vi.fn() };
    mocks.checkAdminPermissions.mockResolvedValueOnce({
      success: true,
      userId: 'admin-service',
      isServiceToken: true,
    });
    mocks.media.list.mockResolvedValue({ objects: [] });
    mocks.getCloudflareContext.mockResolvedValueOnce({
      env: { MEDIA: mocks.media, VECTORIZE: vectorize, AI: ai },
    });
    mocks.getDbAsync.mockResolvedValueOnce({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([]),
      }),
    });

    const response = await RUN_VECTORIZE(new NextRequest(
      'http://localhost/api/admin/vectorize',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer service-secret' },
      }
    ));

    expect(response.status).toBe(200);
    expect(vectorize.query).toHaveBeenCalledTimes(1);
    expect(mocks.getDbAsync).toHaveBeenCalledTimes(1);
  });

  it.each([
    'Title is required',
    'Content is required',
    'Content is required after sanitization',
    'Invalid page data: Invalid status',
  ])('preserves page-create validation %j as a 400', async (message) => {
    mocks.createPage.mockRejectedValue(new Error(message));

    const response = await CREATE_PAGE(jsonRequest(
      'http://localhost/api/admin/pages',
      'POST',
      { title: 'Page', content: '<p>Content</p>' }
    ));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: message });
  });

  it('masks arbitrary page-create errors in production', async () => {
    mocks.createPage.mockRejectedValue(new Error('database URL page create'));

    const response = await CREATE_PAGE(jsonRequest(
      'http://localhost/api/admin/pages',
      'POST',
      { title: 'Page', content: '<p>Content</p>' }
    ));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ success: false, error: 'Failed to create page' });
    expect(JSON.stringify(body)).not.toContain('database URL');
  });

  it('preserves page-update model validation as a 400', async () => {
    mocks.updatePage.mockRejectedValue(new Error('Invalid page data: Invalid status'));

    const response = await UPDATE_PAGE(
      jsonRequest('http://localhost/api/admin/pages/7', 'PUT', { status: 'invalid' }),
      { params: Promise.resolve({ id: '7' }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Invalid page data: Invalid status',
    });
  });

  it('masks arbitrary page-update errors in production', async () => {
    mocks.updatePage.mockRejectedValue(new Error('SQL page update secret'));

    const response = await UPDATE_PAGE(
      jsonRequest('http://localhost/api/admin/pages/7', 'PUT', { title: 'Updated' }),
      { params: Promise.resolve({ id: '7' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ success: false, error: 'Failed to update page' });
    expect(JSON.stringify(body)).not.toContain('SQL page');
  });

  it('preserves the exact review-not-found model condition as a 404', async () => {
    mocks.updateReviewStatus.mockRejectedValue(new Error('Review not found.'));

    const response = await UPDATE_REVIEW(
      jsonRequest('http://localhost/api/admin/reviews/rev-1', 'PATCH', { status: 'approved' }),
      { params: Promise.resolve({ id: 'rev-1' }) }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, error: 'Review not found.' });
  });

  it('masks arbitrary review model errors in production', async () => {
    mocks.updateReviewStatus.mockRejectedValue(new Error('review database DSN'));

    const response = await UPDATE_REVIEW(
      jsonRequest('http://localhost/api/admin/reviews/rev-1', 'PATCH', { status: 'approved' }),
      { params: Promise.resolve({ id: 'rev-1' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ success: false, error: 'Unable to update review' });
    expect(JSON.stringify(body)).not.toContain('database DSN');
  });
});
