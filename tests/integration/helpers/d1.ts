import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';

export async function applyTestMigrations(): Promise<void> {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
}
