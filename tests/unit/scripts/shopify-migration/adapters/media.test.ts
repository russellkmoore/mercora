import { createHash } from "node:crypto";
import { HeadObjectCommand, PutObjectCommand, type HeadObjectCommandOutput, type PutObjectCommandOutput } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import type { ExecutionPlan } from "@/scripts/shopify-migration/lib/config";
import type { MediaRewrite } from "@/scripts/shopify-migration/transformers/_shared";
import {
  downloadVerifiedMedia,
  fingerprintMediaSource,
  importMediaPlans,
  R2BindingMediaStore,
  R2S3MediaStore,
  verifyImageSignature,
  wranglerR2GetArguments,
  wranglerR2PutArguments,
} from "@/scripts/shopify-migration/adapters/media";
import {
  REVALIDATING_MEDIA_CACHE_CONTROL,
  MEDIA_IMPORTER_VERSION,
  type ExpectedMediaObject,
  type MediaObjectStore,
  type S3CommandSender,
  type StoredMediaObject,
} from "@/scripts/shopify-migration/adapters/media/r2";

const JPEG = Uint8Array.from(Buffer.from(
  "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJXAIf/Z",
  "base64",
));
const PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNgZGIGAAAOAAeCcsnOAAAAAElFTkSuQmCC",
  "base64",
));
const WEBP = Uint8Array.from(Buffer.from("UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v0gUAA=", "base64"));
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
    inspect: vi.fn(async () => null),
    put: vi.fn(async () => "written" as const),
    ...overrides,
  };
}

function expectedMedia(source = plan(), bytes = JPEG): ExpectedMediaObject {
  return {
    contentType: source.contentType,
    cacheControl: REVALIDATING_MEDIA_CACHE_CONTROL,
    byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sha256Base64: createHash("sha256").update(bytes).digest("base64"),
    sourceFingerprint: fingerprintMediaSource(source.sourceUrl),
  };
}

function storedMedia(overrides: Partial<StoredMediaObject> = {}): StoredMediaObject {
  const expected = expectedMedia();
  return {
    contentType: expected.contentType,
    cacheControl: expected.cacheControl,
    byteLength: expected.byteLength,
    sha256: expected.sha256,
    importer: MEDIA_IMPORTER_VERSION,
    sourceFingerprint: expected.sourceFingerprint,
    importerContentSha256: expected.sha256,
    importerByteLength: String(expected.byteLength),
    ...overrides,
  };
}

function imageResponse(bytes = JPEG, headers: Record<string, string> = {}): Response {
  return new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg", ...headers } });
}

