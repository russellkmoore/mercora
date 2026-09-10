import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 14 security audit, UF-14-1: the admin layout's server gate decides
 * whether to mount a page, but the App Router streams the page segment in the
 * RSC payload regardless. So every async (server-rendering) admin page must
 * refuse on its own via `requireAdminSession()`, and the middleware must send
 * anonymous `/admin` requests to sign-in before any segment renders.
 */
const root = process.cwd();

function pages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pages(full));
    else if (entry === "page.tsx") out.push(full);
  }
  return out;
}

describe("admin pages server gate (UF-14-1)", () => {
  const asyncPages = pages(join(root, "app/admin")).filter((file) =>
    /export default async function/.test(readFileSync(file, "utf8")),
  );

  it("finds the async admin pages", () => {
    expect(asyncPages.length).toBeGreaterThanOrEqual(4);
  });

  it("every async admin page awaits requireAdminSession() before anything else", () => {
    for (const file of asyncPages) {
      const source = readFileSync(file, "utf8");
      const name = relative(root, file);
      expect(source, name).toMatch(/import \{ requireAdminSession \} from "@\/lib\/auth\/admin-session"/);
      const body = source.split("export default async function")[1] ?? "";
      const call = body.indexOf("await requireAdminSession();");
      expect(call, `${name} must call requireAdminSession`).toBeGreaterThan(0);
      const firstOtherAwait = body.indexOf("await ", body.indexOf("{") + 1);
      expect(firstOtherAwait, `${name} must gate before any other await`).toBe(body.indexOf("await requireAdminSession();"));
    }
  });

  it("requireAdminSession answers 404 for a non-admin session", () => {
    const helper = readFileSync(join(root, "lib/auth/admin-session.ts"), "utf8");
    expect(helper).toMatch(/const session = await checkAdminSession\(\);/);
    expect(helper).toMatch(/if \(!session\.success \|\| !session\.userId\) \{\s*notFound\(\);/);
  });

  it("middleware redirects anonymous /admin page requests to sign-in", () => {
    const middleware = readFileSync(join(root, "middleware.ts"), "utf8");
    expect(middleware).toMatch(/pathname === '\/admin' \|\| pathname\.startsWith\('\/admin\/'\)/);
    expect(middleware).toMatch(/new URL\('\/sign-in', req\.url\)/);
  });
});
