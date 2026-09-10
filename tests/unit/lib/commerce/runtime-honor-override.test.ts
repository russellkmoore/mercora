import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  honorIsEffectivelyOn: vi.fn(),
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));
vi.mock('@/lib/gift-cards/honor-guard', () => ({
  honorIsEffectivelyOn: mocks.honorIsEffectivelyOn,
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
  mocks.honorIsEffectivelyOn.mockResolvedValue(true);
});

describe('runtime honor override', () => {
  it('never reads the guard while honoring is configured on', async () => {
    environment({ sell: false, honor: true });

    const resolved = await resolveRuntimeCommerceCapabilities();

    expect(mocks.honorIsEffectivelyOn).not.toHaveBeenCalled();
    expect(resolved.giftCards).not.toBe(noOpCommerceCapabilities.giftCards);
  });

  it('keeps honoring while the guard says balances may still exist', async () => {
    environment({ sell: false, honor: false });
    mocks.honorIsEffectivelyOn.mockResolvedValue(true);

    const resolved = await resolveRuntimeCommerceCapabilities();

    expect(mocks.honorIsEffectivelyOn).toHaveBeenCalledTimes(1);
    const [passedDatabase, configuredHonor, nowSeconds] = mocks.honorIsEffectivelyOn.mock.calls[0];
    expect(passedDatabase).toBe(database);
    expect(configuredHonor).toBe(false);
    expect(nowSeconds).toBeTypeOf('number');

    expect(resolved.giftCards).not.toBe(noOpCommerceCapabilities.giftCards);
    // Delegated to the real capability, which fails on its own missing runtime
    // rather than refusing the code the way the inert boundary would.
    expect(await offerBearerCode(resolved.giftCards))
      .not.toBeInstanceOf(CommerceCapabilityDisabledError);
  });

  it('stops honoring once the guard reports a fresh, empty measurement', async () => {
    environment({ sell: false, honor: false });
    mocks.honorIsEffectivelyOn.mockResolvedValue(false);

    const resolved = await resolveRuntimeCommerceCapabilities();

    expect(resolved.giftCards).toBe(noOpCommerceCapabilities.giftCards);
    expect(await offerBearerCode(resolved.giftCards))
      .toBeInstanceOf(CommerceCapabilityDisabledError);
  });

  it('still refuses to sell cards it cannot honor, whatever the guard would say', async () => {
    environment({ sell: true, honor: false });
    mocks.honorIsEffectivelyOn.mockResolvedValue(true);

    await expect(resolveRuntimeCommerceCapabilities())
      .rejects.toBeInstanceOf(CommerceCapabilityConfigurationError);
    // Not merely "the throw survived": the guard must never be consulted in
    // this state, or a widened honor value would erase the configuration error.
    expect(mocks.honorIsEffectivelyOn).not.toHaveBeenCalled();
  });

  it('keeps honoring when the guard read fails outright', async () => {
    environment({ sell: false, honor: false });
    mocks.honorIsEffectivelyOn.mockRejectedValue(new Error('admin_settings unreadable'));

    const resolved = await resolveRuntimeCommerceCapabilities();

    expect(resolved.giftCards).not.toBe(noOpCommerceCapabilities.giftCards);
  });
});
