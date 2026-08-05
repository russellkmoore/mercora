import { describe, expect, it } from 'vitest';
import {
  buildSecurityHeaders,
  contentSecurityPolicy,
} from '@/lib/security-headers';

function directives(policy: string): Record<string, string[]> {
  return Object.fromEntries(policy.split('; ').map((entry) => {
    const [name, ...values] = entry.split(' ');
    return [name, values];
  }));
}

describe('contentSecurityPolicy', () => {
  it('places exact normalized configured hosts only in their intended directives', () => {
    const policy = directives(contentSecurityPolicy({
      NODE_ENV: 'production',
      NEXT_PUBLIC_IMAGE_CDN: 'https://media.example.test/assets',
      NEXT_PUBLIC_CLERK_HOST: 'https://clerk.example.test/fapi',
    }));

    expect(policy['img-src']).toContain('https://media.example.test');
    expect(policy['media-src']).toContain('https://media.example.test');
    expect(policy['script-src']).not.toContain('https://media.example.test');
    expect(policy['connect-src']).toContain('https://clerk.example.test');
    expect(policy['script-src']).toContain('https://clerk.example.test');
    expect(policy['frame-src']).toContain('https://clerk.example.test');
  });

  it('does not add a custom store or CDN host when optional config is unset', () => {
    const policy = contentSecurityPolicy({ NODE_ENV: 'production' });

    expect(policy).not.toMatch(/custom-store|demo-cdn|shop\.example\.com/i);
  });

  it('cannot inject CSP tokens or newlines through invalid or path config', () => {
    const policy = contentSecurityPolicy({
      NODE_ENV: 'production',
      NEXT_PUBLIC_IMAGE_CDN: 'https://media.example.test/; script-src https://evil.example',
      NEXT_PUBLIC_CLERK_HOST: 'http://insecure.example.test/\nframe-src *',
    });

    expect(policy).toContain('https://media.example.test');
    expect(policy).not.toContain('evil.example');
    expect(policy).not.toContain('insecure.example.test');
    expect(policy).not.toMatch(/[\r\n]/);
  });

  it('allows unsafe-eval only in development', () => {
    expect(directives(contentSecurityPolicy({ NODE_ENV: 'development' }))['script-src'])
      .toContain("'unsafe-eval'");
    expect(directives(contentSecurityPolicy({ NODE_ENV: 'production' }))['script-src'])
      .not.toContain("'unsafe-eval'");
  });

  it('covers the required Clerk, Stripe, Turnstile, and Insights sources', () => {
    const policy = directives(contentSecurityPolicy({ NODE_ENV: 'production' }));

    expect(policy['script-src']).toEqual(expect.arrayContaining([
      'https://*.clerk.accounts.dev',
      'https://*.clerk.com',
      'https://*.protect.clerk.com',
      'https://js.stripe.com',
      'https://checkout.stripe.com',
      'https://challenges.cloudflare.com',
      'https://static.cloudflareinsights.com',
    ]));
    expect(policy['connect-src']).toEqual(expect.arrayContaining([
      'https://clerk-telemetry.com',
      'https://*.clerk-telemetry.com',
      'https://api.stripe.com',
      'https://maps.stripe.com',
      'https://r.stripe.com',
      'https://cloudflareinsights.com',
    ]));
    expect(policy['img-src']).toEqual(expect.arrayContaining([
      'https://img.clerk.com',
      'https://images.clerkstage.dev',
      'https://*.stripe.com',
    ]));
    expect(policy['frame-src']).toEqual(expect.arrayContaining([
      'https://challenges.cloudflare.com',
      'https://js.stripe.com',
      'https://hooks.stripe.com',
    ]));
  });

  it('includes the core restrictive directives', () => {
    const policy = directives(contentSecurityPolicy({ NODE_ENV: 'production' }));

    expect(policy).toMatchObject({
      'default-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'worker-src': ["'self'", 'blob:'],
      'font-src': ["'self'", 'data:'],
    });
    expect(policy['script-src']).toContain("'unsafe-inline'");
    expect(policy['style-src']).toEqual(["'self'", "'unsafe-inline'"]);
    expect(policy['img-src']).toContain("'self'");
    expect(policy['connect-src']).toContain("'self'");
    expect(policy['frame-src']).toContain("'self'");
    expect(policy['media-src']).toContain("'self'");
  });
});

describe('buildSecurityHeaders', () => {
  it('returns the complete global security header set', () => {
    const headers = Object.fromEntries(
      buildSecurityHeaders({ NODE_ENV: 'production' }).map(({ key, value }) => [key, value])
    );

    expect(Object.keys(headers)).toEqual([
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
    ]);
    expect(headers['Strict-Transport-Security'])
      .toBe('max-age=63072000; includeSubDomains; preload');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toContain('camera=()');
    expect(headers['Permissions-Policy']).toContain('microphone=()');
    expect(headers['Permissions-Policy']).toContain('payment=(self "https://js.stripe.com")');
  });
});
