import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEPLOYMENT_GUARD_MESSAGE,
  assertDeploymentPosture,
  isDeployedDevelopmentBuild,
} from '@/lib/auth/deployment-guard';

describe('deployment guard boundaries', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('trips when the runtime is Workers and the build is development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });

    const result = assertDeploymentPosture();

    expect(result.tripped).toBe(true);
    expect(result).toMatchObject({ tripped: true, status: 503, message: DEPLOYMENT_GUARD_MESSAGE });
  });

  it('does not trip when the runtime is Workers and the build is production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });

    expect(isDeployedDevelopmentBuild()).toBe(false);
    expect(assertDeploymentPosture()).toEqual({ tripped: false });
  });

  it('does not trip when the runtime is Workers and the build is test', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });

    expect(isDeployedDevelopmentBuild()).toBe(false);
  });

  it('does not trip under Node native user-agent and development (local development)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    // navigator left as Node's native value, not stubbed

    expect(isDeployedDevelopmentBuild()).toBe(false);
    expect(assertDeploymentPosture()).toEqual({ tripped: false });
  });

  it('does not trip on a user-agent that merely starts with the Workers value', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers-Extended' });

    expect(isDeployedDevelopmentBuild()).toBe(false);
  });

  it('does not trip on a user-agent that contains the Workers value as a substring', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('navigator', { userAgent: 'prefix-Cloudflare-Workers-suffix' });

    expect(isDeployedDevelopmentBuild()).toBe(false);
  });

  it('does not trip when NODE_ENV starts with but does not equal the development string', () => {
    vi.stubEnv('NODE_ENV', 'development-preview');
    vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });

    expect(isDeployedDevelopmentBuild()).toBe(false);
  });

  it('does not trip and does not throw when navigator is undefined', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('navigator', undefined);

    expect(() => isDeployedDevelopmentBuild()).not.toThrow();
    expect(isDeployedDevelopmentBuild()).toBe(false);
  });

  it('does not trip and does not throw when navigator.userAgent is an empty string', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('navigator', { userAgent: '' });

    expect(() => isDeployedDevelopmentBuild()).not.toThrow();
    expect(isDeployedDevelopmentBuild()).toBe(false);
  });

  it('does not trip and does not throw when navigator has no userAgent property', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('navigator', {});

    expect(() => isDeployedDevelopmentBuild()).not.toThrow();
    expect(isDeployedDevelopmentBuild()).toBe(false);
  });

  it('leaks no environment detail in the tripped message', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });

    const result = assertDeploymentPosture();

    expect(result.tripped).toBe(true);
    const message = result.tripped ? result.message : '';
    expect(message).toBe(DEPLOYMENT_GUARD_MESSAGE);
    expect(message).not.toContain('development');
    expect(message).not.toContain('Cloudflare');
  });

  it('returns equal verdicts across consecutive calls under identical stubs', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });

    const first = assertDeploymentPosture();
    const second = assertDeploymentPosture();

    expect(first).toEqual(second);
  });
});
