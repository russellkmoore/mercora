import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = readFileSync(join(root, 'lib/services/order-effects.ts'), 'utf8');

// The exact fragment the fulfilment service's own doc comment (D-02,
// gift-card-fulfillment.ts emailEnvironmentFrom) calls "strictly worse than
// handing over nothing" — an environment rich enough to switch off the
// sender's own context lookup but carrying neither key ring the fulfilment
// service needs before any email step.
const FORBIDDEN_DATABASE_ONLY_FALLBACK = '{ DB: runtime.database }';

describe('gift-card effect environment contract (D-02)', () => {
  it('passes the runtime gift-card environment straight through to fulfillPaidGiftCards', () => {
    expect(source).toContain('environment: runtime.giftCardEnvironment,');
  });

  it('never reconstructs a database-only stand-in environment', () => {
    expect(source).not.toContain(FORBIDDEN_DATABASE_ONLY_FALLBACK);
  });

  it('still documents giftCardEnvironment as the full worker environment', () => {
    expect(source).toContain('Full Worker environment for encrypted gift-card issuance/delivery.');
  });
});
