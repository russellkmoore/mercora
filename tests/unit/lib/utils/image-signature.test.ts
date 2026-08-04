import { describe, expect, it } from 'vitest';
import { EXT_BY_MIME, matchesImageSignature } from '@/lib/utils/image-signature';

const bytes = (...values: number[]) => new Uint8Array(values);

describe('image MIME policy', () => {
  it('allows only JPEG, PNG, and WebP storage extensions', () => {
    expect(EXT_BY_MIME).toEqual({
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    });
    expect(EXT_BY_MIME['image/gif']).toBeUndefined();
    expect(EXT_BY_MIME['image/svg+xml']).toBeUndefined();
  });

  it.each([
    ['image/png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)],
    ['image/jpeg', bytes(0xff, 0xd8, 0xff, 0xe0)],
    ['image/jpg', bytes(0xff, 0xd8, 0xff)],
    ['image/webp', bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50)],
  ] as const)('accepts a valid %s signature', (mime, signature) => {
    expect(matchesImageSignature(signature, mime)).toBe(true);
  });

  it('recognizes GIF bytes as a helper fact while upload policy rejects GIF', () => {
    const gif = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
    expect(matchesImageSignature(gif, 'image/gif')).toBe(true);
    expect(EXT_BY_MIME['image/gif']).toBeUndefined();
  });

  it('rejects declared MIME and magic-byte mismatches', () => {
    expect(matchesImageSignature(bytes(0xff, 0xd8, 0xff), 'image/png')).toBe(false);
    expect(
      matchesImageSignature(new TextEncoder().encode('<svg></svg>'), 'image/png')
    ).toBe(false);
    expect(matchesImageSignature(bytes(0x89, 0x50), 'image/png')).toBe(false);
    expect(matchesImageSignature(bytes(0x89, 0x50, 0x4e, 0x47), 'image/svg+xml')).toBe(false);
  });
});
