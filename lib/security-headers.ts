import { resolveStoreConfig, type Environment } from './store-config';

export type SecurityHeader = { key: string; value: string };

const CLERK_RUNTIME_SOURCES = [
  'https://*.clerk.accounts.dev',
  'https://*.clerk.com',
  'https://*.clerk.dev',
  'https://*.clerkstage.dev',
  'https://*.protect.clerk.com',
];

const STRIPE_SCRIPT_SOURCES = [
  'https://js.stripe.com',
  'https://*.js.stripe.com',
  'https://checkout.stripe.com',
  'https://connect-js.stripe.com',
];

function directive(name: string, values: string[]): string {
  return `${name} ${[...new Set(values)].join(' ')}`;
}

/** Build a static CSP from validated public store configuration. */
export function contentSecurityPolicy(env: Environment = process.env): string {
  const store = resolveStoreConfig(env);
  const imageCdn = store.urls.imageCdn ? [store.urls.imageCdn] : [];
  const clerkHost = store.urls.clerkHost ? [store.urls.clerkHost] : [];
  const developmentScriptSources = env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : [];

  return [
    directive('default-src', ["'self'"]),
    directive('script-src', [
      "'self'",
      // Next.js bootstrapping and Clerk's browser SDK currently require inline scripts.
      "'unsafe-inline'",
      ...developmentScriptSources,
      ...STRIPE_SCRIPT_SOURCES,
      ...CLERK_RUNTIME_SOURCES,
      ...clerkHost,
      'https://challenges.cloudflare.com',
      'https://static.cloudflareinsights.com',
    ]),
    directive('style-src', [
      "'self'",
      // Next.js and Clerk emit runtime styles; nonces can replace this in a future dynamic CSP.
      "'unsafe-inline'",
    ]),
    directive('object-src', ["'none'"]),
    directive('base-uri', ["'self'"]),
    directive('form-action', ["'self'"]),
    directive('frame-ancestors', ["'none'"]),
    directive('worker-src', ["'self'", 'blob:']),
    directive('media-src', ["'self'", 'blob:', ...imageCdn]),
    directive('font-src', ["'self'", 'data:']),
    directive('img-src', [
      "'self'",
      'data:',
      'blob:',
      ...imageCdn,
      'https://img.clerk.com',
      'https://images.clerkstage.dev',
      'https://*.stripe.com',
    ]),
    directive('connect-src', [
      "'self'",
      ...CLERK_RUNTIME_SOURCES,
      ...clerkHost,
      'https://clerk-telemetry.com',
      'https://*.clerk-telemetry.com',
      'https://img.clerk.com',
      'https://images.clerkstage.dev',
      'https://api.stripe.com',
      'https://checkout.stripe.com',
      'https://maps.stripe.com',
      'https://r.stripe.com',
      'https://cloudflareinsights.com',
    ]),
    directive('frame-src', [
      "'self'",
      ...CLERK_RUNTIME_SOURCES,
      ...clerkHost,
      'https://challenges.cloudflare.com',
      'https://js.stripe.com',
      'https://*.js.stripe.com',
      'https://hooks.stripe.com',
      'https://checkout.stripe.com',
      'https://connect-js.stripe.com',
    ]),
    directive('manifest-src', ["'self'"]),
  ].join('; ');
}

export function buildSecurityHeaders(env: Environment = process.env): SecurityHeader[] {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(env) },
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: [
        'accelerometer=()',
        'browsing-topics=()',
        'camera=()',
        'geolocation=()',
        'gyroscope=()',
        'interest-cohort=()',
        'magnetometer=()',
        'microphone=()',
        'payment=(self "https://js.stripe.com")',
        'usb=()',
      ].join(', '),
    },
  ];
}
