/**
 * Typed lookup map from the resolved category-layout enum to its named
 * component (LAYOUT-04's anti-genericity control). Adding a member to
 * `CategoryLayout` without a matching entry here fails to typecheck.
 *
 * Lives in its own module (rather than inline in `app/category/[slug]/
 * page.tsx`) so tests can assert the map's key/enum equality and its
 * every-member-renders invariant directly, without importing the server
 * page's own data-fetching dependencies.
 */

import type { ComponentType } from "react";
import type { Product } from "@/lib/types/";
import type { CategoryLayout } from "@/lib/layout/variants";
import CategoryGrid3 from "./CategoryGrid3";
import CategoryGrid2 from "./CategoryGrid2";
import CategoryList from "./CategoryList";

export const CATEGORY_LAYOUT_MAP: Record<CategoryLayout, ComponentType<{ products: Product[] }>> = {
  "grid-3": CategoryGrid3,
  "grid-2": CategoryGrid2,
  "list": CategoryList,
};
