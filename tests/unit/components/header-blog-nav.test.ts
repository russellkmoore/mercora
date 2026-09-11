import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D-03, D-07, D-08, T-16-11: `Header.tsx` resolves the blog nav's visibility
 * (any published article exists) and label server-side, collapsing the
 * existence check to a boolean before it ever crosses into `HeaderClient`.
 * `HeaderClient.tsx` renders that boolean/label pair identically in the
 * desktop nav and the mobile sheet, so the two can never disagree.
 */

const mocks = vi.hoisted(() => ({
  posts: [] as Array<{ id: string; slug: string; title: string }>,
  label: "Blog",
  getPublishedBlogPosts: vi.fn(async () => mocks.posts),
}));

vi.mock("@/lib/models", () => ({
  listCategories: vi.fn(async () => []),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock("@/lib/models/blog", () => ({
  getPublishedBlogPosts: mocks.getPublishedBlogPosts,
}));

vi.mock("@/lib/content/settings", () => ({
  getContentSettings: vi.fn(async () => ({
    blogNavLabel: mocks.label,
    blogHomeBlockEnabled: true,
    blogHomeBlockHeading: "From the Blog",
    blogHomeBlockCount: 3,
    blogHomeBlockPlacement: "after_featured",
  })),
}));

vi.mock("@/components/HeaderClient", () => ({
  // Plain identity function — the tree walk below only needs a stable
  // reference to match against, never the real Radix/Clerk/cart-store tree.
  default: (props: unknown) => props,
}));

import Header from "@/components/Header";
import HeaderClient from "@/components/HeaderClient";

/** Walks the returned tree for the client boundary's props (checkout-honor-gate.test.ts pattern). */
function clientProps(node: unknown): Record<string, unknown> | undefined {
  if (node == null || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = clientProps(child);
      if (found) return found;
    }
    return undefined;
  }
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (element.type === HeaderClient) return element.props;
  if (element.props?.children) return clientProps(element.props.children);
  return undefined;
}

async function headerClientProps(): Promise<Record<string, unknown> | undefined> {
  return clientProps(
    (await Header()) as unknown as React.ReactElement,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.posts = [];
  mocks.label = "Blog";
  mocks.getPublishedBlogPosts.mockImplementation(async () => mocks.posts);
});

describe("Header() resolves blog nav visibility and label server-side", () => {
  it("passes showBlogNav: false when no article is published", async () => {
    mocks.posts = [];
    const props = await headerClientProps();
    expect(props?.showBlogNav).toBe(false);
  });

  it("passes showBlogNav: true when at least one article is published", async () => {
    mocks.posts = [{ id: "post-1", slug: "hello-world", title: "Hello World" }];
    const props = await headerClientProps();
    expect(props?.showBlogNav).toBe(true);
  });

  it("passes blogNavLabel equal to whatever getContentSettings() returned, verbatim", async () => {
    mocks.label = "Latest Articles";
    const props = await headerClientProps();
    expect(props?.blogNavLabel).toBe("Latest Articles");
  });

  it("showBlogNav is strictly a boolean, never an array/number/truthy object, in both cases", async () => {
    mocks.posts = [];
    expect(typeof (await headerClientProps())?.showBlogNav).toBe("boolean");

    mocks.posts = [{ id: "post-1", slug: "hello-world", title: "Hello World" }];
    expect(typeof (await headerClientProps())?.showBlogNav).toBe("boolean");
  });

  it("the client boundary's props contain no post object and no array of posts under any key", async () => {
    mocks.posts = [{ id: "post-1", slug: "hello-world", title: "Hello World" }];
    const props = await headerClientProps();
    expect(props).toBeDefined();
    for (const value of Object.values(props ?? {})) {
      if (Array.isArray(value)) {
        // categories legitimately arrives as an array (kept empty by this
        // test's mock); the invariant under test is that no array of
        // *objects* — i.e. no array of post rows — crosses the boundary.
        expect(value.some((item) => item !== null && typeof item === "object")).toBe(false);
      } else if (value !== null && typeof value === "object") {
        expect("slug" in value).toBe(false);
        expect("title" in value).toBe(false);
      }
    }
  });

  it("calls getPublishedBlogPosts exactly once, with a limit of 1", async () => {
    await headerClientProps();
    expect(mocks.getPublishedBlogPosts).toHaveBeenCalledTimes(1);
    expect(mocks.getPublishedBlogPosts).toHaveBeenCalledWith({ limit: 1 });
  });

  it("resolves showBlogNav: false and does not throw when getPublishedBlogPosts rejects (CR-01)", async () => {
    mocks.getPublishedBlogPosts.mockImplementation(async () => {
      throw new Error("D1 connectivity error");
    });

    await expect(headerClientProps()).resolves.toBeDefined();
    const props = await headerClientProps();
    expect(props?.showBlogNav).toBe(false);
  });
});

describe("HeaderClient.tsx: desktop and mobile navs read the same two props", () => {
  const source = readFileSync(
    join(process.cwd(), "components/HeaderClient.tsx"),
    "utf8",
  );

  it("has exactly two `showBlogNav &&` conditionals — one desktop, one mobile", () => {
    expect(source.match(/showBlogNav &&/g)?.length).toBe(2);
  });

  it("has exactly two `{blogNavLabel}` reads", () => {
    expect(source.match(/\{blogNavLabel\}/g)?.length).toBe(2);
  });

  it('has exactly two links to "/blog"', () => {
    expect(source.match(/href="\/blog"/g)?.length).toBe(2);
  });
});
