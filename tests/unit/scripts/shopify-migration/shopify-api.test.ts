import { describe, expect, it, vi } from "vitest";
import { ShopifyClient } from "@/scripts/shopify-migration/lib/shopify-api";

function client(fetcher: typeof fetch, overrides: Partial<ConstructorParameters<typeof ShopifyClient>[0]> = {}) {
  return new ShopifyClient({
    origin: "https://merchant.myshopify.com",
    accessToken: "shpat_never-log-this",
    apiVersion: "2026-07",
    fetch: fetcher,
    ...overrides,
  });
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...init.headers },
    ...init,
  });
}

describe("Shopify REST transport", () => {
  it("traverses RFC Link rel=next and preserves all records", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ products: [{ id: 1 }] }, {
        headers: { link: '<https://merchant.myshopify.com/admin/api/2026-07/products.json?page_info=a%2Cb>; rel="previous next"' },
      }))
      .mockResolvedValueOnce(json({ products: [{ id: 2 }] }));
    await expect(client(fetcher).fetchProducts()).resolves.toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    "https://evil.test/admin/api/2026-07/products.json?page_info=x",
    "https://merchant.myshopify.com/admin/api/2025-10/products.json?page_info=x",
    "https://merchant.myshopify.com/products.json?page_info=x",
    "https://merchant.myshopify.com/admin/api/2026-07/%2e%2e/orders.json?page_info=x",
  ])("rejects hostile next target %s before sending credentials", async (next) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ products: [] }, {
      headers: { link: `<${next}>; rel="next"` },
    }));
    await expect(client(fetcher).fetchProducts()).rejects.toThrow(/escaped/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("detects pagination cycles", async () => {
    const first = "https://merchant.myshopify.com/admin/api/2026-07/products.json?limit=250";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ products: [] }, {
      headers: { link: `<${first}>; rel=next` },
    }));
    await expect(client(fetcher).fetchProducts()).rejects.toThrow(/cycle/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("enforces page and record bounds", async () => {
    const next = "https://merchant.myshopify.com/admin/api/2026-07/products.json?page_info=two";
    const pageFetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ products: [{ id: 1 }] }, {
      headers: { link: `<${next}>; rel=next` },
    }));
    await expect(client(pageFetcher, { maxPages: 1 }).fetchProducts()).rejects.toThrow(/exceeded 1 pages/);

    const recordFetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ products: [{ id: 1 }, { id: 2 }] }));
    await expect(client(recordFetcher, { maxRecords: 1 }).fetchProducts()).rejects.toThrow(/exceeded 1 records/);
  });

  it("honors Retry-After with a bounded retry budget", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "retry-after": "2" } }))
      .mockResolvedValueOnce(json({ products: [] }));
    await expect(client(fetcher, { sleep, maxRetries: 1, maxRetryAfterMs: 1_500 }).fetchProducts()).resolves.toEqual([]);
    expect(sleep).toHaveBeenCalledWith(1_500);

    const exhausted = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 }));
    await expect(client(exhausted, { sleep, maxRetries: 1 }).fetchProducts()).rejects.toThrow(/retry budget/);
    expect(exhausted).toHaveBeenCalledTimes(2);
  });

  it("requests all order statuses on the first request", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ orders: [] }));
    await client(fetcher, { includeSensitive: true }).fetchOrders({ query: { fields: "id", status: "open" } });
    const url = fetcher.mock.calls[0][0] as URL;
    expect(url.searchParams.get("status")).toBe("any");
    expect(url.searchParams.get("fields")).toBe("id");
  });

  it("blocks customer and order transport unless sensitive-data access was confirmed", () => {
    const fetcher = vi.fn<typeof fetch>();
    const transport = client(fetcher);
    expect(() => transport.fetchCustomers()).toThrow(/sensitive-data/);
    expect(() => transport.fetchOrders()).toThrow(/sensitive-data/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("never includes the access token in transport errors", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 500 }));
    let message = "";
    try { await client(fetcher).fetchProducts(); } catch (error) { message = String(error); }
    expect(message).not.toContain("shpat_never-log-this");
  });
});
