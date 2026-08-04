import { describe, expect, it } from 'vitest';
import { hasSameOrigin } from '@/lib/auth/same-origin';

function request(origin: string | null, requestOrigin = 'https://store.example.test') {
  return {
    headers: { get: () => origin },
    nextUrl: { origin: requestOrigin },
  };
}

describe('hasSameOrigin', () => {
  it.each([
    'https://store.example.test',
    'https://store.example.test/',
    'https://store.example.test:443',
  ])('accepts normalized exact origin %s', (origin) => {
    expect(hasSameOrigin(request(origin))).toBe(true);
  });

  it.each([
    null,
    'null',
    'https://other.example.test',
    'http://store.example.test',
    'https://store.example.test.evil',
    'https://store.example.test/path',
    'https://store.example.test?query=1',
    'https://user@store.example.test',
    'data:text/plain,origin',
    'not a URL',
  ])('rejects absent, malformed, or non-matching origin %j', (origin) => {
    expect(hasSameOrigin(request(origin))).toBe(false);
  });
});
