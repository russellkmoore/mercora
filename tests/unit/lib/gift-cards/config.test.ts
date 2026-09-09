import { describe, expect, it } from "vitest";
import { resolveStoreConfig } from "@/lib/store-config";
import {
  GiftCardRuntimeConfigurationError,
  parseGiftCardCodeKeyRing,
  parseGiftCardDeliveryKeyRing,
} from "@/lib/gift-cards/config";

const current = "current-gift-card-hmac-key-material-0001";
const previous = "previous-gift-card-hmac-key-material-001";

// Ring-shape invariants (Phase 11 plan 01, D-03). These pin the exact byte
// shapes the production `openssl rand -base64 32` generation pipeline (plan
// 11-04) and the recipe in docs/DEPLOYMENT_SETUP.md §9 emit, so a change to
// either parser breaks this test before it can break a live gift card.
const canonicalBase64Payload32 = btoa("0".repeat(32)); // 32-byte canonical base64 payload
const canonicalBase64Payload31 = btoa("0".repeat(31)); // 31-byte canonical base64 payload
const shortHmacKey = "0".repeat(31); // 31-character ASCII string (one byte under the HMAC floor)

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

  it('rejects a delivery key that does not decode to a 32-byte AES-256 key', () => {
    expect(() => parseGiftCardDeliveryKeyRing({
      GIFT_CARD_DELIVERY_CURRENT_VERSION: '1',
      // Valid base64 shape, but only 16 decoded bytes.
      GIFT_CARD_DELIVERY_KEYS_JSON: JSON.stringify({ 1: 'base64:AAAAAAAAAAAAAAAAAAAAAA==' }),
    })).toThrow('Gift-card runtime configuration is unavailable');
  });

  it("accepts an HMAC key shaped like openssl rand -base64 32 output", () => {
    expect(parseGiftCardCodeKeyRing({
      GIFT_CARD_CODE_HMAC_CURRENT_VERSION: "1",
      GIFT_CARD_CODE_HMAC_KEYS_JSON: JSON.stringify({ 1: canonicalBase64Payload32 }),
    })).toEqual({
      currentVersion: 1,
      keys: { 1: canonicalBase64Payload32 },
    });
  });

  it("rejects an HMAC key one byte under the 32-byte floor", () => {
    expect(() => parseGiftCardCodeKeyRing({
      GIFT_CARD_CODE_HMAC_CURRENT_VERSION: "1",
      GIFT_CARD_CODE_HMAC_KEYS_JSON: JSON.stringify({ 1: shortHmacKey }),
    })).toThrow("Gift-card runtime configuration is unavailable");
  });

  it("accepts a delivery key of canonical base64 decoding to exactly 32 bytes", () => {
    const key = `base64:${canonicalBase64Payload32}`;
    expect(parseGiftCardDeliveryKeyRing({
      GIFT_CARD_DELIVERY_CURRENT_VERSION: "1",
      GIFT_CARD_DELIVERY_KEYS_JSON: JSON.stringify({ 1: key }),
    })).toEqual({
      currentVersion: 1,
      keys: { 1: key },
    });
  });

  it("rejects a delivery key that decodes to 31 bytes, one under AES-256", () => {
    const key = `base64:${canonicalBase64Payload31}`;
    expect(() => parseGiftCardDeliveryKeyRing({
      GIFT_CARD_DELIVERY_CURRENT_VERSION: "1",
      GIFT_CARD_DELIVERY_KEYS_JSON: JSON.stringify({ 1: key }),
    })).toThrow("Gift-card runtime configuration is unavailable");
  });

  it("rejects a delivery key with no base64: prefix even at the right decoded length", () => {
    // Built inline (not reusing canonicalBase64Payload32) to keep this case
    // legible on its own: the bare base64 payload, no "base64:" prefix.
    const unprefixed = btoa("0".repeat(32));
    expect(() => parseGiftCardDeliveryKeyRing({
      GIFT_CARD_DELIVERY_CURRENT_VERSION: "1",
      GIFT_CARD_DELIVERY_KEYS_JSON: JSON.stringify({ 1: unprefixed }),
    })).toThrow("Gift-card runtime configuration is unavailable");
  });
});
