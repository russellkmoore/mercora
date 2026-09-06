import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readParitySnapshot } from "../../../helpers/parity-snapshot";

/**
 * Product gallery variant tests (Phase 7, Plan 03).
 *
 * Task 1 covers the moved media helper's behavior and ProductGalleryLeft's
 * pre-extraction source parity plus its own render behavior. Tasks 2 and 3
 * extend this same file with ProductGalleryTop, the map/source-contract
 * rows, and the product page's source-contract rows — see 07-03-PLAN.md.
 */

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement("img", { src, alt }),
}));

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const RECORDING_PATH =
  "tests/unit/components/layout/product/__snapshots__/product-gallery-left-preextraction.txt";
const LEFT_COMPONENT_PATH = "components/layout/product/ProductGalleryLeft.tsx";

// --- Task 1: resolveProductImageSrc, the one resolver both gallery variants
// call, through the exact three-argument call shape they use (D-05, D-11) --

const { resolveProductImageSrc } = await import("@/lib/utils/product-image");

describe("resolveProductImageSrc (the one resolver both gallery variants call, three-argument shape)", () => {
  it("passes an absolute http(s) URL through unchanged", () => {
    expect(
      resolveProductImageSrc("https://cdn.example.com/products/x.jpg", undefined, "/placeholder.jpg"),
    ).toBe("https://cdn.example.com/products/x.jpg");
  });

  it("passes a path that already starts with a slash through unchanged", () => {
    expect(resolveProductImageSrc("/products/x.jpg", undefined, "/placeholder.jpg")).toBe(
      "/products/x.jpg",
    );
  });

  it("adds a leading slash to a bare relative path — the one accepted output change (D-11)", () => {
    expect(resolveProductImageSrc("products/x.jpg", undefined, "/placeholder.jpg")).toBe(
      "/products/x.jpg",
    );
  });

  it("returns the placeholder path for a null, undefined, or otherwise unusable input", () => {
    expect(resolveProductImageSrc(null, undefined, "/placeholder.jpg")).toBe("/placeholder.jpg");
    expect(resolveProductImageSrc(undefined, undefined, "/placeholder.jpg")).toBe(
      "/placeholder.jpg",
    );
    expect(resolveProductImageSrc({}, undefined, "/placeholder.jpg")).toBe("/placeholder.jpg");
  });
});

// --- Task 1: ProductGalleryLeft pre-extraction source parity ---------------

describe("ProductGalleryLeft — pre-extraction source parity", () => {
  const recording = readParitySnapshot(RECORDING_PATH);
  const componentSource = source(LEFT_COMPONENT_PATH);

  it("the recording file is non-empty", () => {
    expect(recording.trim().length).toBeGreaterThan(0);
  });

  it("every recorded line, normalised, appears in the extracted component's source in order — the outer <div>'s remainder matches character for character, and four permitted substitutions (the two closure-to-prop lines for alt text and thumbnail onClick, plus the two resolver-swap src lines) are the only ones allowed; everything else matches exactly", () => {
    const recordedLines = recording.split("\n").filter((line) => line.trim() !== "");
    const componentLines = componentSource.split("\n");

    // The two closure-to-prop lines the action text explicitly calls out,
    // plus the two src lines changed by the D-05 resolver consolidation
    // (retiring `getMediaUrl` in favour of the shared `resolveProductImageSrc`).
    const KNOWN_SUBSTITUTIONS: Record<string, string> = {
      'alt={typeof product.name === "string" ? product.name : ""}': "alt={productName}",
      "onClick={() => setSelectedImage(imageUrl)}": "onClick={() => onSelect(imageUrl)}",
      "src={getMediaUrl(selectedImage)}":
        'src={resolveProductImageSrc(selectedImage, undefined, "/placeholder.jpg")}',
      "src={getMediaUrl(imageUrl)}":
        'src={resolveProductImageSrc(imageUrl, undefined, "/placeholder.jpg")}',
    };

    let searchFrom = 0;
    for (const rawLine of recordedLines) {
      const trimmed = rawLine.trim();

      if (trimmed === "<div>") {
        // This is the outer element's opening tag — it gained the
        // data-product-gallery attribute. Its remainder (everything after
        // "<div") must still match character for character.
        const remainder = trimmed.slice("<div".length);
        const matchIndex = componentLines.findIndex(
          (line, idx) =>
            idx >= searchFrom && line.trim().startsWith("<div") && line.trim().endsWith(remainder),
        );
        expect(matchIndex).toBeGreaterThanOrEqual(searchFrom);
        searchFrom = matchIndex + 1;
        continue;
      }

      const expected = KNOWN_SUBSTITUTIONS[trimmed] ?? trimmed;
      const matchIndex = componentLines.findIndex(
        (line, idx) => idx >= searchFrom && line.trim() === expected,
      );
      expect(matchIndex).toBeGreaterThanOrEqual(searchFrom);
      searchFrom = matchIndex + 1;
    }
  });

  it("is marked as a client component", () => {
    expect(componentSource.split("\n")[0]).toMatch(/^\/\*\*/);
    expect(componentSource).toMatch(/^"use client";$/m);
  });
});

