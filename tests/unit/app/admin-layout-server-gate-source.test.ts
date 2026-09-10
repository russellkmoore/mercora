import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * T-13-42 (Phase 13 security audit, UF-1): `AdminGuard` is a client
 * component, so without a server gate every `app/admin/*` page that
 * server-renders data — the gift-card honor banner was the first — would
 * ship that data to an anonymous GET. The layout must decide on the server
 * and mount the page tree only for an admin session.
 */
const root = process.cwd();
const layout = readFileSync(join(root, "app/admin/layout.tsx"), "utf8");
const middleware = readFileSync(join(root, "lib/auth/admin-middleware.ts"), "utf8");

describe("admin layout server gate (T-13-42)", () => {
  it("is an async server component (no client directive)", () => {
    expect(layout).not.toMatch(/^\s*["']use client["']/m);
    expect(layout).toMatch(/export default async function AdminLayout/);
  });

  it("asks the shared admin session check before mounting children", () => {
    expect(layout).toMatch(/import \{ checkAdminSession \} from "@\/lib\/auth\/admin-middleware"/);
    expect(layout).toMatch(/const session = await checkAdminSession\(\);/);
    expect(layout).toMatch(/session\.success \? children : null/);
    // The page tree is rendered exactly once, through the gated value.
    expect(layout).not.toMatch(/\{children\}/);
    expect(layout).toMatch(/\{content\}/);
  });

  it("keeps the client AdminGuard for the sign-in and access-denied UI", () => {
    expect(layout).toMatch(/<AdminGuard>/);
  });

  it("shares one Clerk branch between the API routes and the layout", () => {
    expect(middleware).toMatch(/export async function checkAdminSession\(\): Promise<AdminAuthResult>/);
    // checkAdminPermissions delegates rather than duplicating the role logic.
    expect(middleware).toMatch(/return await checkAdminSession\(\);/);
    expect(middleware.match(/await isUserAdmin\(userId\)/g)?.length).toBe(1);
  });
});
