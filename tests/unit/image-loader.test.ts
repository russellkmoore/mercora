import { afterEach, describe, expect, it, vi } from "vitest";
import cloudflareLoader from "@/image-loader";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cloudflareLoader", () => {
  const args = { src: "/products/example.png", width: 640, quality: 80 };

  it("uses a same-origin media fallback when no CDN is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_IMAGE_CDN", undefined);

    expect(cloudflareLoader(args)).toBe("/media/products/example.png");
  });

  it("can bypass Image Transformations without breaking the image URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_IMAGE_CDN", "https://images.example.test");
    vi.stubEnv("NEXT_PUBLIC_IMAGE_TRANSFORMS", "false");

    expect(cloudflareLoader(args)).toBe("https://images.example.test/products/example.png");
  });

  it("normalizes the Image Transformations feature flag", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_IMAGE_CDN", "https://images.example.test");
    vi.stubEnv("NEXT_PUBLIC_IMAGE_TRANSFORMS", " FALSE ");

    expect(cloudflareLoader(args)).toBe("https://images.example.test/products/example.png");
  });

  it("serves assets that ship in public/ from the app, not the image bucket", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_IMAGE_CDN", "https://images.example.test");

    // The bucket holds product media only; rewriting these produces a 404.
    for (const src of ["/volt.png", "/placeholder.jpg", "/logo.svg"]) {
      expect(cloudflareLoader({ ...args, src })).toBe(src);
    }
  });

  it("still routes product media to the bucket", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_IMAGE_CDN", "https://images.example.test");

    expect(cloudflareLoader(args)).toBe(
      "https://images.example.test/cdn-cgi/image/width=640,format=auto,quality=80/products/example.png",
    );
  });

  it("never rewrites an unrelated external image", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_IMAGE_CDN", "https://images.example.test");

    expect(cloudflareLoader({ ...args, src: "https://avatars.example.test/me.png" })).toBe(
      "https://avatars.example.test/me.png",
    );
  });
});
