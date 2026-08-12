import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("app/api/email/unsubscribe/route.ts", "utf8");

describe("unsubscribe route mutation contract", () => {
  it("never mutates on GET and marks every response no-store", () => {
    const get = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function POST"));
    expect(get).not.toContain("suppressEmail(");
    expect(source).toContain('"cache-control": "no-store"');
  });

  it("rate limits the signed idempotent POST", () => {
    const post = source.slice(source.indexOf("export async function POST"));
    expect(post).toContain("enforceRateLimit");
    expect(post).toContain("verifyUnsubscribeToken");
    expect(post).toContain("suppressEmail(payload.email, payload.category)");
  });
});
