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

  it("never rewrites an unrelated external image", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_IMAGE_CDN", "https://images.example.test");

    expect(cloudflareLoader({ ...args, src: "https://avatars.example.test/me.png" })).toBe(
      "https://avatars.example.test/me.png",
    );
  });
});
