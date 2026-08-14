import { describe, expect, it, vi } from "vitest";
import type { ExecutionPlan } from "@/scripts/shopify-migration/lib/config";
import type { MediaRewrite } from "@/scripts/shopify-migration/transformers/_shared";
import {
  downloadVerifiedMedia,
  importMediaPlans,
  R2BindingMediaStore,
  wranglerR2GetArguments,
  wranglerR2PutArguments,
} from "@/scripts/shopify-migration/adapters/media";
import type { MediaObjectStore } from "@/scripts/shopify-migration/adapters/media/r2";

const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xc0, 0x00, 0x08, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0xff, 0xd9,
]);
const PUBLIC_IP = ["93.184.216.34"];
const WRANGLER_CONFIG = `{
  "r2_buckets": [{
    "binding": "MEDIA",
    "bucket_name": "store-media",
    "preview_bucket_name": "store-media-preview"
  }]
}`;

function plan(overrides: Partial<MediaRewrite> = {}): MediaRewrite {
  return {
    sourceUrl: "https://cdn.shopify.com/files/image.jpg",
    sourceHost: "cdn.shopify.com",
    objectKey: "products/shopify_product_abc/1.jpg",
    publicPath: "/media/products/shopify_product_abc/1.jpg",
    contentType: "image/jpeg",
    role: "product",
    ownerId: "shopify_product_abc",
    requiredBeforePersistence: true,
    ...overrides,
  };
}

function execution(overrides: Partial<ExecutionPlan> = {}): ExecutionPlan {
  return {
    dryRun: true,
    apply: false,
    target: "local",
    includeSensitive: false,
    overwrite: false,
    confirmedSensitiveData: false,
    confirmedPreview: false,
    confirmedProduction: false,
    confirmedOverwrite: false,
    ...overrides,
  };
}

function store(overrides: Partial<MediaObjectStore> = {}): MediaObjectStore {
  return {
    head: vi.fn(async () => false),
    put: vi.fn(async () => "written" as const),
    ...overrides,
  };
}

function imageResponse(bytes = JPEG, headers: Record<string, string> = {}): Response {
  return new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg", ...headers } });
}

