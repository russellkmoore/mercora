import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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

// --- Task 1: gallery-media-url helper --------------------------------------

const { getMediaUrl } = await import("@/components/layout/product/gallery-media-url");

describe("getMediaUrl (moved verbatim from ProductDisplay's local helper)", () => {
  it("returns the placeholder path for a null or undefined input", () => {
    expect(getMediaUrl(null)).toBe("/placeholder.jpg");
    expect(getMediaUrl(undefined)).toBe("/placeholder.jpg");
  });

  it("returns a string input unchanged", () => {
    expect(getMediaUrl("products/x.jpg")).toBe("products/x.jpg");
  });

  it("returns the nested file URL for an object input", () => {
    expect(getMediaUrl({ file: { url: "products/y.jpg" } })).toBe("products/y.jpg");
  });

  it("returns the placeholder path for an object with no usable URL", () => {
    expect(getMediaUrl({ file: {} })).toBe("/placeholder.jpg");
    expect(getMediaUrl({})).toBe("/placeholder.jpg");
  });
});

// --- Task 1: ProductGalleryLeft pre-extraction source parity ---------------

describe("ProductGalleryLeft — pre-extraction source parity", () => {
  const recording = source(RECORDING_PATH);
  const componentSource = source(LEFT_COMPONENT_PATH);

  it("the recording file is non-empty", () => {
    expect(recording.trim().length).toBeGreaterThan(0);
  });

  it("every recorded line, normalised, appears in the extracted component's source in order — the outer <div>'s remainder matches character for character, and the two closure-to-prop lines (alt text, thumbnail onClick) are the only other permitted substitutions; everything else matches exactly", () => {
    const recordedLines = recording.split("\n").filter((line) => line.trim() !== "");
    const componentLines = componentSource.split("\n");

    // The two lines the action text explicitly calls out as replacing a
    // closure reference with its prop, rather than surviving verbatim.
    const KNOWN_SUBSTITUTIONS: Record<string, string> = {
      'alt={typeof product.name === "string" ? product.name : ""}': "alt={productName}",
      "onClick={() => setSelectedImage(imageUrl)}": "onClick={() => onSelect(imageUrl)}",
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
    const aIdx = html.indexOf('src="a.jpg"');
    const bIdx = html.indexOf('src="b.jpg"');
    const cIdx = html.indexOf('src="c.jpg"');
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
