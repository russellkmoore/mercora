import { afterEach, describe, expect, it, vi } from "vitest";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";

const now = new Date("2026-08-11T12:00:00.000Z");
const current = "current-secret-that-is-at-least-thirty-two-characters";
const previous = "previous-secret-that-is-at-least-thirty-two-characters";

afterEach(() => vi.unstubAllEnvs());

describe("bounded unsubscribe tokens", () => {
  it("round-trips normalized email and expires", async () => {
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET_CURRENT", current);
    vi.stubEnv("EMAIL_UNSUBSCRIBE_TTL_SECONDS", "3600");
    const token = await createUnsubscribeToken(" Person@Example.COM ", "review_reminders", now);
    expect(token).not.toBeNull();
    expect(await verifyUnsubscribeToken(token!, new Date(now.getTime() + 3_599_000))).toMatchObject({ email: "person@example.com", category: "review_reminders" });
    expect(await verifyUnsubscribeToken(token!, new Date(now.getTime() + 3_600_000))).toBeNull();
  });

  it("rejects tampering and oversized public input", async () => {
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET_CURRENT", current);
    const token = await createUnsubscribeToken("person@example.com", "review_reminders", now);
    expect(await verifyUnsubscribeToken(`${token}x`, now)).toBeNull();
    expect(await verifyUnsubscribeToken("x".repeat(1_025), now)).toBeNull();
  });

  it("verifies the previous key during rotation but mints with current", async () => {
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET_CURRENT", previous);
    const oldToken = await createUnsubscribeToken("person@example.com", "review_reminders", now);
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET_CURRENT", current);
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET_PREVIOUS", previous);
    expect(await verifyUnsubscribeToken(oldToken!, now)).not.toBeNull();
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET_PREVIOUS", "");
    expect(await verifyUnsubscribeToken(oldToken!, now)).toBeNull();
  });

  it("fails closed when no sufficiently strong key is configured", async () => {
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET_CURRENT", "short");
    expect(await createUnsubscribeToken("person@example.com", "review_reminders", now)).toBeNull();
  });

  it("never mints with the previous key or a weak current key", async () => {
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET_CURRENT", "short");
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET_PREVIOUS", previous);
    expect(await createUnsubscribeToken("person@example.com", "review_reminders", now)).toBeNull();

    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET_CURRENT", "");
    expect(await createUnsubscribeToken("person@example.com", "review_reminders", now)).toBeNull();
  });
});
