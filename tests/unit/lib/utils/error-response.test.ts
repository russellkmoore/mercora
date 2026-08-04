import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorDetails } from '@/lib/utils/error-response';

describe('errorDetails', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(['production', 'test'])('omits Error details in %s', (environment) => {
    vi.stubEnv('NODE_ENV', environment);

    expect(errorDetails(new Error('postgres password=secret'))).toEqual({});
  });

  it('returns an Error message only in development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(errorDetails(new Error('local diagnostic'))).toEqual({
      details: 'local diagnostic',
    });
  });

  it('stringifies a non-Error detail only in development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(errorDetails('raw failure')).toEqual({ details: 'raw failure' });
  });

  it('restores the prior environment after a stub is removed', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    vi.stubEnv('NODE_ENV', 'development');
    expect(errorDetails(new Error('visible locally'))).toEqual({ details: 'visible locally' });

    vi.unstubAllEnvs();
    expect(process.env.NODE_ENV).toBe(originalNodeEnv);
    expect(errorDetails(new Error('hidden again'))).toEqual({});
  });
});
