import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCloudflareContext, bucket } = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  bucket: { get: vi.fn(), head: vi.fn() },
}));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));

import { GET, HEAD, resolvePublicMediaKey } from "@/app/media/[...key]/route";

function context(...key: string[]) {
  return { params: Promise.resolve({ key }) };
}

function object(overrides: Record<string, unknown> = {}) {
  return {
    key: "products/example.png",
    size: 4,
    etag: "abc123",
    httpEtag: '"abc123"',
    uploaded: new Date("2026-08-01T00:00:00.000Z"),
    httpMetadata: { contentType: "image/png" },
    customMetadata: {},
    range: undefined,
    checksums: {},
    storageClass: "Standard",
    ssecKeyMd5: undefined,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3, 4]));
        controller.close();
      },
    }),
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    bytes: vi.fn(),
    text: vi.fn(),
    json: vi.fn(),
    blob: vi.fn(),
    writeHttpMetadata: vi.fn(),
    ...overrides,
  };
}

describe("same-origin public media route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCloudflareContext.mockResolvedValue({ env: { MEDIA: bucket } });
    bucket.get.mockResolvedValue(object());
    bucket.head.mockResolvedValue(object({ body: undefined }));
  });

  it.each(["products", "categories", "blog", "pages"])(
    "allows the %s public prefix",
    (prefix) => expect(resolvePublicMediaKey([prefix, "image.png"])).toBe(`${prefix}/image.png`),
  );

  it.each([
    ["knowledge_md", "secret.md"],
    ["products_md", "secret.md"],
    ["products", "..", "secret.png"],
    ["products", "%252e%252e", "secret.png"],
    ["products", "nested\\secret.png"],
    ["products", "line\nbreak.png"],
  ])("rejects private or malformed keys: %s", (...segments) => {
    expect(resolvePublicMediaKey(segments)).toBeNull();
  });

  it("streams verified image metadata with immutable defensive headers", async () => {
    const response = await GET(new Request("https://shop.example/media/products/example.png"), context("products", "example.png"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe("4");
    expect(response.headers.get("etag")).toBe('"abc123"');
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("serves HEAD without reading the object body", async () => {
    const response = await HEAD(new Request("https://shop.example/media/products/example.png", { method: "HEAD" }), context("products", "example.png"));
    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
    expect(bucket.head).toHaveBeenCalledWith("products/example.png");
    expect(bucket.get).not.toHaveBeenCalled();

    bucket.head.mockResolvedValueOnce(null);
    const missing = await HEAD(new Request("https://shop.example/media/products/missing.png", { method: "HEAD" }), context("products", "missing.png"));
    expect(missing.status).toBe(404);
    expect(missing.body).toBeNull();
  });

  it("returns a bodyless 304 for matching strong, weak, or list ETags", async () => {
    for (const value of ['"abc123"', 'W/"abc123"', '"other", W/"abc123"']) {
      const response = await GET(new Request("https://shop.example/media/products/example.png", {
        headers: { "If-None-Match": value },
      }), context("products", "example.png"));
      expect(response.status).toBe(304);
      expect(response.body).toBeNull();
    }
  });

  it("hides missing objects, invalid metadata, and private keys", async () => {
    bucket.get.mockResolvedValueOnce(null);
    expect((await GET(new Request("https://shop.example/media/products/missing.png"), context("products", "missing.png"))).status).toBe(404);

    bucket.get.mockResolvedValueOnce(object({ httpMetadata: { contentType: "text/html" } }));
    expect((await GET(new Request("https://shop.example/media/products/example.png"), context("products", "example.png"))).status).toBe(404);

    expect((await GET(new Request("https://shop.example/media/knowledge_md/secret.md"), context("knowledge_md", "secret.md"))).status).toBe(404);
  });

  it("returns a generic unavailable response for a missing binding or R2 error", async () => {
    getCloudflareContext.mockResolvedValueOnce({ env: {} });
    let response = await GET(new Request("https://shop.example/media/products/example.png"), context("products", "example.png"));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Service unavailable");

    bucket.get.mockRejectedValueOnce(new Error("sensitive bucket detail"));
    response = await GET(new Request("https://shop.example/media/products/example.png"), context("products", "example.png"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive");
  });
});
