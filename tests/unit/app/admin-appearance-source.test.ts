import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Appearance admin UI contracts", () => {
  it("reads the generated manifest instead of a hardcoded theme list, with no card-count literal", () => {
    const grid = source("components/admin/ThemePresetGrid.tsx");
    expect(grid).toContain('from "@/lib/themes/manifest.generated"');
    expect(grid).toContain("THEME_MANIFEST.map(");
    // No hardcoded card count anywhere in the file (the plan explicitly forbids
    // asserting one here too — this wave may ship one theme or three).
    expect(grid).not.toMatch(/cards?\s*(===|==)\s*3/);
    expect(grid).not.toMatch(/length\s*(===|==)\s*3/);
  });

  it("imports the appearance setting key and category constants rather than restating them", () => {
    const grid = source("components/admin/ThemePresetGrid.tsx");
    expect(grid).toContain('from "@/lib/themes/active-theme"');
    expect(grid).toContain("APPEARANCE_SETTINGS_CATEGORY");
    expect(grid).toContain("APPEARANCE_THEME_SETTING_KEY");
    expect(grid).not.toContain('"appearance.theme"');
  });

  it("posts to the existing settings endpoint and introduces no new route", () => {
    const grid = source("components/admin/ThemePresetGrid.tsx");
    expect(grid).toContain('fetch("/api/admin/settings"');
    expect(grid).toContain('fetch(`/api/admin/settings?category=');
  });

  it("renders header-derived text as escaped children, never through a raw-HTML sink", () => {
    const grid = source("components/admin/ThemePresetGrid.tsx");
    expect(grid).toContain("{theme.label}");
    expect(grid).toContain("{theme.meta.industry}");
    expect(grid).toContain("{theme.meta.synopsis}");
    expect(grid).not.toContain("dangerouslySetInnerHTML");
  });

  it("uses the exact copywriting-contract literals", () => {
    const grid = source("components/admin/ThemePresetGrid.tsx");
    expect(grid).toContain("Save Changes");
    expect(grid).toContain(">Active<");
    expect(grid).toContain("Theme updated to ${label}.");
    expect(grid).toContain("Couldn't save your theme selection. Try again.");
  });

  it("exposes radio-group accessibility semantics and arrow-key navigation", () => {
    const grid = source("components/admin/ThemePresetGrid.tsx");
    expect(grid).toContain('role="radiogroup"');
    expect(grid).toContain('role="radio"');
    expect(grid).toContain("aria-checked");
    expect(grid).toContain("ArrowRight");
    expect(grid).toContain("ArrowLeft");
  });

  it("clamps the synopsis to a uniform card height", () => {
    const grid = source("components/admin/ThemePresetGrid.tsx");
    expect(grid).toContain("line-clamp-3");
  });

  it("hosts the grid on its own route and the settings hub links to it as navigation, not a tab", () => {
    const page = source("app/admin/settings/appearance/page.tsx");
    expect(page).toContain("ThemePresetGrid");

    const hub = source("app/admin/settings/page.tsx");
    expect(hub).toContain("/admin/settings/appearance");
    expect(hub).toContain('kind: "route"');
  });
});
