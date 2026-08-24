import { describe, expect, it, vi } from "vitest";
import {
  GIFT_CARD_DELIVERY_ENCRYPTION_CONTRACT_VERSION,
  GIFT_CARD_DELIVERY_KEY_BYTES,
  GIFT_CARD_DELIVERY_NONCE_BYTES,
  MAX_GIFT_CARD_DELIVERY_KEY_VERSIONS,
  GiftCardDecryptionError,
  GiftCardEncryptionConfigurationError,
  GiftCardEncryptionError,
  GiftCardEncryptionInputError,
  decryptGiftCardDeliveryCode,
  encryptGiftCardDeliveryCode,
  type EncryptedGiftCardDeliveryCode,
  type GiftCardEncryptionKeyRing,
} from "@/lib/gift-cards/encryption";

const CODE = "GC-2345-6789-ABCD-EFGH-JKLM-NPQR-STUV";
const GIFT_CARD_ID = "gift_card_01JABC";
const DELIVERY_ID = "delivery:01JXYZ";
const KEY_1 = Uint8Array.from({ length: 32 }, (_, index) => index);
const KEY_2 = Uint8Array.from({ length: 32 }, (_, index) => 255 - index);
const KEY_1_BASE64 = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

function ring(overrides: Partial<GiftCardEncryptionKeyRing> = {}): GiftCardEncryptionKeyRing {
  return {
    currentVersion: 2,
    keys: { 1: KEY_1, 2: KEY_2 },
    ...overrides,
  };
}

function deterministicRandom(target: Uint8Array): void {
  target.forEach((_, index) => { target[index] = index; });
}

async function encrypted(
  overrides: Partial<Parameters<typeof encryptGiftCardDeliveryCode>[0]> = {},
): Promise<EncryptedGiftCardDeliveryCode> {
  return encryptGiftCardDeliveryCode({
    code: CODE,
    giftCardId: GIFT_CARD_ID,
    deliveryId: DELIVERY_ID,
    keyRing: ring(),
    randomFill: deterministicRandom,
    ...overrides,
  });
}

function fixedDecryptionError(error: unknown): void {
  expect(error).toBeInstanceOf(GiftCardDecryptionError);
  expect(error).toMatchObject({ message: "Gift-card delivery code could not be decrypted" });
  expect(String(error)).not.toContain(CODE);
  expect(String(error)).not.toContain(KEY_1_BASE64);
}