function extendedWebp(includePayload: boolean): Uint8Array {
  const extendedHeader = Buffer.alloc(18);
  extendedHeader.write("VP8X", 0, "ascii");
  extendedHeader.writeUInt32LE(10, 4);
  const chunks = includePayload
    ? Buffer.concat([extendedHeader, Buffer.from(WEBP).subarray(12)])
    : extendedHeader;
  const result = Buffer.alloc(12 + chunks.byteLength);
  result.write("RIFF", 0, "ascii");
  result.writeUInt32LE(result.byteLength - 8, 4);
  result.write("WEBP", 8, "ascii");
  chunks.copy(result, 12);
  return Uint8Array.from(result);
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
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://example-store.myshopify.com/cdn/image.jpg" } }))
      .mockResolvedValueOnce(imageResponse());
    await expect(downloadVerifiedMedia(plan(), {
      allowedHosts: ["cdn.shopify.com", "example-store.myshopify.com"],
      fetcher: privateRedirect,
      resolveHost: async (host) => host === "example-store.myshopify.com" ? ["127.0.0.1"] : PUBLIC_IP,
    })).rejects.toThrow(/non-public address/);
    expect(privateRedirect).toHaveBeenCalledTimes(1);
  });

  it("rejects arbitrary exact hosts and non-CDN myshopify paths before fetching", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(downloadVerifiedMedia(plan({
      sourceUrl: "https://merchant-assets.example.test/image.jpg",
      sourceHost: "merchant-assets.example.test",
    }), {
      allowedHosts: ["merchant-assets.example.test"], fetcher, resolveHost: async () => PUBLIC_IP,
    })).rejects.toThrow(/non-Shopify/);

    const myshopify = plan({
      sourceUrl: "https://example-store.myshopify.com/files/image.jpg",
      sourceHost: "example-store.myshopify.com",
    });
    await expect(downloadVerifiedMedia(myshopify, {
      allowedHosts: ["example-store.myshopify.com"], fetcher, resolveHost: async () => PUBLIC_IP,
    })).rejects.toThrow(/allowed exact HTTPS origin/);
    expect(fetcher).not.toHaveBeenCalled();
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

  it("accepts structurally complete JPEG, PNG, and WebP images", async () => {
    for (const [bytes, extension, contentType] of [
      [JPEG, "jpg", "image/jpeg"],
      [PNG, "png", "image/png"],
      [WEBP, "webp", "image/webp"],
    ] as const) {
      const mediaPlan = plan({
        sourceUrl: `https://cdn.shopify.com/files/image.${extension}`,
        objectKey: `products/shopify_product_abc/1.${extension}`,
        publicPath: `/media/products/shopify_product_abc/1.${extension}`,
        contentType,
      });
      await expect(downloadVerifiedMedia(mediaPlan, {
        allowedHosts: ["cdn.shopify.com"],
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(imageResponse(bytes, { "content-type": contentType })),
        resolveHost: async () => PUBLIC_IP,
      })).resolves.toMatchObject({ bytes, contentType });
    }
  });

  it("rejects truncated, trailing-polyglot, and structurally corrupt image containers", () => {
    for (const [bytes, contentType] of [
      [JPEG, "image/jpeg"], [PNG, "image/png"], [WEBP, "image/webp"],
    ] as const) {
      expect(() => verifyImageSignature(bytes.slice(0, -1), contentType)).toThrow(/signature/);
      const polyglot = new Uint8Array(bytes.byteLength + 8);
      polyglot.set(bytes);
      polyglot.set(Buffer.from("<script>"), bytes.byteLength);
      expect(() => verifyImageSignature(polyglot, contentType)).toThrow(/signature/);
    }

    const badPngCrc = PNG.slice();
    badPngCrc[29] ^= 1;
    expect(() => verifyImageSignature(badPngCrc, "image/png")).toThrow(/signature/);

    const badWebpSync = WEBP.slice();
    badWebpSync[23] ^= 1;
    expect(() => verifyImageSignature(badWebpSync, "image/webp")).toThrow(/signature/);

    const excessiveWebpPixels = WEBP.slice();
    excessiveWebpPixels[26] = 0xff;
    excessiveWebpPixels[27] = 0x3f;
    excessiveWebpPixels[28] = 0xff;
    excessiveWebpPixels[29] = 0x3f;
    expect(() => verifyImageSignature(excessiveWebpPixels, "image/webp")).toThrow(/signature/);

    expect(() => verifyImageSignature(extendedWebp(false), "image/webp")).toThrow(/signature/);
    expect(() => verifyImageSignature(extendedWebp(true), "image/webp")).not.toThrow();
  });
});

