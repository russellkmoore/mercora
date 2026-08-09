import { describe, expect, it, vi } from "vitest";
import { parseMcpOrderId, readMcpOrderLookup } from "@/lib/mcp/order-lookup";

describe("MCP order lookup input", () => {
  it("accepts one exact bounded order ID and rejects whitespace or controls", () => {
    expect(parseMcpOrderId("MCP-AGENT-1-ABCDEF12")).toEqual({
      ok: true,
      orderId: "MCP-AGENT-1-ABCDEF12",
    });
    expect(parseMcpOrderId(" MCP-AGENT-1-ABCDEF12")).toMatchObject({
      ok: false,
      code: "INVALID_ORDER_ID",
    });
    expect(parseMcpOrderId("MCP\nORDER")).toMatchObject({ ok: false });
    expect(parseMcpOrderId(null)).toMatchObject({
      ok: false,
      code: "MISSING_ORDER_ID",
    });
  });

  it("bounds the encoded body before parsing JSON", async () => {
    const oversized = new Request("https://mercora.test/order", {
      method: "POST",
      body: JSON.stringify({ orderId: "MCP-OK", pad: "é".repeat(600) }),
    });
    await expect(readMcpOrderLookup(oversized)).resolves.toMatchObject({
      ok: false,
      status: 413,
      code: "BODY_TOO_LARGE",
    });
  });

  it("cancels a headerless stream as soon as it crosses the byte limit", async () => {
    const cancel = vi.fn();
    const request = {
      headers: new Headers(),
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(800));
          controller.enqueue(new Uint8Array(400));
          controller.enqueue(new Uint8Array(10_000));
        },
        cancel,
      }),
    } as Request;

    await expect(readMcpOrderLookup(request)).resolves.toMatchObject({
      ok: false,
      status: 413,
      code: "BODY_TOO_LARGE",
    });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects malformed or negative declared lengths", async () => {
    for (const value of ["invalid", "-1"]) {
      const request = {
        headers: new Headers({ "content-length": value }),
        body: null,
      } as Request;
      await expect(readMcpOrderLookup(request)).resolves.toMatchObject({
        ok: false,
        status: 400,
        code: "INVALID_CONTENT_LENGTH",
      });
    }
  });

  it("rejects malformed JSON and non-string order IDs", async () => {
    await expect(readMcpOrderLookup(new Request("https://mercora.test/order", {
      method: "POST",
      body: "{",
    }))).resolves.toMatchObject({ ok: false, code: "INVALID_REQUEST" });
    await expect(readMcpOrderLookup(new Request("https://mercora.test/order", {
      method: "POST",
      body: JSON.stringify({ orderId: 42 }),
    }))).resolves.toMatchObject({ ok: false, code: "INVALID_ORDER_ID" });
  });
});