describe("gift-card delivery encryption", () => {
  it("freezes the Workers-compatible AES-256-GCM wire contract", async () => {
    expect(GIFT_CARD_DELIVERY_ENCRYPTION_CONTRACT_VERSION).toBe(1);
    expect(GIFT_CARD_DELIVERY_KEY_BYTES).toBe(32);
    expect(GIFT_CARD_DELIVERY_NONCE_BYTES).toBe(12);
    expect(MAX_GIFT_CARD_DELIVERY_KEY_VERSIONS).toBe(4);

    const result = await encrypted({
      keyRing: { currentVersion: 1, keys: { 1: `base64:${KEY_1_BASE64}` } },
    });

    expect(result).toEqual({
      keyVersion: 1,
      nonce: "AAECAwQFBgcICQoL",
      ciphertext: "AEH7KfbR9za7dq+ynKg6Lsf7wnK3M3I2cyuoqFM5UeAsQ/qp+bTs7joq6camMJtRdiKOhME=",
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(CODE);
    expect(Object.keys(result).sort()).toEqual(["ciphertext", "keyVersion", "nonce"]);
  });

  it("round trips only through the matching gift-card and delivery AAD", async () => {
    const value = await encrypted();
    await expect(decryptGiftCardDeliveryCode({
      encrypted: value,
      giftCardId: GIFT_CARD_ID,
      deliveryId: DELIVERY_ID,
      keyRing: ring(),
    })).resolves.toBe(CODE);

    for (const aad of [
      { giftCardId: "gift_card_other", deliveryId: DELIVERY_ID },
      { giftCardId: GIFT_CARD_ID, deliveryId: "delivery_other" },
    ]) {
      await expect(decryptGiftCardDeliveryCode({ encrypted: value, keyRing: ring(), ...aad }))
        .rejects.toSatisfy((error: unknown) => {
          fixedDecryptionError(error);
          return true;
        });
    }
  });

  it("uses a fresh 96-bit Web Crypto nonce by default", async () => {
    const getRandomValues = vi.spyOn(crypto, "getRandomValues");
    const first = await encrypted({ randomFill: undefined });
    const second = await encrypted({ randomFill: undefined });
    expect(getRandomValues).toHaveBeenCalledTimes(2);
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    getRandomValues.mockRestore();
  });

  it("encrypts with the current key and decrypts retained historical versions", async () => {
    const old = await encrypted({ keyRing: { currentVersion: 1, keys: { 1: KEY_1 } } });
    expect(old.keyVersion).toBe(1);
    await expect(decryptGiftCardDeliveryCode({
      encrypted: old,
      giftCardId: GIFT_CARD_ID,
      deliveryId: DELIVERY_ID,
      keyRing: ring(),
    })).resolves.toBe(CODE);

    const current = await encrypted();
    expect(current.keyVersion).toBe(2);
    await expect(decryptGiftCardDeliveryCode({
      encrypted: old,
      giftCardId: GIFT_CARD_ID,
      deliveryId: DELIVERY_ID,
      keyRing: { currentVersion: 2, keys: { 2: KEY_2 } },
    })).rejects.toBeInstanceOf(GiftCardDecryptionError);
  });

  it("accepts only exact canonical code and bounded ASCII AAD identifiers", async () => {
    const invalidIds = ["", " leading", "trailing ", "two words", "ümlaut", "nul\0id", "x".repeat(129)];
    await expect(encrypted({ code: CODE.toLowerCase() })).rejects.toBeInstanceOf(GiftCardEncryptionInputError);
    for (const id of invalidIds) {
      await expect(encrypted({ giftCardId: id })).rejects.toMatchObject({
        message: "Gift-card delivery encryption input is invalid",
      });
      await expect(encrypted({ deliveryId: id })).rejects.toBeInstanceOf(GiftCardEncryptionInputError);
    }
  });

  it("masks entropy and provider crypto failures without exposing plaintext", async () => {
    const secretFailure = `provider failed for ${CODE} ${KEY_1_BASE64}`;
    try {
      await encrypted({ randomFill() { throw new Error(secretFailure); } });
      expect.fail("expected encryption to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(GiftCardEncryptionError);
      expect(error).toMatchObject({ message: "Gift-card delivery code could not be encrypted" });
      expect(String(error)).not.toContain(CODE);
      expect(String(error)).not.toContain(KEY_1_BASE64);
    }
  });

  it("copies caller-owned key bytes before zeroizing local material", async () => {
    const callerKey = Uint8Array.from(KEY_1);
    const before = Uint8Array.from(callerKey);
    await encrypted({ keyRing: { currentVersion: 1, keys: { 1: callerKey } } });
    expect(callerKey).toEqual(before);
  });
});

describe("gift-card delivery decryption validation", () => {
  it("fails closed for tampering, wrong keys, and payload relocation", async () => {
    const value = await encrypted();
    const tamperedCiphertext = `${value.ciphertext.slice(0, -2)}A=`;
    const cases: Array<{ payload: unknown; keyRing?: GiftCardEncryptionKeyRing }> = [
      { payload: { ...value, nonce: "AQECAwQFBgcICQoL" } },
      { payload: { ...value, ciphertext: tamperedCiphertext } },
      { payload: { ...value, keyVersion: 1 } },
      { payload: value, keyRing: { currentVersion: 2, keys: { 2: KEY_1 } } },
    ];
    for (const testCase of cases) {
      try {
        await decryptGiftCardDeliveryCode({
          encrypted: testCase.payload,
          giftCardId: GIFT_CARD_ID,
          deliveryId: DELIVERY_ID,
          keyRing: testCase.keyRing ?? ring(),
        });
        expect.fail("expected decryption to fail");
      } catch (error) {
        fixedDecryptionError(error);
      }
    }
  });

  it.each([
    null,
    [],
    {},
    { keyVersion: 2, nonce: "AAECAwQFBgcICQoL" },
    { keyVersion: 2, nonce: "AAECAwQFBgcICQoL", ciphertext: "AAAA", extra: true },
    { keyVersion: 0, nonce: "AAECAwQFBgcICQoL", ciphertext: "A".repeat(72) },
    { keyVersion: 1.5, nonce: "AAECAwQFBgcICQoL", ciphertext: "A".repeat(72) },
    { keyVersion: "2", nonce: "AAECAwQFBgcICQoL", ciphertext: "A".repeat(72) },
    { keyVersion: 2, nonce: "AAECAwQFBgcICQo", ciphertext: "A".repeat(72) },
    { keyVersion: 2, nonce: "AAECAwQFBgcICQo_", ciphertext: "A".repeat(72) },
    { keyVersion: 2, nonce: "AAAA", ciphertext: "A".repeat(72) },
    { keyVersion: 2, nonce: "AAECAwQFBgcICQoL", ciphertext: "AAAA" },
    { keyVersion: 2, nonce: "AAECAwQFBgcICQoL", ciphertext: "A".repeat(76) },
  ])("rejects malformed payloads with a fixed redacted error: %j", async (payload) => {
    await expect(decryptGiftCardDeliveryCode({
      encrypted: payload,
      giftCardId: GIFT_CARD_ID,
      deliveryId: DELIVERY_ID,
      keyRing: ring(),
    })).rejects.toMatchObject({ message: "Gift-card delivery code could not be decrypted" });
  });

  it("rejects accessors, symbols, and duplicate proxy keys without evaluating data", async () => {
    let getterCalled = false;
    const accessorPayload = {
      keyVersion: 2,
      nonce: "AAECAwQFBgcICQoL",
      get ciphertext() {
        getterCalled = true;
        return CODE;
      },
    };
    const symbolPayload = { ...(await encrypted()), [Symbol("secret")]: CODE };
    const duplicatePayload = new Proxy({}, {
      ownKeys: () => ["keyVersion", "nonce", "nonce", "ciphertext"],
    });
    for (const payload of [accessorPayload, symbolPayload, duplicatePayload]) {
      await expect(decryptGiftCardDeliveryCode({
        encrypted: payload,
        giftCardId: GIFT_CARD_ID,
        deliveryId: DELIVERY_ID,
        keyRing: ring(),
      })).rejects.toBeInstanceOf(GiftCardDecryptionError);
    }
    expect(getterCalled).toBe(false);
  });
});

describe("gift-card delivery encryption key configuration", () => {
  it.each([
    { currentVersion: 0, keys: { 1: KEY_1 } },
    { currentVersion: 1.5, keys: { 1: KEY_1 } },
    { currentVersion: 2, keys: { 1: KEY_1 } },
    { currentVersion: 1, keys: {} },
    { currentVersion: 1, keys: { 1: new Uint8Array(31) } },
    { currentVersion: 1, keys: { 1: new Uint8Array(33) } },
    { currentVersion: 1, keys: { 1: KEY_1_BASE64 } },
    { currentVersion: 1, keys: { 1: "base64:AAAA" } },
    { currentVersion: 1, keys: { "01": KEY_1 } },
    { currentVersion: 1, keys: { 1: KEY_1, 2: KEY_1, 3: KEY_1, 4: KEY_1, 5: KEY_1 } },
  ])("rejects a missing, malformed, noncanonical, or oversized key ring: %j", async (keyRing) => {
    await expect(encrypted({ keyRing: keyRing as GiftCardEncryptionKeyRing }))
      .rejects.toBeInstanceOf(GiftCardEncryptionConfigurationError);
  });

  it("rejects key accessors, symbols, and duplicate version properties", async () => {
    let getterCalled = false;
    const accessorKeys = Object.defineProperty({}, "1", {
      enumerable: true,
      get() {
        getterCalled = true;
        return KEY_1;
      },
    });
    const symbolKeys = { 1: KEY_1, [Symbol("version")]: KEY_2 };
    const duplicateKeys = new Proxy({}, {
      ownKeys: () => ["1", "1"],
    });
    for (const keys of [accessorKeys, symbolKeys, duplicateKeys]) {
      await expect(encrypted({
        keyRing: { currentVersion: 1, keys } as GiftCardEncryptionKeyRing,
      })).rejects.toBeInstanceOf(GiftCardEncryptionConfigurationError);
    }
    expect(getterCalled).toBe(false);
  });

  it("uses equivalent exact 32-byte Uint8Array and canonical base64 keys", async () => {
    const bytesResult = await encrypted({ keyRing: { currentVersion: 1, keys: { 1: KEY_1 } } });
    const stringResult = await encrypted({
      keyRing: { currentVersion: 1, keys: { 1: `base64:${KEY_1_BASE64}` } },
    });
    expect(stringResult).toEqual(bytesResult);
  });
});