describe("media import execution", () => {
  it("performs zero network, inspection, or writes in dry-run mode", async () => {
    const targetStore = store();
    const fetcher = vi.fn<typeof fetch>();
    const resolver = vi.fn(async () => PUBLIC_IP);
    await expect(importMediaPlans([plan()], {
      execution: execution(),
      wranglerConfigText: WRANGLER_CONFIG,
      allowedHosts: ["cdn.shopify.com"],
      store: targetStore,
      download: { fetcher, resolveHost: resolver },
    })).resolves.toEqual([{
      objectKey: plan().objectKey,
      publicPath: plan().publicPath,
      contentType: "image/jpeg",
      status: "planned",
      byteLength: null,
      sha256: null,
    }]);
    expect(fetcher).not.toHaveBeenCalled();
    expect(resolver).not.toHaveBeenCalled();
    expect(targetStore.inspect).not.toHaveBeenCalled();
    expect(targetStore.put).not.toHaveBeenCalled();
  });

  it("downloads first and accepts a conditional-write race only after exact verification", async () => {
    const inspect = vi.fn(async () => storedMedia());
    const put = vi.fn(async () => "exists" as const);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(imageResponse());
    const result = await importMediaPlans([plan()], {
      execution: execution({ dryRun: false, apply: true }),
      wranglerConfigText: WRANGLER_CONFIG,
      allowedHosts: ["cdn.shopify.com"],
      store: store({ inspect, put }),
      download: { fetcher, resolveHost: async () => PUBLIC_IP },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(result[0]).toEqual({
      objectKey: plan().objectKey,
      publicPath: plan().publicPath,
      contentType: "image/jpeg",
      status: "verified-existing",
      byteLength: JPEG.byteLength,
      sha256: expectedMedia().sha256,
    });
  });

  it("rejects changed-source collisions and wrong importer metadata without overwriting", async () => {
    const changedSource = plan({ sourceUrl: "https://cdn.shopify.com/files/replaced-image.jpg" });
    const put = vi.fn(async () => "exists" as const);
    await expect(importMediaPlans([changedSource], {
      execution: execution({ dryRun: false, apply: true }),
      wranglerConfigText: WRANGLER_CONFIG,
      allowedHosts: ["cdn.shopify.com"],
      store: store({ put, inspect: vi.fn(async () => storedMedia()) }),
      download: { fetcher: vi.fn<typeof fetch>().mockResolvedValue(imageResponse()), resolveHost: async () => PUBLIC_IP },
    })).rejects.toThrow(/explicit overwrite review/);
    expect(put).toHaveBeenCalledWith("store-media", changedSource.objectKey, JPEG, expect.objectContaining({ overwrite: false }));

    await expect(importMediaPlans([plan()], {
      execution: execution({ dryRun: false, apply: true }),
      wranglerConfigText: WRANGLER_CONFIG,
      allowedHosts: ["cdn.shopify.com"],
      store: store({
        put: vi.fn(async () => "exists" as const),
        inspect: vi.fn(async () => storedMedia({ importer: "untrusted-importer" })),
      }),
      download: { fetcher: vi.fn<typeof fetch>().mockResolvedValue(imageResponse()), resolveHost: async () => PUBLIC_IP },
    })).rejects.toThrow(/explicit overwrite review/);
  });

  it("rejects corrupt, partial, or content-type-mismatched existing objects", async () => {
    for (const existing of [
      storedMedia({ sha256: "0".repeat(64) }),
      storedMedia({ byteLength: JPEG.byteLength - 1 }),
      storedMedia({ contentType: "image/png" }),
      storedMedia({ importerContentSha256: undefined }),
    ]) {
      await expect(importMediaPlans([plan()], {
        execution: execution({ dryRun: false, apply: true }),
        wranglerConfigText: WRANGLER_CONFIG,
        allowedHosts: ["cdn.shopify.com"],
        store: store({ put: vi.fn(async () => "exists" as const), inspect: vi.fn(async () => existing) }),
        download: { fetcher: vi.fn<typeof fetch>().mockResolvedValue(imageResponse()), resolveHost: async () => PUBLIC_IP },
      })).rejects.toThrow(/explicit overwrite review/);
    }
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

  it("uses the canonical preview bucket and returns verified persistence details", async () => {
    const put = vi.fn(async () => "written" as const);
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
    expect(put).toHaveBeenCalledWith("store-media-preview", plan().objectKey, JPEG, expect.objectContaining({
      overwrite: false,
      byteLength: JPEG.byteLength,
      sha256: expectedMedia().sha256,
      sourceFingerprint: expectedMedia().sourceFingerprint,
    }));
    expect(result[0]).toMatchObject({
      status: "written",
      byteLength: JPEG.byteLength,
      sha256: expectedMedia().sha256,
      publicPath: plan().publicPath,
    });
  });

  it("overwrites only after both overwrite flags are explicit", async () => {
    const put = vi.fn(async () => "written" as const);
    const inspect = vi.fn(async () => storedMedia({ sha256: "0".repeat(64) }));
    await importMediaPlans([plan()], {
      execution: execution({
        dryRun: false,
        apply: true,
        overwrite: true,
        confirmedOverwrite: true,
      }),
      wranglerConfigText: WRANGLER_CONFIG,
      allowedHosts: ["cdn.shopify.com"],
      store: store({ put, inspect }),
      download: { fetcher: vi.fn<typeof fetch>().mockResolvedValue(imageResponse()), resolveHost: async () => PUBLIC_IP },
    });
    expect(put).toHaveBeenCalledWith("store-media", plan().objectKey, JPEG, expect.objectContaining({ overwrite: true }));
    expect(inspect).not.toHaveBeenCalled();
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
      ...expectedMedia(), cacheControl: "public, max-age=1", overwrite: false,
    })).resolves.toBe("exists");
    expect(bucket.put).toHaveBeenCalledWith(plan().objectKey, JPEG, expect.objectContaining({
      onlyIf: { etagDoesNotMatch: "*" },
      httpMetadata: { contentType: "image/jpeg", cacheControl: "public, max-age=1" },
      customMetadata: expect.objectContaining({
        "mercora-importer": MEDIA_IMPORTER_VERSION,
        "mercora-content-sha256": expectedMedia().sha256,
      }),
      sha256: expect.any(Uint8Array),
    }));
  });

  it("inspects binding objects using actual R2 checksum and importer-owned metadata", async () => {
    const expected = expectedMedia();
    const bucket = {
      head: vi.fn(async () => ({
        size: expected.byteLength,
        checksums: { sha256: Uint8Array.from(Buffer.from(expected.sha256, "hex")).buffer },
        httpMetadata: { contentType: expected.contentType, cacheControl: expected.cacheControl },
        customMetadata: {
          "mercora-importer": MEDIA_IMPORTER_VERSION,
          "mercora-source-sha256": expected.sourceFingerprint,
          "mercora-content-sha256": expected.sha256,
          "mercora-byte-length": String(expected.byteLength),
        },
      })),
    } as unknown as R2Bucket;
    const adapter = new R2BindingMediaStore("store-media", bucket);
    await expect(adapter.inspect("store-media", plan().objectKey)).resolves.toEqual(storedMedia());
  });

  it("uses S3 conditional PutObject with checksum and importer metadata", async () => {
    const send = vi.fn(async (command: HeadObjectCommand | PutObjectCommand) => {
      if (command instanceof PutObjectCommand) return {} as PutObjectCommandOutput;
      return {} as HeadObjectCommandOutput;
    });
    const adapter = new R2S3MediaStore("store-media", { send } as S3CommandSender);
    await expect(adapter.put("store-media", plan().objectKey, JPEG, {
      ...expectedMedia(), overwrite: false,
    })).resolves.toBe("written");
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toMatchObject({
      Bucket: "store-media",
      Key: plan().objectKey,
      ContentLength: JPEG.byteLength,
      ContentType: "image/jpeg",
      CacheControl: REVALIDATING_MEDIA_CACHE_CONTROL,
      ChecksumSHA256: expectedMedia().sha256Base64,
      IfNoneMatch: "*",
      Metadata: expect.objectContaining({
        "mercora-importer": MEDIA_IMPORTER_VERSION,
        "mercora-source-sha256": expectedMedia().sourceFingerprint,
      }),
    });
  });

  it.each([
    [409, "ConditionalRequestConflict"],
    [412, "PreconditionFailed"],
  ])("maps an S3 conditional race (%s) to exists and re-heads verifiable metadata", async (status, name) => {
    const expected = expectedMedia();
    const send = vi.fn(async (command: HeadObjectCommand | PutObjectCommand) => {
      if (command instanceof PutObjectCommand) {
        throw Object.assign(new Error("redacted"), { name, $metadata: { httpStatusCode: status } });
      }
      return {
        ContentLength: expected.byteLength,
        ContentType: expected.contentType,
        CacheControl: expected.cacheControl,
        ChecksumSHA256: expected.sha256Base64,
        Metadata: {
          "mercora-importer": MEDIA_IMPORTER_VERSION,
          "mercora-source-sha256": expected.sourceFingerprint,
          "mercora-content-sha256": expected.sha256,
          "mercora-byte-length": String(expected.byteLength),
        },
      } as unknown as HeadObjectCommandOutput;
    });
    const adapter = new R2S3MediaStore("store-media", { send } as S3CommandSender);
    await expect(adapter.put("store-media", plan().objectKey, JPEG, {
      ...expected, overwrite: false,
    })).resolves.toBe("exists");
    await expect(adapter.inspect("store-media", plan().objectKey)).resolves.toEqual(storedMedia());
    const head = send.mock.calls[1][0];
    expect(head).toBeInstanceOf(HeadObjectCommand);
    expect((head as HeadObjectCommand).input.ChecksumMode).toBe("ENABLED");
  });

  it("never silently overwrites through either object adapter", async () => {
    const binding = {
      put: vi.fn(async () => null),
    } as unknown as R2Bucket;
    await new R2BindingMediaStore("store-media", binding).put("store-media", plan().objectKey, JPEG, {
      ...expectedMedia(), overwrite: false,
    });
    expect(binding.put).toHaveBeenCalledWith(expect.any(String), expect.any(Uint8Array), expect.objectContaining({
      onlyIf: { etagDoesNotMatch: "*" },
    }));

    const send = vi.fn(async (_command: HeadObjectCommand | PutObjectCommand) => ({} as PutObjectCommandOutput));
    await new R2S3MediaStore("store-media", { send } as S3CommandSender).put(
      "store-media", plan().objectKey, JPEG, { ...expectedMedia(), overwrite: false },
    );
    expect((send.mock.calls[0][0] as PutObjectCommand).input.IfNoneMatch).toBe("*");
  });
});