describe("safe media downloader", () => {
  it("downloads an allowlisted HTTPS image without forwarding credentials", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBeNull();
      expect(headers.get("cookie")).toBeNull();
      expect(init?.redirect).toBe("manual");
      return imageResponse(JPEG, { "content-length": String(JPEG.byteLength) });
    });
    const media = await downloadVerifiedMedia(plan(), {
      allowedHosts: ["cdn.shopify.com"],
      fetcher,
      resolveHost: async () => PUBLIC_IP,
    });
    expect(media.bytes).toEqual(JPEG);
    expect(media.contentType).toBe("image/jpeg");
  });

  it("revalidates every redirect host and resolved address", async () => {
    const evilRedirect = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "https://evil.test/image.jpg" } }),
    );
    await expect(downloadVerifiedMedia(plan(), {
      allowedHosts: ["cdn.shopify.com"], fetcher: evilRedirect, resolveHost: async () => PUBLIC_IP,
    })).rejects.toThrow(/allowed exact HTTPS origin/);
    expect(evilRedirect).toHaveBeenCalledTimes(1);

    const privateRedirect = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://media.example.test/image.jpg" } }))
      .mockResolvedValueOnce(imageResponse());
    await expect(downloadVerifiedMedia(plan(), {
      allowedHosts: ["cdn.shopify.com", "media.example.test"],
      fetcher: privateRedirect,
      resolveHost: async (host) => host === "media.example.test" ? ["127.0.0.1"] : PUBLIC_IP,
    })).rejects.toThrow(/non-public address/);
    expect(privateRedirect).toHaveBeenCalledTimes(1);
  });

  it("rejects oversized declared and chunked bodies", async () => {
    const declared = vi.fn<typeof fetch>().mockResolvedValue(imageResponse(JPEG, { "content-length": "999" }));
    await expect(downloadVerifiedMedia(plan(), {
      allowedHosts: ["cdn.shopify.com"], fetcher: declared, resolveHost: async () => PUBLIC_IP, maxBytes: 20,
    })).rejects.toThrow(/Content-Length/);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(12));
        controller.enqueue(new Uint8Array(12));
        controller.close();
      },
    });
    const chunked = vi.fn<typeof fetch>().mockResolvedValue(new Response(stream, {
      status: 200, headers: { "content-type": "image/jpeg" },
    }));
    await expect(downloadVerifiedMedia(plan(), {
      allowedHosts: ["cdn.shopify.com"], fetcher: chunked, resolveHost: async () => PUBLIC_IP, maxBytes: 20,
    })).rejects.toThrow(/exceeds 20 bytes/);
  });

  it("keeps the deadline active while streaming and cancels a stalled body", async () => {
    const cancelled = vi.fn();
    const stalled = new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => undefined),
      cancel: cancelled,
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(stalled, {
      status: 200, headers: { "content-type": "image/jpeg" },
    }));
    await expect(downloadVerifiedMedia(plan(), {
      allowedHosts: ["cdn.shopify.com"], fetcher, resolveHost: async () => PUBLIC_IP, timeoutMs: 5,
    })).rejects.toThrow(/timed out/);
    expect(cancelled).toHaveBeenCalled();
  });

  it("bounds DNS resolution before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(downloadVerifiedMedia(plan(), {
      allowedHosts: ["cdn.shopify.com"],
      fetcher,
      resolveHost: () => new Promise<readonly string[]>(() => undefined),
      timeoutMs: 5,
    })).rejects.toThrow(/DNS resolution timed out/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects MIME, extension, and magic-byte spoofing", async () => {
    const pngClaim = vi.fn<typeof fetch>().mockResolvedValue(new Response(JPEG, {
      status: 200, headers: { "content-type": "image/png" },
    }));
    await expect(downloadVerifiedMedia(plan(), {
      allowedHosts: ["cdn.shopify.com"], fetcher: pngClaim, resolveHost: async () => PUBLIC_IP,
    })).rejects.toThrow(/Content-Type/);

    const fakeJpeg = vi.fn<typeof fetch>().mockResolvedValue(imageResponse(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])));
    await expect(downloadVerifiedMedia(plan(), {
      allowedHosts: ["cdn.shopify.com"], fetcher: fakeJpeg, resolveHost: async () => PUBLIC_IP,
    })).rejects.toThrow(/signature/);

    const unsupported = {
      ...plan(),
      objectKey: "products/shopify_product_abc/1.gif",
      publicPath: "/media/products/shopify_product_abc/1.gif",
      contentType: "image/gif",
      sourceUrl: "https://cdn.shopify.com/files/image.gif",
    } as unknown as MediaRewrite;
    await expect(downloadVerifiedMedia(unsupported, {
      allowedHosts: ["cdn.shopify.com"], fetcher: fakeJpeg, resolveHost: async () => PUBLIC_IP,
    }))
      .rejects.toThrow(/unsupported/);
  });
});

