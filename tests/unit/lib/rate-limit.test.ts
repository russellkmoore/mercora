import { beforeEach, describe, expect, it, vi } from "vitest";

const getCloudflareContext = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => getCloudflareContext(...args),
}));

import { NextRequest } from "next/server";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

const requestWith = (headers: Record<string, string>) =>
  new NextRequest("http://localhost/api/example", { method: "POST", headers });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("getClientIp", () => {
  it("prefers the Cloudflare client IP header", () => {
    expect(
      getClientIp(
        requestWith({
          "CF-Connecting-IP": " 1.2.3.4 ",
          "x-forwarded-for": "9.9.9.9",
        })
      )
    ).toBe("1.2.3.4");
  });

  it("uses only the first forwarded address", () => {
    expect(getClientIp(requestWith({ "x-forwarded-for": "5.6.7.8, 9.9.9.9" }))).toBe(
      "5.6.7.8"
    );
  });

  it("bounds and removes control characters from header values", () => {
    const oversized = `  1.2.3.4\u0000${"a".repeat(200)}  `;
    const request = {
      headers: { get: (name: string) => (name === "CF-Connecting-IP" ? oversized : null) },
    } as NextRequest;
    const result = getClientIp(request);

    expect(result).not.toContain("\u0000");
    expect(result.length).toBe(128);
  });

  it("returns unknown when no usable client header exists", () => {
    expect(getClientIp(requestWith({ "CF-Connecting-IP": "  " }))).toBe("unknown");
  });
});

describe("enforceRateLimit", () => {
  it("allows an accepted request and passes through its key", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    getCloudflareContext.mockResolvedValue({ env: { PUBLIC_RATE_LIMITER: { limit } } });

    await expect(enforceRateLimit("PUBLIC_RATE_LIMITER", "tax:1.2.3.4")).resolves.toBeNull();
    expect(limit).toHaveBeenCalledWith({ key: "tax:1.2.3.4" });
  });

  it("returns a deterministic 429 response when rejected", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    getCloudflareContext.mockResolvedValue({ env: { AI_RATE_LIMITER: { limit } } });

    const response = await enforceRateLimit("AI_RATE_LIMITER", "agent-chat:1.2.3.4");

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("60");
    await expect(response?.json()).resolves.toEqual({
      error: "Too many requests. Please slow down and try again in a moment.",
    });
  });

  it("fails open when the binding is missing", async () => {
    getCloudflareContext.mockResolvedValue({ env: {} });

    await expect(enforceRateLimit("AI_RATE_LIMITER", "key")).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it("fails open when Workers context is unavailable", async () => {
    getCloudflareContext.mockRejectedValue(new Error("no runtime"));

    await expect(enforceRateLimit("PUBLIC_RATE_LIMITER", "key")).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it("fails open when the limiter throws", async () => {
    const limit = vi.fn().mockRejectedValue(new Error("limiter unavailable"));
    getCloudflareContext.mockResolvedValue({ env: { PUBLIC_RATE_LIMITER: { limit } } });

    await expect(enforceRateLimit("PUBLIC_RATE_LIMITER", "key")).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
