import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  suppressEmail: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(async () => null),
  getClientIp: vi.fn(() => "192.0.2.1"),
}));
vi.mock("@/lib/models/email-preferences", () => ({ suppressEmail: mocks.suppressEmail }));

import { GET, POST } from "@/app/api/email/unsubscribe/route";

const secret = "unsubscribe-route-secret-at-least-thirty-two-characters";

function signed(value: unknown): string {
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("public unsubscribe route malformed payloads", () => {
  it.each([
    null,
    [],
    {},
    { v: 1, email: 42, category: "review_reminders", iat: 1, exp: 2 },
    { v: 1, email: "person@example.com", category: "review_reminders", iat: "1", exp: 2 },
    { v: 1, email: "person@example.com", category: "transactional", iat: 1, exp: 2 },
  ])("fails closed for GET and POST without mutating preferences: %j", async (payload) => {
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET_CURRENT", secret);
    const url = `https://example.test/api/email/unsubscribe?token=${encodeURIComponent(signed(payload))}`;

    const get = await GET(new NextRequest(url));
    const post = await POST(new NextRequest(url, { method: "POST" }));

    expect(get.status).toBe(400);
    expect(post.status).toBe(400);
    expect(mocks.suppressEmail).not.toHaveBeenCalled();
  });
});