describe("media import execution", () => {
  it("performs zero network, head, or writes in dry-run mode", async () => {
    const targetStore = store();
    const fetcher = vi.fn<typeof fetch>();
    const resolver = vi.fn(async () => PUBLIC_IP);
    await expect(importMediaPlans([plan()], {
      execution: execution(),
      wranglerConfigText: WRANGLER_CONFIG,
      allowedHosts: ["cdn.shopify.com"],
      store: targetStore,
      download: { fetcher, resolveHost: resolver },
    })).resolves.toEqual([{ objectKey: plan().objectKey, status: "planned", bytes: 0 }]);
    expect(fetcher).not.toHaveBeenCalled();
    expect(resolver).not.toHaveBeenCalled();
    expect(targetStore.head).not.toHaveBeenCalled();
    expect(targetStore.put).not.toHaveBeenCalled();
  });

  it("skips an existing object without downloading or overwriting", async () => {
    const targetStore = store({ head: vi.fn(async () => true) });
    const fetcher = vi.fn<typeof fetch>();
    const result = await importMediaPlans([plan()], {
      execution: execution({ dryRun: false, apply: true }),
      wranglerConfigText: WRANGLER_CONFIG,
      allowedHosts: ["cdn.shopify.com"],
      store: targetStore,
      download: { fetcher, resolveHost: async () => PUBLIC_IP },
    });
    expect(result[0].status).toBe("exists");
    expect(fetcher).not.toHaveBeenCalled();
    expect(targetStore.put).not.toHaveBeenCalled();
  });

  it("requires target and overwrite confirmations independently", async () => {
    const options = { wranglerConfigText: WRANGLER_CONFIG, allowedHosts: ["cdn.shopify.com"], store: store() };
    await expect(importMediaPlans([plan()], {
      ...options, execution: execution({ target: "preview", dryRun: false, apply: true }),
    })).rejects.toThrow(/preview confirmation/);
    await expect(importMediaPlans([plan()], {
      ...options,
      execution: execution({ dryRun: false, apply: true, overwrite: true, confirmedOverwrite: false }),
    })).rejects.toThrow(/overwrite confirmation/);
  });

  it("uses the canonical preview bucket and preserves conditional create results", async () => {
    const put = vi.fn(async () => "exists" as const);
    const targetStore = store({ put });
    const result = await importMediaPlans([plan()], {
      execution: execution({ target: "preview", dryRun: false, apply: true, confirmedPreview: true }),
      wranglerConfigText: WRANGLER_CONFIG,
      allowedHosts: ["cdn.shopify.com"],
      store: targetStore,
      download: {
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(imageResponse()),
        resolveHost: async () => PUBLIC_IP,
      },
    });
    expect(put).toHaveBeenCalledWith("store-media-preview", plan().objectKey, JPEG, expect.objectContaining({ overwrite: false }));
    expect(result[0]).toMatchObject({ status: "exists", bytes: 0 });
  });
});

describe("R2 adapters and command construction", () => {
  it("constructs explicit local/remote argv arrays without shell or secrets", () => {
    const get = wranglerR2GetArguments({
      bucketName: "store-media-preview", objectKey: plan().objectKey, target: "preview",
      environment: "staging", configPath: "wrangler.jsonc",
    });
    expect(get).toEqual([
      "r2", "object", "get", `store-media-preview/${plan().objectKey}`, "--pipe", "--remote",
      "--config", "wrangler.jsonc", "--env", "staging",
    ]);
    const put = wranglerR2PutArguments({
      bucketName: "store-media", objectKey: plan().objectKey, target: "local", configPath: "wrangler.jsonc",
      contentType: "image/jpeg", overwriteConfirmed: true,
    });
    expect(put).toContain("--local");
    expect(put).toContain("--content-type");
    expect(put).toContain("--cache-control");
    expect(JSON.stringify(put)).not.toMatch(/token|secret|authorization/i);
    expect(() => wranglerR2PutArguments({
      bucketName: "store-media", objectKey: plan().objectKey, target: "local", configPath: "wrangler.jsonc",
      contentType: "image/jpeg", overwriteConfirmed: false,
    })).toThrow(/create-only/);
    expect(() => wranglerR2GetArguments({
      bucketName: "store-media", objectKey: plan().objectKey, target: "local", configPath: "--remote",
    })).toThrow(/config path is invalid/);
  });

  it("uses an atomic R2 conditional when overwrite is not confirmed", async () => {
    const bucket = {
      head: vi.fn(async () => null),
      put: vi.fn(async () => null),
    } as unknown as R2Bucket;
    const adapter = new R2BindingMediaStore("store-media", bucket);
    await expect(adapter.put("store-media", plan().objectKey, JPEG, {
      contentType: "image/jpeg", cacheControl: "public, max-age=1", overwrite: false,
    })).resolves.toBe("exists");
    expect(bucket.put).toHaveBeenCalledWith(plan().objectKey, JPEG, expect.objectContaining({
      onlyIf: { etagDoesNotMatch: "*" },
      httpMetadata: { contentType: "image/jpeg", cacheControl: "public, max-age=1" },
    }));
  });
});
