import { describe, expect, it } from 'vitest';
import { sha256Hex, timingSafeEqual } from '@/lib/auth/crypto';

describe('auth crypto helpers', () => {
  it('compares equal and unequal secrets through fixed-length digests', async () => {
    await expect(timingSafeEqual('service-secret', 'service-secret')).resolves.toBe(true);
    await expect(timingSafeEqual('service-secret', 'service-secreX')).resolves.toBe(false);
    await expect(timingSafeEqual('short', 'a-much-longer-secret')).resolves.toBe(false);
    await expect(timingSafeEqual('non-empty', '')).resolves.toBe(false);
  });

  it('produces a stable SHA-256 hex digest', async () => {
    await expect(sha256Hex('mercora')).resolves.toMatch(/^[a-f0-9]{64}$/);
    await expect(sha256Hex('mercora')).resolves.toBe(await sha256Hex('mercora'));
  });
});
