/// <reference types="@cloudflare/vitest-pool-workers/types" />

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: Array<{
        name: string;
        queries: string[];
      }>;
    }
  }
}

export {};
