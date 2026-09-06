import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_THEME_NAME } from "@/lib/themes/manifest.generated";
import { getThemeTokens } from "@/lib/themes/tokens";
import { APPEARANCE_THEME_SETTING_KEY } from "@/lib/themes/active-theme";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
}));

vi.mock("@/lib/utils/settings", () => ({
  getSettings: mocks.getSettings,
}));

import { GET } from "@/app/api/theme/route";
import { parseThemeResponse } from "@/lib/themes/theme-response";

/**
 * End-to-end coverage of `GET /api/theme` (D-02, T-08.1-01) and
 * `parseThemeResponse` (T-08.1-02) — the tracer's full chain from a stored
 * `appearance` row through to the token values a crash-page client would
 * apply.
 */
describe("GET /api/theme", () => {
  beforeEach(() => {
    mocks.getSettings.mockReset();
  });

  it("returns exactly {name, tokens} for a stored manifest theme, no-store, and the parser round-trips to the same tokens", async () => {
    mocks.getSettings.mockResolvedValue({ [APPEARANCE_THEME_SETTING_KEY]: "luxe" });

    const response = await GET();
    const body = (await response.json()) as { name: string; tokens: unknown };

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(Object.keys(body).sort()).toEqual(["name", "tokens"]);
    expect(body.name).toBe("luxe");
    expect(body.tokens).toEqual(getThemeTokens("luxe"));
    expect(parseThemeResponse(body)).toEqual(getThemeTokens("luxe"));
  });

  it("returns the manifest default when no theme is stored", async () => {
    mocks.getSettings.mockResolvedValue({});

    const response = await GET();
    const body = (await response.json()) as { name: string; tokens: unknown };

    expect(response.status).toBe(200);
    expect(body.name).toBe(DEFAULT_THEME_NAME);
    expect(body.tokens).toEqual(getThemeTokens(DEFAULT_THEME_NAME));
  });

  it("returns the manifest default when the stored value is not a manifest theme", async () => {
    mocks.getSettings.mockResolvedValue({
      [APPEARANCE_THEME_SETTING_KEY]: "not-a-real-theme",
    });

    const response = await GET();
    const body = (await response.json()) as { name: string; tokens: unknown };

    expect(body.name).toBe(DEFAULT_THEME_NAME);
    expect(body.tokens).toEqual(getThemeTokens(DEFAULT_THEME_NAME));
  });

  it("produces a JSON-identical body for a stored default vs. an absent stored value (adjacency)", async () => {
    mocks.getSettings.mockResolvedValue({
      [APPEARANCE_THEME_SETTING_KEY]: DEFAULT_THEME_NAME,
    });
    const storedDefaultBody = await (await GET()).json();

    mocks.getSettings.mockResolvedValue({});
    const absentBody = await (await GET()).json();

    expect(JSON.stringify(storedDefaultBody)).toBe(JSON.stringify(absentBody));
  });
});

describe("parseThemeResponse", () => {
  it("returns null for a non-object payload", () => {
    expect(parseThemeResponse(null)).toBeNull();
    expect(parseThemeResponse(undefined)).toBeNull();
    expect(parseThemeResponse("luxe")).toBeNull();
    expect(parseThemeResponse(42)).toBeNull();
  });

  it("returns null when name is missing", () => {
    expect(parseThemeResponse({ tokens: {} })).toBeNull();
  });

  it("returns null when name is not a string", () => {
    expect(parseThemeResponse({ name: 42, tokens: {} })).toBeNull();
  });

  it("returns null when name is absent from the manifest", () => {
    expect(parseThemeResponse({ name: "not-a-real-theme", tokens: {} })).toBeNull();
  });
});
