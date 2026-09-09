import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseGiftCardCodeKeyRing,
  parseGiftCardDeliveryKeyRing,
} from "@/lib/gift-cards/config";

// Source-contract test (OPS-04 edge probe). Reads the committed, non-secret
// `.env.example` file as plain text and feeds its documented gift-card
// placeholders through the real, frozen parsers — never a reimplementation
// of their rules — so the documented shape can never silently drift from
// the shape those parsers actually enforce. Never reads `.dev.vars` or the
// local env file; both are gitignored and out of scope for this test.

const ENV_EXAMPLE_PATH = join(process.cwd(), ".env.example");
const ENV_EXAMPLE_TEXT = readFileSync(ENV_EXAMPLE_PATH, "utf-8");

const GIFT_CARD_HMAC_CURRENT_VERSION_NAME = "GIFT_CARD_CODE_HMAC_CURRENT_VERSION";
const GIFT_CARD_HMAC_KEYS_NAME = "GIFT_CARD_CODE_HMAC_KEYS_JSON";
const GIFT_CARD_DELIVERY_CURRENT_VERSION_NAME = "GIFT_CARD_DELIVERY_CURRENT_VERSION";
const GIFT_CARD_DELIVERY_KEYS_NAME = "GIFT_CARD_DELIVERY_KEYS_JSON";

/**
 * Every assignment line in the file, comment-tolerant: matches an optional
 * leading `#` (and whitespace), a bare `NAME`, and everything after the
 * first `=` as the raw value. Prose comment lines never match — a real
 * env-var name is always an unbroken run of uppercase letters/digits/
 * underscores immediately followed by `=`, which ordinary sentences never
 * produce this early in the line.
 */
const ASSIGNMENT_LINE_RE = /^#?\s*([A-Z][A-Z0-9_]*)=(.*)$/;

interface Assignment {
  name: string;
  value: string;
}

function extractAssignments(text: string): Assignment[] {
  const assignments: Assignment[] = [];
  for (const line of text.split("\n")) {
    const match = ASSIGNMENT_LINE_RE.exec(line);
    if (match) {
      assignments.push({ name: match[1], value: match[2] });
    }
  }
  return assignments;
}

function valueFor(assignments: Assignment[], name: string): string {
  const found = assignments.filter((assignment) => assignment.name === name);
  if (found.length !== 1) {
    throw new Error(`Expected exactly one ${name} assignment, found ${found.length}`);
  }
  return found[0].value;
}

describe(".env.example gift-card secret shape", () => {
  const assignments = extractAssignments(ENV_EXAMPLE_TEXT);
  const names = assignments.map((assignment) => assignment.name);

  it("names each of the four gift-card secrets exactly once", () => {
    expect(names.filter((name) => name === GIFT_CARD_HMAC_CURRENT_VERSION_NAME)).toHaveLength(1);
    expect(names.filter((name) => name === GIFT_CARD_HMAC_KEYS_NAME)).toHaveLength(1);
    expect(names.filter((name) => name === GIFT_CARD_DELIVERY_CURRENT_VERSION_NAME)).toHaveLength(1);
    expect(names.filter((name) => name === GIFT_CARD_DELIVERY_KEYS_NAME)).toHaveLength(1);
  });

  it("documents the four names in order, adjacent with no assignment between them", () => {
    const hmacCurrentIndex = names.indexOf(GIFT_CARD_HMAC_CURRENT_VERSION_NAME);
    const hmacKeysIndex = names.indexOf(GIFT_CARD_HMAC_KEYS_NAME);
    const deliveryCurrentIndex = names.indexOf(GIFT_CARD_DELIVERY_CURRENT_VERSION_NAME);
    const deliveryKeysIndex = names.indexOf(GIFT_CARD_DELIVERY_KEYS_NAME);

    expect(hmacCurrentIndex).toBeGreaterThanOrEqual(0);
    expect(hmacKeysIndex).toBe(hmacCurrentIndex + 1);
    expect(deliveryCurrentIndex).toBe(hmacKeysIndex + 1);
    expect(deliveryKeysIndex).toBe(deliveryCurrentIndex + 1);
  });

  it("the documented HMAC placeholder parses as written (over the 32-byte floor)", () => {
    // The HMAC placeholder is not a secret — it is a publicly known,
    // documented value that happens to be 33 UTF-8 bytes, one byte over
    // parseGiftCardCodeKeyRing's 32-byte floor. It PARSES exactly as
    // committed. A developer must still replace it before relying on it;
    // the file's own comment already carries that instruction.
    const ring = parseGiftCardCodeKeyRing({
      [GIFT_CARD_HMAC_CURRENT_VERSION_NAME]: valueFor(assignments, GIFT_CARD_HMAC_CURRENT_VERSION_NAME),
      [GIFT_CARD_HMAC_KEYS_NAME]: valueFor(assignments, GIFT_CARD_HMAC_KEYS_NAME),
    });
    expect(ring.currentVersion).toBe(1);
  });

  it("the documented delivery placeholder is rejected by the parser as written", () => {
    // The delivery placeholder payload is deliberately hyphenated English
    // behind the required `base64:` prefix, so it fails the delivery-ring
    // parser's character-class regex and never parses until replaced.
    expect(() => parseGiftCardDeliveryKeyRing({
      [GIFT_CARD_DELIVERY_CURRENT_VERSION_NAME]: valueFor(assignments, GIFT_CARD_DELIVERY_CURRENT_VERSION_NAME),
      [GIFT_CARD_DELIVERY_KEYS_NAME]: valueFor(assignments, GIFT_CARD_DELIVERY_KEYS_NAME),
    })).toThrow("Gift-card runtime configuration is unavailable");
  });

  it("the delivery placeholder parses once its payload is replaced with a real 32-byte key", () => {
    // Proves the "accepted only when replaced" half of the claim: same
    // documented shape, same key name, only the placeholder payload swapped
    // for a canonical base64 encoding of a real 32-byte value — built in
    // memory with btoa, exactly as plan 11-01 does, never a long literal.
    const documentedKeysValue = valueFor(assignments, GIFT_CARD_DELIVERY_KEYS_NAME);
    const documentedKeys = JSON.parse(documentedKeysValue) as Record<string, string>;
    const realPayload = `base64:${btoa("0".repeat(32))}`;
    const replacedKeys = Object.fromEntries(
      Object.keys(documentedKeys).map((version) => [version, realPayload]),
    );

    const ring = parseGiftCardDeliveryKeyRing({
      [GIFT_CARD_DELIVERY_CURRENT_VERSION_NAME]: valueFor(assignments, GIFT_CARD_DELIVERY_CURRENT_VERSION_NAME),
      [GIFT_CARD_DELIVERY_KEYS_NAME]: JSON.stringify(replacedKeys),
    });
    expect(ring.currentVersion).toBe(1);
  });
});
