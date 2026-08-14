import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/models/pages", () => ({ getPageBySlug: vi.fn() }));
vi.mock("@/lib/cms/custom-js-guard", () => ({ getCustomJsEnabled: vi.fn(async () => false) }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(async () => ({ userId: null })) }));
vi.mock("@/app/[slug]/PageRenderer", () => ({ default: () => null }));

import PublicPage, { generateMetadata } from "@/app/[slug]/page";
import { getPageBySlug } from "@/lib/models/pages";
import { auth } from "@clerk/nextjs/server";

const getPage = vi.mocked(getPageBySlug);

function page(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: "about",
    title: "About",
    content: "<p>Body</p>",
    template: "default",
    is_protected: false,
    custom_css: null,
    custom_js: null,
    excerpt: null,
    meta_title: null,
    meta_description: null,
    meta_keywords: null,
    published_at: null,
    created_at: 1,
    updated_at: 1,
    version: 1,
    ...overrides,
  } as never;
}

function digestOf(error: unknown): string {
  return String((error as { digest?: unknown })?.digest ?? "");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(auth).mockResolvedValue({ userId: null } as never);
});

describe("CMS public page control flow", () => {
  it("propagates a protected-page sign-in redirect", async () => {
    getPage.mockResolvedValue(page({ is_protected: true }));
    const error = await PublicPage({ params: Promise.resolve({ slug: "about" }) })
      .then(() => null).catch((value) => value);
    expect(digestOf(error)).toContain("NEXT_REDIRECT");
    expect(digestOf(error)).toContain("/sign-in");
  });

  it("uses a real 404 only for a missing row", async () => {
    getPage.mockResolvedValue(null);
    const error = await PublicPage({ params: Promise.resolve({ slug: "missing" }) })
      .then(() => null).catch((value) => value);
    expect(digestOf(error)).toContain("404");
  });

  it("surfaces storage failures rather than converting them to 404", async () => {
    getPage.mockRejectedValue(new Error("D1 unavailable"));
    const error = await PublicPage({ params: Promise.resolve({ slug: "about" }) })
      .then(() => null).catch((value) => value);
    expect(error).toEqual(expect.objectContaining({ message: "D1 unavailable" }));
    expect(digestOf(error)).not.toContain("404");
  });

  it("allows a signed-in visitor to render a protected page", async () => {
    getPage.mockResolvedValue(page({ is_protected: true }));
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    await expect(PublicPage({ params: Promise.resolve({ slug: "about" }) })).resolves.toBeDefined();
  });

  it("does not claim a storage failure means Page Not Found in metadata", async () => {
    getPage.mockRejectedValue(new Error("D1 unavailable"));
    await expect(generateMetadata({ params: Promise.resolve({ slug: "about" }) }))
      .resolves.toEqual({ title: "Mercora" });
  });
});
