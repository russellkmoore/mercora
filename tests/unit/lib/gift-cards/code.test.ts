import { describe, expect, it, vi } from "vitest";
import {
  GIFT_CARD_CODE_DIGEST_CONTRACT_VERSION,
  GIFT_CARD_CODE_ENTROPY_BITS,
  GIFT_CARD_CODE_LENGTH,
  GiftCardCodeConfigurationError,
  GiftCardCodeCryptoError,
  GiftCardCodeGenerationError,
  MAX_GIFT_CARD_CODE_KEY_VERSIONS,
  digestGiftCardCode,
  generateGiftCardCode,
  giftCardLookupCandidates,
  normalizeGiftCardCode,
  type GiftCardKeyRing,
} from "@/lib/gift-cards/code";

const CODE = "GC-2345-6789-ABCD-EFGH-JKLM-NPQR-STUV";
const CURRENT_SECRET = "current-gift-card-hmac-key-material-0001";
const PREVIOUS_SECRET = "previous-gift-card-hmac-key-material-001";

function keyRing(overrides: Partial<GiftCardKeyRing> = {}): GiftCardKeyRing {
  return {
    currentVersion: 2,
    keys: { 1: PREVIOUS_SECRET, 2: CURRENT_SECRET },
    ...overrides,
  };
}

describe("gift-card bearer-code generation", () => {
  it("uses the Workers-compatible Web Crypto CSPRNG by default", () => {
    const getRandomValues = vi.spyOn(crypto, "getRandomValues");
    expect(generateGiftCardCode()).toMatch(/^GC-/);
    expect(getRandomValues).toHaveBeenCalled();
    getRandomValues.mockRestore();
  });

  it("generates a neutral canonical code with at least 128 bits of entropy", () => {
    const randomFill = vi.fn((target: Uint8Array) => {
      target.forEach((_, index) => { target[index] = index; });
    });

    const code = generateGiftCardCode({ randomFill });

    expect(code).toMatch(/^GC-(?:[23456789A-HJ-NP-Z]{4}-){6}[23456789A-HJ-NP-Z]{4}$/);
    expect(code).toHaveLength(GIFT_CARD_CODE_LENGTH);
    expect(GIFT_CARD_CODE_ENTROPY_BITS).toBe(140);
    expect(GIFT_CARD_CODE_ENTROPY_BITS).toBeGreaterThanOrEqual(128);
    expect(randomFill).toHaveBeenCalledOnce();
    expect(code).not.toMatch(/MERCORA|BEAUTEAS|TEA|STORE/);
  });

  it("rejects out-of-range random bytes instead of reducing them modulo the alphabet", () => {
    let batch = 0;
    const code = generateGiftCardCode({
      randomFill(target) {
        target.fill(batch === 0 ? 255 : 0);
        batch += 1;
      },
    });

    expect(batch).toBe(2);
    expect(code).toBe("GC-2222-2222-2222-2222-2222-2222-2222");
  });

  it("fails closed with a fixed error if entropy is unavailable or never accepted", () => {
    const entropyMessage = "raw-provider-secret-must-not-be-logged";
    expect(() => generateGiftCardCode({
      randomFill() { throw new Error(entropyMessage); },
    })).toThrow(GiftCardCodeGenerationError);
    try {
      generateGiftCardCode({ randomFill() { throw new Error(entropyMessage); } });
    } catch (error) {
      expect(String(error)).not.toContain(entropyMessage);
      expect(error).toMatchObject({ message: "Gift-card code generation failed" });
    }

    expect(() => generateGiftCardCode({
      randomFill(target) { target.fill(255); },
    })).toThrow(GiftCardCodeGenerationError);
  });
});

describe("gift-card bearer-code normalization", () => {
  it("accepts only exact separators and the ASCII alphabet, with lowercase normalized", () => {
    expect(normalizeGiftCardCode(CODE)).toBe(CODE);
    expect(normalizeGiftCardCode(CODE.toLowerCase())).toBe(CODE);
  });

  it.each([
    null,
    undefined,
    123,
    "",
    ` ${CODE}`,
    `${CODE} `,
    CODE.replace("GC-", "GIFT-"),
    CODE.replaceAll("-", ""),
    CODE.replace("-2345-", " 2345 "),
    CODE.replace("2", "0"),
    CODE.replace("2", "1"),
    CODE.replace("2", "I"),
    CODE.replace("2", "O"),
    CODE.replace("2", "２"),
    CODE.replace("S", "ſ"),
    CODE.replace("K", "K"),
    `${CODE}${"X".repeat(1_000)}`,
  ])("rejects malformed or ambiguous input without throwing: %j", (value) => {
    expect(normalizeGiftCardCode(value)).toBeNull();
  });
});

