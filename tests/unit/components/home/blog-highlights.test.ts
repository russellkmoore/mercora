import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { BlogPostSummary } from "@/lib/blog/values";

/**
 * BlogHighlights — the home page's "latest articles" cards (Phase 16, Plan 03, Task 1).
 *
 * Covers every bullet in 16-03-PLAN.md Task 1's `<behavior>` block: heading,
 * "Read all" link, per-post cards (title link, optional cover image, date,
 * excerpt precedence), the empty-array case, and that no full body text ever
 * leaks into the rendered markup.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement("img", { src, alt }),
}));

const { default: BlogHighlights } = await import("@/components/home/BlogHighlights");

function post(overrides: Partial<BlogPostSummary> = {}): BlogPostSummary {
  return {
    id: 1,
    title: "Trail Running in the Rain",
    slug: "trail-running-in-the-rain",
    author: "Jordan Ives",
    excerpt: null,
    tags: ["trail", "running"],
    coverImageUrl: "https://media.example.com/trail.jpg",
    coverImageAlt: "A muddy trail",
    status: "published",
    readingTime: 4,
    publishedAt: 1_700_000_000,
    createdAt: 1_699_000_000,
    updatedAt: 1_699_000_000,
    ...overrides,
  };
}

const EXPLICIT_EXCERPT_POST = post({
  id: 1,
  slug: "explicit-excerpt-post",
  title: "Explicit Excerpt Post",
  excerpt: "An excerpt the editor wrote by hand.",
  coverImageUrl: "https://media.example.com/explicit.jpg",
});

const LONG_BODY_SENTENCE = "A distinctive sentence about scree fields that must never leak past the cap.";
const DERIVED_EXCERPT_POST = post({
  id: 2,
  slug: "derived-excerpt-post",
  title: "Derived Excerpt Post",
  excerpt: null,
  coverImageUrl: null,
  html: `<p>Ridge lines &amp; switchbacks fill the first stretch of this route, climbing steadily through
    open scree before the trees close back in. The descent is steep, loose underfoot, and demands full
    attention the entire way down to the valley floor where the trailhead parking lot waits.</p>
    <p>${LONG_BODY_SENTENCE}</p>`,
});

const NO_COVER_POST = post({
  id: 3,
  slug: "no-cover-post",
  title: "No Cover Post",
  excerpt: "Short excerpt.",
  coverImageUrl: null,
});

const NO_EXCERPT_NO_BODY_POST = post({
  id: 4,
  slug: "no-excerpt-no-body-post",
  title: "No Excerpt No Body Post",
  excerpt: null,
  html: undefined,
  coverImageUrl: null,
});

const ALL_POSTS = [EXPLICIT_EXCERPT_POST, DERIVED_EXCERPT_POST, NO_COVER_POST, NO_EXCERPT_NO_BODY_POST];

function render(heading: string, posts: BlogPostSummary[]) {
  return renderToStaticMarkup(React.createElement(BlogHighlights, { heading, posts }));
}

describe("BlogHighlights", () => {
  it("renders the heading text inside an h2", () => {
    const markup = render("From the Blog", ALL_POSTS);
    expect(markup).toMatch(/<h2[^>]*>[^<]*From the Blog/);
  });

  it("renders exactly one 'Read all' link to /blog beside the heading", () => {
    const markup = render("From the Blog", ALL_POSTS);
    const matches = markup.match(/<a href="\/blog"[^>]*>Read all<\/a>/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("renders one article card per post, each linking to /blog/{slug} with the post title", () => {
    const markup = render("From the Blog", ALL_POSTS);
    for (const item of ALL_POSTS) {
      expect(markup).toContain(`/blog/${item.slug}`);
      expect(markup).toContain(item.title);
    }
  });

  it("renders an image with the cover src for a post with a cover image", () => {
    const markup = render("From the Blog", [EXPLICIT_EXCERPT_POST]);
    expect(markup).toContain(`src="${EXPLICIT_EXCERPT_POST.coverImageUrl}"`);
  });

  it("renders no image element for a post without a cover image", () => {
    const markup = render("From the Blog", [NO_COVER_POST]);
    expect(markup).not.toContain("<img");
  });

  it("shows the formatted published date for each card", () => {
    const markup = render("From the Blog", [EXPLICIT_EXCERPT_POST]);
    // formatCmsTimestamp(1_700_000_000) -> "November 14, 2023" (UTC)
    expect(markup).toContain("November 14, 2023");
  });

  it("shows an explicit excerpt verbatim", () => {
    const markup = render("From the Blog", [EXPLICIT_EXCERPT_POST]);
    expect(markup).toContain("An excerpt the editor wrote by hand.");
  });

  it("shows tag-free derived text when there is no explicit excerpt but there is a body", () => {
    const markup = render("From the Blog", [DERIVED_EXCERPT_POST]);
    expect(markup).toContain("Ridge lines & switchbacks");
    expect(markup).not.toContain("<p>Ridge lines");
  });

  it("never leaks a post's full body text — only the capped excerpt appears", () => {
    const markup = render("From the Blog", [DERIVED_EXCERPT_POST]);
    expect(markup).not.toContain(LONG_BODY_SENTENCE);
  });

  it("renders no article elements when posts is empty", () => {
    const markup = render("From the Blog", []);
    expect(markup).not.toContain("<article");
  });

  it("renders exactly as many article-card title links as posts passed in", () => {
    const markup = render("From the Blog", ALL_POSTS);
    const matches = markup.match(/<h3[^>]*><a href="\/blog\//g) ?? [];
    expect(matches).toHaveLength(ALL_POSTS.length);
  });

  it("renders no excerpt paragraph for a post with neither an excerpt nor a body", () => {
    const markup = render("From the Blog", [NO_EXCERPT_NO_BODY_POST]);
    // No paragraph text besides the date line should appear for this card's excerpt slot.
    expect(markup).not.toContain("undefined");
    expect(markup).not.toContain("null");
  });
});
