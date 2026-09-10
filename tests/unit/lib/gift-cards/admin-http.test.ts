import { describe, expect, it } from "vitest";
import {
  actorFrom,
  giftCardAdminFlags,
  invalidGiftCardIdResponse,
  jsonError,
  MAX_JSON_BODY_BYTES,
  readBoundedJsonBody,
} from "@/lib/gift-cards/admin-http";

/**
 * One shared bounded-body parser, actor builder, flag reader and typed error
 * shape for every gift-card admin route this phase adds (D-13). Behavior
 * mirrors `app/api/admin/orders/[id]/ship/route.ts`'s existing private copy.
 */

function requestWithBody(body: string, headers: Record<string, string> = {}) {
  return new Request("https://store.example.test/api/admin/gift-cards", {
    method: "POST",
    headers,
    body,
  });
}

describe("readBoundedJsonBody", () => {
  it("returns an empty object for an empty body", async () => {
    const result = await readBoundedJsonBody(requestWithBody(""));
    expect(result).toEqual({ ok: true, body: {} });
  });

  it("returns request_too_large (413) when content-length declares more than the cap", async () => {
    const oversizedDeclared = String(MAX_JSON_BODY_BYTES + 1);
    const result = await readBoundedJsonBody(
      requestWithBody("{}", { "content-length": oversizedDeclared }),
    );
    expect(result).toMatchObject({ ok: false, code: "request_too_large", status: 413 });
  });

  it("returns request_too_large (413) when the declared length lies but the encoded body exceeds the cap", async () => {
    const oversizedBody = JSON.stringify({ padding: "x".repeat(MAX_JSON_BODY_BYTES + 100) });
    const result = await readBoundedJsonBody(
      requestWithBody(oversizedBody, { "content-length": "10" }),
    );
    expect(result).toMatchObject({ ok: false, code: "request_too_large", status: 413 });
  });

  it("returns invalid_json (400) for a malformed payload", async () => {
    const result = await readBoundedJsonBody(requestWithBody("{not json"));
    expect(result).toMatchObject({ ok: false, code: "invalid_json", status: 400 });
  });
});

describe("actorFrom", () => {
  it("returns the service actor for a service-token auth result", () => {
    expect(actorFrom({ success: true, userId: "admin-service", isServiceToken: true }))
      .toEqual({ type: "service", id: "api-token" });
  });

  it("returns an admin actor keyed on the userId otherwise", () => {
    expect(actorFrom({ success: true, userId: "user_123" }))
      .toEqual({ type: "admin", id: "user_123" });
  });

  it("returns id: null for an admin actor with no user id", () => {
    expect(actorFrom({ success: true }))
      .toEqual({ type: "admin", id: null });
  });
});

describe("giftCardAdminFlags", () => {
  it("treats the exact lowercase string 'true' (after trim/lowercase) as on", () => {
    expect(giftCardAdminFlags({
      STORE_FEATURE_GIFT_CARD_ACQUISITION: "true",
      STORE_FEATURE_GIFT_CARD_RECONCILIATION: "  true  ",
    })).toEqual({ giftCardAcquisition: true, giftCardReconciliation: true });
  });

  it("treats undefined as off", () => {
    expect(giftCardAdminFlags({})).toEqual({
      giftCardAcquisition: false,
      giftCardReconciliation: false,
    });
  });

  it("treats 'TRUE ' (wrong case, but trims/lowercases to true) as on", () => {
    expect(giftCardAdminFlags({ STORE_FEATURE_GIFT_CARD_ACQUISITION: "TRUE " }))
      .toMatchObject({ giftCardAcquisition: true });
  });

  it("treats '1' as off — only the literal string 'true' counts", () => {
    expect(giftCardAdminFlags({ STORE_FEATURE_GIFT_CARD_ACQUISITION: "1" }))
      .toMatchObject({ giftCardAcquisition: false });
  });
});

describe("invalidGiftCardIdResponse (IN-09, D-13)", () => {
  it("returns null for a well-formed id", () => {
    expect(invalidGiftCardIdResponse("gift_card_1")).toBeNull();
    expect(invalidGiftCardIdResponse("x".repeat(128))).toBeNull();
  });

  it.each([
    ["an over-long id", "x".repeat(129)],
    ["an empty id", ""],
    ["an id with surrounding whitespace", " gift_card_1 "],
    ["a non-string", 42],
  ])("answers 404 gift_card_not_found for %s", async (_name, id) => {
    const response = invalidGiftCardIdResponse(id);
    expect(response?.status).toBe(404);
    expect(await response?.json()).toEqual({ code: "gift_card_not_found", error: "Gift card not found" });
  });
});

describe("jsonError", () => {
  it("shapes a NextResponse.json body as { code, error } with the given status", async () => {
    const response = jsonError("gift_card_not_found", "Gift card not found", 404);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "gift_card_not_found", error: "Gift card not found" });
  });
});