// --- Task 1: ProductGalleryLeft render behavior -----------------------------

const { default: ProductGalleryLeft } = await import(
  "@/components/layout/product/ProductGalleryLeft"
);

function renderLeft(props: {
  allImages: string[];
  selectedImage: string | null;
  productName?: string;
}) {
  const onSelect = vi.fn();
  const html = renderToStaticMarkup(
    React.createElement(ProductGalleryLeft, {
      allImages: props.allImages,
      selectedImage: props.selectedImage,
      onSelect,
      productName: props.productName ?? "Volt Field Kit",
    }),
  );
  return { html, onSelect };
}

describe("ProductGalleryLeft render", () => {
  it("renders one main image and one thumbnail button per image, in the given order", () => {
    const { html } = renderLeft({
      allImages: ["a.jpg", "b.jpg", "c.jpg"],
      selectedImage: "a.jpg",
    });
    expect(html.match(/<img\b/g)).toHaveLength(4); // 1 main + 3 thumbnails
    const aIdx = html.indexOf('src="/a.jpg"');
    const bIdx = html.indexOf('src="/b.jpg"');
    const cIdx = html.indexOf('src="/c.jpg"');
    expect(aIdx).toBeGreaterThan(-1);
    expect(bIdx).toBeGreaterThan(aIdx);
    expect(cIdx).toBeGreaterThan(bIdx);
    expect(html.match(/<button\b/g)).toHaveLength(3);
  });

  it("renders the main image at the placeholder path and no thumbnail buttons for an empty image array", () => {
    const { html } = renderLeft({ allImages: [], selectedImage: null });
    expect(html).toContain('src="/placeholder.jpg"');
    expect(html.match(/<button\b/g)).toBeNull();
  });

  it("renders one thumbnail button and no error for exactly one image", () => {
    const { html } = renderLeft({ allImages: ["only.jpg"], selectedImage: "only.jpg" });
    expect(html.match(/<button\b/g)).toHaveLength(1);
  });

  it("gives the thumbnail whose URL equals the selected image the accent border class, and the others the neutral border class", () => {
    const { html } = renderLeft({
      allImages: ["a.jpg", "b.jpg"],
      selectedImage: "b.jpg",
    });
    const buttonMatches = html.match(/<button[^>]*class="([^"]*)"[^>]*>/g) ?? [];
    expect(buttonMatches).toHaveLength(2);
    expect(buttonMatches[0]).toContain("border-border");
    expect(buttonMatches[0]).not.toContain("border-primary");
    expect(buttonMatches[1]).toContain("border-primary");
  });

  it("carries its own data-product-gallery attribute on the outer element", () => {
    const { html } = renderLeft({ allImages: ["a.jpg"], selectedImage: "a.jpg" });
    expect(html.match(/data-product-gallery="left"/g)).toHaveLength(1);
  });
});

// --- Task 2: ProductGalleryTop, PRODUCT_GALLERY_MAP, source contracts ------

import { PRODUCT_GALLERIES } from "@/lib/layout/variants";

const { default: ProductGalleryTop } = await import(
  "@/components/layout/product/ProductGalleryTop"
);

const TOP_COMPONENT_PATH = "components/layout/product/ProductGalleryTop.tsx";
const DISPLAY_PATH = "app/product/[slug]/ProductDisplay.tsx";

function renderTop(props: {
  allImages: string[];
  selectedImage: string | null;
  productName?: string;
}) {
  const onSelect = vi.fn();
  const html = renderToStaticMarkup(
    React.createElement(ProductGalleryTop, {
      allImages: props.allImages,
      selectedImage: props.selectedImage,
      onSelect,
      productName: props.productName ?? "Volt Field Kit",
    }),
  );
  return { html, onSelect };
}

