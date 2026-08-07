import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOrderStatusToken,
  DEFAULT_ORDER_STATUS_TTL_SECONDS,
  isOrderStatusTokenConfigured,
  MAX_ORDER_STATUS_TOKEN_LENGTH,
  MAX_ORDER_STATUS_TTL_SECONDS,
  MIN_ORDER_STATUS_TTL_SECONDS,
  verifyOrderStatusToken,
} from "@/lib/order-status/token";

const ORDER_ID = "ORD-GUEST-123";
const SECRET = "guest-status-test-secret-0123456789abcdef";
const NOW = new Date("2026-08-06T12:00:00.000Z");

beforeEach(() => {
  process.env.ORDER_STATUS_SECRET = SECRET;
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  delete process.env.ORDER_STATUS_SECRET;
  delete process.env.ORDER_STATUS_GUEST_LINKS_ENABLED;
  vi.useRealTimers();
});

describe("order-status token", () => {
  it("round trips an authenticated, versioned, order-bound payload without PII", async () => {
    const token = await createOrderStatusToken(ORDER_ID);
    expect(token).not.toBeNull();
    expect(await verifyOrderStatusToken(token!, ORDER_ID)).toBe(true);
    expect(await verifyOrderStatusToken(token!, "ORD-OTHER")).toBe(false);

    const [payloadSegment] = token!.split(".");
    const padding = "=".repeat((4 - (payloadSegment.length % 4)) % 4);
    const payload = JSON.parse(
      Buffer.from(payloadSegment.replace(/-/g, "+").replace(/_/g, "/") + padding, "base64")
        .toString("utf8"),
    );
    expect(payload).toEqual({
      v: 1,
      oid: ORDER_ID,
      iat: Math.floor(NOW.getTime() / 1_000),
      exp: Math.floor(NOW.getTime() / 1_000) + DEFAULT_ORDER_STATUS_TTL_SECONDS,
    });
    expect(JSON.stringify(payload)).not.toMatch(/email|address|customer|payment/i);
  });

  it("rejects tampering, malformed values, and oversized input without throwing", async () => {
    const token = (await createOrderStatusToken(ORDER_ID))!;
    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;

    await expect(verifyOrderStatusToken(tampered, ORDER_ID)).resolves.toBe(false);
    await expect(verifyOrderStatusToken("not.a.valid.token", ORDER_ID)).resolves.toBe(false);
    await expect(
      verifyOrderStatusToken("x".repeat(MAX_ORDER_STATUS_TOKEN_LENGTH + 1), ORDER_ID),
    ).resolves.toBe(false);
  });

  it("expires at the authenticated expiry time", async () => {
    const token = await createOrderStatusToken(ORDER_ID, {
      ttlSeconds: MIN_ORDER_STATUS_TTL_SECONDS,
    });
    vi.setSystemTime(new Date(NOW.getTime() + MIN_ORDER_STATUS_TTL_SECONDS * 1_000));
    expect(await verifyOrderStatusToken(token!, ORDER_ID)).toBe(false);
  });

  it("rejects TTLs outside the configured bounds", async () => {
    await expect(createOrderStatusToken(ORDER_ID, {
      ttlSeconds: MIN_ORDER_STATUS_TTL_SECONDS - 1,
    })).resolves.toBeNull();
    await expect(createOrderStatusToken(ORDER_ID, {
      ttlSeconds: MAX_ORDER_STATUS_TTL_SECONDS + 1,
    })).resolves.toBeNull();
  });

  it("fails closed for absent, short, or rotated secrets", async () => {
    const token = (await createOrderStatusToken(ORDER_ID))!;
    process.env.ORDER_STATUS_SECRET = "short";
    expect(isOrderStatusTokenConfigured()).toBe(false);
    expect(await createOrderStatusToken(ORDER_ID)).toBeNull();
    expect(await verifyOrderStatusToken(token, ORDER_ID)).toBe(false);

    process.env.ORDER_STATUS_SECRET = `${SECRET}-rotated`;
    expect(await verifyOrderStatusToken(token, ORDER_ID)).toBe(false);

    delete process.env.ORDER_STATUS_SECRET;
    expect(await verifyOrderStatusToken(token, ORDER_ID)).toBe(false);
  });

  it("fails closed for the published placeholder and explicit feature disablement", async () => {
    process.env.ORDER_STATUS_SECRET = "replace_with_at_least_32_random_characters";
    expect(isOrderStatusTokenConfigured()).toBe(false);
    expect(await createOrderStatusToken(ORDER_ID)).toBeNull();

    process.env.ORDER_STATUS_SECRET = SECRET;
    process.env.ORDER_STATUS_GUEST_LINKS_ENABLED = "false";
    expect(isOrderStatusTokenConfigured()).toBe(false);
    expect(await createOrderStatusToken(ORDER_ID)).toBeNull();

    process.env.ORDER_STATUS_GUEST_LINKS_ENABLED = "true";
    expect(isOrderStatusTokenConfigured()).toBe(true);
  });
});
