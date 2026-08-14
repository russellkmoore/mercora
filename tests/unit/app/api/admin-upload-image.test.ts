import { beforeEach, describe, expect, it, vi } from 'vitest';

const { bucket, getCloudflareContext, uploadToR2 } = vi.hoisted(() => ({
  bucket: { put: vi.fn() },
  getCloudflareContext: vi.fn(),
  uploadToR2: vi.fn(),
}));

vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext }));

vi.mock('@/lib/auth/admin-middleware', () => ({
  checkAdminPermissions: vi.fn().mockResolvedValue({
    success: true,
    userId: 'admin-1',
  }),
}));
vi.mock('@/lib/utils/r2', () => ({
  uploadToR2,
  generateR2Path: (folder: string, filename: string) => `${folder}/${filename}`,
  R2_FOLDERS: {
    PRODUCTS: 'products',
    CATEGORIES: 'categories',
    BLOG: 'blog',
  },
}));
vi.mock('@/lib/store-config', () => ({
  getStoreConfig: () => ({ urls: { imageCdn: 'https://images.example.test' } }),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/upload-image/route';

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);
const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const webpBytes = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);
const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

function uploadRequest(options: {
  bytes?: Uint8Array;
  declaredType?: string;
  originalName?: string;
  folder?: string;
  filename?: string;
} = {}): NextRequest {
  const formData = new FormData();
  const bytes = options.bytes ?? pngBytes;
  const fileBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  formData.set('file', new File(
    [fileBuffer],
    options.originalName ?? 'client-name.svg',
    { type: options.declaredType ?? 'image/png' }
  ));
  formData.set('folder', options.folder ?? 'products');
  formData.set('filename', options.filename ?? 'trail-pack');

  return new NextRequest('http://localhost/api/admin/upload-image', {
    method: 'POST',
    body: formData,
  });
}

describe('admin image upload validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCloudflareContext.mockResolvedValue({ env: { MEDIA: bucket } });
  });

  it('rejects unsafe filename segments before an R2 write', async () => {
    const response = await POST(uploadRequest({ filename: '../escape' }));

    expect(response.status).toBe(400);
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it('rejects declared MIME and actual-byte mismatches before an R2 write', async () => {
    const response = await POST(uploadRequest({
      bytes: new TextEncoder().encode('<svg></svg>'),
      declaredType: 'image/png',
    }));

    expect(response.status).toBe(400);
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it('rejects GIF even when its signature is valid', async () => {
    const response = await POST(uploadRequest({
      bytes: gifBytes,
      declaredType: 'image/gif',
      originalName: 'animation.gif',
    }));

    expect(response.status).toBe(400);
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it('rejects an empty image before an R2 write', async () => {
    const response = await POST(uploadRequest({ bytes: new Uint8Array() }));

    expect(response.status).toBe(400);
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it('rejects an image larger than 10MB before an R2 write', async () => {
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    oversized.set(pngBytes);

    const response = await POST(uploadRequest({ bytes: oversized }));

    expect(response.status).toBe(400);
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it.each([
    { declaredType: 'image/png', bytes: pngBytes, extension: 'png', storedType: 'image/png' },
    { declaredType: 'image/jpeg', bytes: jpegBytes, extension: 'jpg', storedType: 'image/jpeg' },
    { declaredType: 'image/jpg', bytes: jpegBytes, extension: 'jpg', storedType: 'image/jpeg' },
    { declaredType: 'image/webp', bytes: webpBytes, extension: 'webp', storedType: 'image/webp' },
  ])(
    'stores verified $declaredType bytes under a safe .$extension key as $storedType',
    async ({ declaredType, bytes, extension, storedType }) => {
      const response = await POST(uploadRequest({ declaredType, bytes }));
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(uploadToR2).toHaveBeenCalledTimes(1);

      const [, key, , options] = uploadToR2.mock.calls[0];
      expect(key).toMatch(new RegExp(
        `^products/trail-pack-\\d+-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.${extension}$`
      ));
      expect(key).not.toContain('.svg');
      expect(options).toMatchObject({ contentType: storedType });
      expect(body.path).toBe(`/${key}`);
      expect(body.url).toBe(`https://images.example.test/${key}`);
      expect(body.filename).toBe(key.slice('products/'.length));
      expect(body.type).toBe(storedType);
    }
  );

  it('uses the same verified upload pipeline for blog media', async () => {
    const response = await POST(uploadRequest({ folder: 'blog', filename: 'launch-update' }));
    expect(response.status).toBe(200);
    expect(uploadToR2.mock.calls[0][1]).toMatch(/^blog\/launch-update-/);
  });
});