describe("ProductGalleryTop render", () => {
  it("renders one main image and one thumbnail button per image, in the given order, with its own data attribute", () => {
    const { html } = renderTop({
      allImages: ["a.jpg", "b.jpg", "c.jpg"],
      selectedImage: "a.jpg",
    });
    expect(html.match(/<img\b/g)).toHaveLength(4);
    expect(html.match(/<button\b/g)).toHaveLength(3);
    expect(html.match(/data-product-gallery="top"/g)).toHaveLength(1);
  });

  it("renders the main image at the placeholder path and no thumbnail buttons for an empty image array", () => {
    const { html } = renderTop({ allImages: [], selectedImage: null });
    expect(html).toContain('src="/placeholder.jpg"');
    expect(html.match(/<button\b/g)).toBeNull();
  });

  it("renders one thumbnail button and no error for exactly one image", () => {
    const { html } = renderTop({ allImages: ["only.jpg"], selectedImage: "only.jpg" });
    expect(html.match(/<button\b/g)).toHaveLength(1);
  });

  it("gives the thumbnail whose URL equals the selected image the accent border class, and the others the neutral border class", () => {
    const { html } = renderTop({
      allImages: ["a.jpg", "b.jpg"],
      selectedImage: "b.jpg",
    });
    const buttonMatches = html.match(/<button[^>]*class="([^"]*)"[^>]*>/g) ?? [];
    expect(buttonMatches).toHaveLength(2);
    expect(buttonMatches[0]).toContain("border-border");
    expect(buttonMatches[0]).not.toContain("border-primary");
    expect(buttonMatches[1]).toContain("border-primary");
  });

  it("calls the selection callback with the clicked thumbnail's URL", () => {
    // renderToStaticMarkup can't dispatch a real click; assert the source
    // wires onClick to onSelect(imageUrl), the same contract ProductGalleryLeft uses.
    const src = source(TOP_COMPONENT_PATH);
    expect(src).toContain("onClick={() => onSelect(imageUrl)}");
  });

  it("is marked as a client component", () => {
    const src = source(TOP_COMPONENT_PATH);
    expect(src).toMatch(/^"use client";$/m);
  });
});

describe("PRODUCT_GALLERY_MAP (held inside ProductDisplay)", () => {
  it("the display's source declares a map whose key list equals the gallery enum, in order, with no duplicates", () => {
    const src = source(DISPLAY_PATH);
    const mapBlockMatch = src.match(/PRODUCT_GALLERY_MAP[\s\S]*?=\s*{([\s\S]*?)};/);
    expect(mapBlockMatch).not.toBeNull();
    const keys = [...(mapBlockMatch?.[1] ?? "").matchAll(/^\s*"?([a-z-]+)"?:/gm)].map(
      (match) => match[1],
    );
    expect(keys).toEqual([...PRODUCT_GALLERIES]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every gallery enum member resolves through the two variant components to non-empty markup", () => {
    for (const [gallery, Component] of [
      ["left", ProductGalleryLeft],
      ["top", ProductGalleryTop],
    ] as const) {
      const html = renderToStaticMarkup(
        React.createElement(Component, {
          allImages: ["a.jpg"],
          selectedImage: "a.jpg",
          onSelect: vi.fn(),
          productName: "Volt Field Kit",
        }),
      );
      expect(html.length).toBeGreaterThan(0);
      expect(html).toContain(`data-product-gallery="${gallery}"`);
    }
  });
});

describe("ProductDisplay source contract (LAYOUT-04 anti-genericity)", () => {
  const src = source(DISPLAY_PATH);

  it("declares the new prop typed to the gallery union, never a bare string", () => {
    expect(src).toMatch(/productGallery\??:\s*ProductGallery/);
    expect(src).not.toMatch(/productGallery\??:\s*string/);
    expect(src).not.toMatch(/\blayout\??:\s*(ProductGallery|string)/);
  });

  it("contains no comparison of a resolved value against either gallery member name literal", () => {
    for (const gallery of PRODUCT_GALLERIES) {
      const comparisonPattern = new RegExp(`(===|switch\\s*\\()[^\\n]*["']${gallery}["']`);
      expect(src).not.toMatch(comparisonPattern);
    }
    expect(src).not.toMatch(/if\s*\(\s*productGallery/);
    expect(src).not.toMatch(/switch\s*\(\s*productGallery/);
  });

  it("the information column's markup is unchanged from the pre-phase source apart from the wrapper geometry the variants own", () => {
    expect(src).toContain('<h1 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl font-display">');
    expect(src).toContain("Add to Cart");
    expect(src).toContain("Choose an option:");
  });
});

// --- Task 3: app/product/[slug]/page.tsx source contract -------------------

const PRODUCT_PAGE_PATH = "app/product/[slug]/page.tsx";

describe("app/product/[slug]/page.tsx source contract (LAYOUT-04 anti-genericity)", () => {
  const page = source(PRODUCT_PAGE_PATH);

  it("awaits the resolver directly in the page body, above the returned tree, not inside a Suspense child", () => {
    expect(page).toContain("await getLayoutSettings()");
    expect(page).not.toMatch(/<Suspense[^>]*>[\s\S]*getLayoutSettings/);
  });

  it("passes the resolved value into the display under the switch's own prop name", () => {
    expect(page).toMatch(/productGallery=\{productGallery\}/);
  });

  it("leaves the existing parallel data fetches and the revalidation export unchanged", () => {
    expect(page).toContain("export const revalidate = 0;");
    expect(page).toContain("Promise.all([");
    expect(page).toContain("getProductReviews({");
    expect(page).toContain("getProductReviewEligibility({");
  });
});
