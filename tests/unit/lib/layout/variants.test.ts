import { describe, expect, it } from "vitest";
import {
  CATEGORY_LAYOUTS,
  HOME_HEROES,
  PRODUCT_GALLERIES,
  DEFAULT_LAYOUTS,
} from "@/lib/layout/variants";

/**
 * Exhaustiveness/distinctness precedent for the three layout enumerations.
 * Plan 07-05's repo-wide exhaustiveness test builds on this per-enum
 * precedent for every switch it audits.
 */
describe("layout enumerations", () => {
  it("each enum array has no duplicate entries", () => {
    for (const enumArray of [CATEGORY_LAYOUTS, HOME_HEROES, PRODUCT_GALLERIES]) {
      expect(new Set(enumArray).size).toBe(enumArray.length);
    }
  });

  it("the two grid category members and the list member are distinct", () => {
    expect(new Set(CATEGORY_LAYOUTS).size).toBe(3);
    expect(CATEGORY_LAYOUTS).toEqual(["grid-3", "grid-2", "list"]);
  });

  it("the home hero members are distinct", () => {
    expect(HOME_HEROES).toEqual(["full-bleed", "split", "minimal"]);
  });

  it("the product gallery members are distinct", () => {
    expect(PRODUCT_GALLERIES).toEqual(["left", "top"]);
  });

  it("each default is a member of its own enum array", () => {
    expect(CATEGORY_LAYOUTS).toContain(DEFAULT_LAYOUTS.categoryLayout);
    expect(HOME_HEROES).toContain(DEFAULT_LAYOUTS.homeHero);
    expect(PRODUCT_GALLERIES).toContain(DEFAULT_LAYOUTS.productGallery);
  });

  it("reproduces today's look exactly (D-04)", () => {
    expect(DEFAULT_LAYOUTS).toEqual({
      categoryLayout: "grid-3",
      homeHero: "minimal",
      productGallery: "left",
    });
  });
});