describe("gift-card HMAC lookup identities", () => {
  it("freezes the purpose-, contract-, and key-version-domain-separated digest", async () => {
    expect(GIFT_CARD_CODE_DIGEST_CONTRACT_VERSION).toBe(1);
    await expect(digestGiftCardCode(CODE, keyRing())).resolves.toEqual({
      keyVersion: 2,
      digest: "df3906d559ae28e67336f983afbb989f974974d3a5bf2f006e30719de68fc566",
    });
  });

  it("uses only the current version for issuance and every bounded version for rotation lookup", async () => {
    const issuance = await digestGiftCardCode(CODE.toLowerCase(), keyRing());
    const candidates = await giftCardLookupCandidates(CODE, {
      currentVersion: 2,
      keys: {
        1: PREVIOUS_SECRET,
        2: CURRENT_SECRET,
        3: "newer-but-not-current-gift-card-key-0003",
      },
    });

    expect(issuance).toMatchObject({ keyVersion: 2 });
    expect(candidates.map((candidate) => candidate.keyVersion)).toEqual([2, 3, 1]);
    expect(candidates).toHaveLength(3);
    expect(new Set(candidates.map((candidate) => candidate.digest)).size).toBe(3);
    for (const candidate of candidates) {
      expect(candidate).toEqual({
        keyVersion: expect.any(Number),
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      expect(Object.isFrozen(candidate)).toBe(true);
    }
    expect(Object.isFrozen(candidates)).toBe(true);
  });

  it("separates identical key material by key version", async () => {
    const versionOne = await digestGiftCardCode(CODE, {
      currentVersion: 1,
      keys: { 1: CURRENT_SECRET },
    });
    const versionTwo = await digestGiftCardCode(CODE, {
      currentVersion: 2,
      keys: { 2: CURRENT_SECRET },
    });

    expect(versionOne?.digest).not.toBe(versionTwo?.digest);
  });

  it("returns only constant-shape lookup authority and never the bearer code or key", async () => {
    const lookup = await digestGiftCardCode(CODE, keyRing());
    const candidates = await giftCardLookupCandidates(CODE, keyRing());
    const loggable = JSON.stringify({ lookup, candidates });

    expect(loggable).not.toContain(CODE);
    expect(loggable).not.toContain(CURRENT_SECRET);
    expect(loggable).not.toContain(PREVIOUS_SECRET);
    expect(Object.keys(lookup!)).toEqual(["keyVersion", "digest"]);
    expect(candidates.every(({ keyVersion, digest }) =>
      Number.isSafeInteger(keyVersion) && keyVersion > 0 && /^[a-f0-9]{64}$/.test(digest)
    )).toBe(true);
  });

  it("rejects malformed bearer input without exposing it in results or errors", async () => {
    const attackerInput = `${CODE}-private@example.test`;
    await expect(digestGiftCardCode(attackerInput, keyRing())).resolves.toBeNull();
    await expect(giftCardLookupCandidates(attackerInput, keyRing())).resolves.toEqual([]);
  });

  it("imports a copied Uint8Array key without retaining caller mutation", async () => {
    const bytes = new TextEncoder().encode(CURRENT_SECRET);
    const promise = digestGiftCardCode(CODE, { currentVersion: 7, keys: { 7: bytes } });
    bytes.fill(0);
    await expect(promise).resolves.toEqual({
      keyVersion: 7,
      digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("masks WebCrypto failures without echoing code or key material", async () => {
    const sign = vi.spyOn(crypto.subtle, "sign").mockRejectedValueOnce(
      new Error(`provider failed for ${CODE} ${CURRENT_SECRET}`),
    );
    let thrown: unknown;
    try {
      await digestGiftCardCode(CODE, keyRing());
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(GiftCardCodeCryptoError);
    expect(String(thrown)).toBe("GiftCardCodeCryptoError: Gift-card code digest could not be computed");
    expect(String(thrown)).not.toContain(CODE);
    expect(String(thrown)).not.toContain(CURRENT_SECRET);
    sign.mockRestore();
  });
});

describe("gift-card key-ring validation", () => {
  const malformed: unknown[] = [
    null,
    undefined,
    {},
    { currentVersion: 0, keys: { 0: CURRENT_SECRET } },
    { currentVersion: -1, keys: { 1: CURRENT_SECRET } },
    { currentVersion: 1.5, keys: { 1: CURRENT_SECRET } },
    { currentVersion: Number.MAX_SAFE_INTEGER + 1, keys: { 1: CURRENT_SECRET } },
    { currentVersion: 2, keys: { 1: PREVIOUS_SECRET } },
    { currentVersion: 1, keys: { "01": CURRENT_SECRET } },
    { currentVersion: 1, keys: [] },
    { currentVersion: 1, keys: { 1: "short" } },
    { currentVersion: 1, keys: { 1: new Uint8Array(31) } },
    { currentVersion: 1, keys: { 1: "x".repeat(4_097) } },
    {
      currentVersion: 1,
      keys: Object.fromEntries(Array.from(
        { length: MAX_GIFT_CARD_CODE_KEY_VERSIONS + 1 },
        (_, index) => [index + 1, `${CURRENT_SECRET}-${index}`],
      )),
    },
  ];

  it.each(malformed)("fails closed for malformed or unavailable key rings: %#", async (value) => {
    await expect(digestGiftCardCode(CODE, value as GiftCardKeyRing))
      .rejects.toBeInstanceOf(GiftCardCodeConfigurationError);
  });

  it("masks hostile configuration getter errors", async () => {
    const secretInError = "operator-secret-from-getter";
    const keys = new Proxy({}, {
      ownKeys() { throw new Error(secretInError); },
    });
    let thrown: unknown;
    try {
      await giftCardLookupCandidates(CODE, { currentVersion: 1, keys });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(GiftCardCodeConfigurationError);
    expect(String(thrown)).not.toContain(secretInError);
    expect(String(thrown)).not.toContain(CODE);
  });

  it("validates configuration before treating malformed input as an ordinary miss", async () => {
    await expect(digestGiftCardCode("invalid", { currentVersion: 1, keys: {} }))
      .rejects.toBeInstanceOf(GiftCardCodeConfigurationError);
    await expect(giftCardLookupCandidates("invalid", { currentVersion: 1, keys: {} }))
      .rejects.toBeInstanceOf(GiftCardCodeConfigurationError);
  });
});
