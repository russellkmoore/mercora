import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: unknown) => handler,
}));
vi.mock("@/lib/utils/settings", () => ({
  getSettings: vi.fn(async () => ({})),
}));
vi.mock("@/lib/db", () => ({
  getDbAsync: vi.fn(async () => ({})),
}));

import middlewareImport from "@/middleware";
import { NextRequest, NextResponse } from "next/server";
import { DEPLOYMENT_GUARD_MESSAGE } from "@/lib/auth/deployment-guard";

// The mocked clerkMiddleware returns the inner (auth, req) handler unchanged,
// but the real clerkMiddleware type declares the default export as
// NextMiddleware ((request, event) => ...). Cast back to the runtime shape.
const middleware = middlewareImport as unknown as (
  auth: unknown,
  req: NextRequest
) => Promise<NextResponse>;

function tripGuard() {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
}

describe("middleware admin deployment guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns 503 for a tripped guard on an /api/admin path", async () => {
    tripGuard();
    const response = await middleware(
      {},
      new NextRequest("http://localhost/api/admin/vectorize")
    );

    expect(response.status).toBe(503);
  });

  it("returns 503 for a tripped guard on an /admin path", async () => {
    tripGuard();
    const response = await middleware(
      {},
      new NextRequest("http://localhost/admin/products")
    );

    expect(response.status).toBe(503);
  });

  it("does not return 503 for a tripped guard on the storefront root", async () => {
    tripGuard();
    const response = await middleware(
      {},
      new NextRequest("http://localhost/")
    );

    expect(response.status).not.toBe(503);
  });

  it("does not return 503 for a tripped guard on a product path", async () => {
    tripGuard();
    const response = await middleware(
      {},
      new NextRequest("http://localhost/product/ultralight-tent")
    );

    expect(response.status).not.toBe(503);
  });

  it("passes through the existing admin short-circuit when the guard is not tripped", async () => {
    const response = await middleware(
      {},
      new NextRequest("http://localhost/api/admin/vectorize")
    );

    expect(response.status).toBe(200);
  });

  it("returns the shared deployment guard message as the 503 body", async () => {
    tripGuard();
    const response = await middleware(
      {},
      new NextRequest("http://localhost/api/admin/vectorize")
    );

    const body = await response.text();
    expect(body).toBe(DEPLOYMENT_GUARD_MESSAGE);
  });

  it("calls assertDeploymentPosture() before the admin pathname short-circuit's NextResponse.next()", () => {
    const source = readFileSync("middleware.ts", "utf8");
    const guardIndex = source.indexOf("assertDeploymentPosture()");
    const shortCircuitIndex = source.indexOf(
      "pathname.startsWith('/api/mcp')"
    );

    expect(guardIndex).toBeGreaterThan(-1);
    expect(shortCircuitIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(shortCircuitIndex);
  });
});
