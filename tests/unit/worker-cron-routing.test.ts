import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Worker scheduled routing contract', () => {
  it('routes only the known five-minute and six-hour schedules', () => {
    const source = readFileSync('worker.ts', 'utf8');
    const config = readFileSync('wrangler.jsonc', 'utf8');

    expect(config).toContain('"crons": ["*/5 * * * *", "0 */6 * * *"]');
    expect(source).toContain('controller.cron === "*/5 * * * *"');
    expect(source).toContain('drainOrderEffects({ database: env.DB, limit: 25 })');
    expect(source).toContain('drainInventoryAdjustments({ database: env.DB, limit: 25 })');
    expect(source).toContain('Promise.all([');
    expect(source).toContain('controller.cron !== "0 */6 * * *"');
    expect(source).toContain('ignoring unknown scheduled trigger');
    expect(source.indexOf('controller.cron !== "0 */6 * * *"'))
      .toBeLessThan(source.indexOf('regenerateAnalytics(env)'));
  });
});
