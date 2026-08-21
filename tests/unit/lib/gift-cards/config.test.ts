import { describe, expect, it } from "vitest";
import { resolveStoreConfig } from "@/lib/store-config";
import {
  GiftCardRuntimeConfigurationError,
  parseGiftCardCodeKeyRing,
  parseGiftCardDeliveryKeyRing,
} from "@/lib/gift-cards/config";

const current = "current-gift-card-hmac-key-material-0001";
const previous = "previous-gift-card-hmac-key-material-001";

describe("gift-card runtime configuration", () => {
  it("parses a bounded server-only rotation ring", () => {
    expect(parseGiftCardCodeKeyRing({
      GIFT_CARD_CODE_HMAC_CURRENT_VERSION: "2",
      GIFT_CARD_CODE_HMAC_KEYS_JSON: JSON.stringify({ 1: previous, 2: current }),
    })).toEqual({
      currentVersion: 2,
      keys: { 1: previous, 2: current },
    });
  });

  it.each([
    {},
    { GIFT_CARD_CODE_HMAC_CURRENT_VERSION: "0", GIFT_CARD_CODE_HMAC_KEYS_JSON: "{}" },
    { GIFT_CARD_CODE_HMAC_CURRENT_VERSION: "2", GIFT_CARD_CODE_HMAC_KEYS_JSON: "not-json" },
    { GIFT_CARD_CODE_HMAC_CURRENT_VERSION: "2", GIFT_CARD_CODE_HMAC_KEYS_JSON: JSON.stringify({ 1: previous }) },
    { GIFT_CARD_CODE_HMAC_CURRENT_VERSION: "1", GIFT_CARD_CODE_HMAC_KEYS_JSON: JSON.stringify({ 1: "short" }) },
    { GIFT_CARD_CODE_HMAC_CURRENT_VERSION: "1", GIFT_CARD_CODE_HMAC_KEYS_JSON: JSON.stringify({ 1: current, 2: previous, 3: current, 4: previous, 5: current }) },
  ])("fails closed with one redacted error for malformed key-ring input", (environment) => {
    let caught: unknown;
    try {
      parseGiftCardCodeKeyRing(environment);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GiftCardRuntimeConfigurationError);
    expect((caught as Error).message).toBe("Gift-card runtime configuration is unavailable");
    expect((caught as Error).message).not.toContain(current);
  });

  it("never copies secret ring values into public StoreConfig", () => {
    const config = resolveStoreConfig({
      STORE_FEATURE_GIFT_CARD_ACQUISITION: "true",
      STORE_FEATURE_GIFT_CARD_RECONCILIATION: "true",
      GIFT_CARD_CODE_HMAC_CURRENT_VERSION: "2",
      GIFT_CARD_CODE_HMAC_KEYS_JSON: JSON.stringify({ 2: current }),
    });
    expect(config.commerce.features).toMatchObject({
      giftCardAcquisition: true,
      giftCardReconciliation: true,
    });
    expect(JSON.stringify(config)).not.toContain(current);
    expect(config).not.toHaveProperty("giftCardCodeKeyRing");
  });

  it('parses an independently versioned AES-GCM delivery key ring', () => {
    expect(parseGiftCardDeliveryKeyRing({
      GIFT_CARD_DELIVERY_CURRENT_VERSION: '1',
      GIFT_CARD_DELIVERY_KEYS_JSON: JSON.stringify({
        1: 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      }),
    })).toEqual({
      currentVersion: 1,
      keys: { 1: 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
    });
  });
});
