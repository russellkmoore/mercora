import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  resolveHonorEffective: vi.fn(),
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));
// The unit under test is `runtime.ts`; the money decision is its collaborator.
// `resolveHonorEffective` owns that decision now (D-18), so it is what gets
// stubbed here — and the short-circuit these tests used to assert through a
// mock is asserted against the real function in
// `tests/integration/lib/gift-cards/honor-guard.test.ts`, where a database that
// throws on any read proves it is never consulted. That is stronger.
vi.mock('@/lib/gift-cards/honor-guard', () => ({
  resolveHonorEffective: mocks.resolveHonorEffective,
}));

import {
  CommerceCapabilityConfigurationError,
  CommerceCapabilityDisabledError,
  noOpCommerceCapabilities,
} from '@/lib/commerce/capabilities';
import { resolveRuntimeCommerceCapabilities } from '@/lib/commerce/runtime';
import { Money } from '@/lib/money';

const database = { prepare: vi.fn() };

/** A worker environment with the two gift-card flags set explicitly. */
function environment(flags: { sell: boolean; honor: boolean }) {
  mocks.getCloudflareContext.mockResolvedValue({
    env: {
      DB: database,
      STORE_FEATURE_GIFT_CARD_ACQUISITION: String(flags.sell),
      STORE_FEATURE_GIFT_CARD_RECONCILIATION: String(flags.honor),
    },
  });
}

/** Present a nonempty bearer code and return whatever comes back. */
async function offerBearerCode(capability: { resolveTender: (args: {
  token?: string; currency: string; amountDue: Money;
}) => Promise<unknown> }) {
  return capability
    .resolveTender({ token: 'gc_some_bearer_code', currency: 'USD', amountDue: Money.zero('USD') })
    .then((value) => value, (error: unknown) => error);
}

beforeEach(() => {
  mocks.resolveHonorEffective.mockResolvedValue(true);
});

describe('runtime honor override', () => {
  it('never reads the guard while honoring is configured on', async () => {
    environment({ sell: false, honor: true });

    const resolved = await resolveRuntimeCommerceCapabilities();

    // The decision function is still called — it is the only owner of the
    // answer — but it is handed honor=true, which is the input that makes it
    // return without touching D1.
    expect(mocks.resolveHonorEffective).toHaveBeenCalledWith(
      database,
      { giftCardAcquisition: false, giftCardReconciliation: true },
      expect.any(Number),
    );
    expect(resolved.giftCards).not.toBe(noOpCommerceCapabilities.giftCards);
  });

  it('keeps honoring while the guard says balances may still exist', async () => {
    environment({ sell: false, honor: false });
    mocks.resolveHonorEffective.mockResolvedValue(true);

    const resolved = await resolveRuntimeCommerceCapabilities();

    expect(mocks.resolveHonorEffective).toHaveBeenCalledTimes(1);
    const [passedDatabase, passedFlags, nowSeconds] = mocks.resolveHonorEffective.mock.calls[0];
    expect(passedDatabase).toBe(database);
    // Both configured flags reach the decision unmodified. That is what makes
    // its sell-on short-circuit reachable from here at all.
    expect(passedFlags).toEqual({ giftCardAcquisition: false, giftCardReconciliation: false });
    expect(nowSeconds).toBeTypeOf('number');

    expect(resolved.giftCards).not.toBe(noOpCommerceCapabilities.giftCards);
    // Delegated to the real capability, which fails on its own missing runtime
    // rather than refusing the code the way the inert boundary would.
    expect(await offerBearerCode(resolved.giftCards))
      .not.toBeInstanceOf(CommerceCapabilityDisabledError);
  });

  it('stops honoring once the guard reports a fresh, empty measurement', async () => {
    environment({ sell: false, honor: false });
    mocks.resolveHonorEffective.mockResolvedValue(false);

    const resolved = await resolveRuntimeCommerceCapabilities();

    expect(resolved.giftCards).toBe(noOpCommerceCapabilities.giftCards);
    expect(await offerBearerCode(resolved.giftCards))
      .toBeInstanceOf(CommerceCapabilityDisabledError);
  });

  it('still refuses to sell cards it cannot honor, whatever the guard would say', async () => {
    environment({ sell: true, honor: false });
    // What the real decision returns in this state, and why it must: answering
    // "keep honoring" here would resolve a deploy that sells cards it cannot
    // redeem into a clean capability set, erasing GCF-04 silently. The
    // short-circuit that guarantees it — sell on means the guard is never even
    // read — is asserted against the real function in
    // tests/integration/lib/gift-cards/honor-guard.test.ts.
    mocks.resolveHonorEffective.mockResolvedValue(false);

    await expect(resolveRuntimeCommerceCapabilities())
      .rejects.toBeInstanceOf(CommerceCapabilityConfigurationError);
    // Both flags reach the decision unmodified, which is what makes its
    // sell-on branch reachable from this call site at all.
    expect(mocks.resolveHonorEffective).toHaveBeenCalledWith(
      database,
      { giftCardAcquisition: true, giftCardReconciliation: false },
      expect.any(Number),
    );
  });

  it('keeps honoring when the guard read fails outright', async () => {
    environment({ sell: false, honor: false });
    mocks.resolveHonorEffective.mockRejectedValue(new Error('admin_settings unreadable'));

    const resolved = await resolveRuntimeCommerceCapabilities();

    expect(resolved.giftCards).not.toBe(noOpCommerceCapabilities.giftCards);
  });
});
