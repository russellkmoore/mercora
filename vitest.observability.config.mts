import { fileURLToPath } from 'node:url';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: './workers/observability-tail/src/index.ts',
      miniflare: {
        // Keep the local pool on the newest date supported by its pinned workerd.
        compatibilityDate: '2026-08-06',
        compatibilityFlags: ['nodejs_compat'],
        durableObjects: {
          ALERT_COOLDOWN: { className: 'AlertCooldown', useSQLite: true },
        },
      },
    }),
  ],
  test: {
    include: ['tests/workers/**/*.test.ts'],
    clearMocks: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
