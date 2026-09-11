import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WR-03: behavioral parity test for the admin Content tab's WR-01 normalize
 * helpers (`lib/content/normalize-client.ts`). The pre-existing
 * `admin-settings-content-tab-source.test.ts` only proves the *source shape*
 * (imports present, literals not retyped) — this file proves the *behavior*:
 * for the same raw stored `content.*` value, `normalizeContent*` (the admin
 * load path) resolves to exactly what `getContentSettings()` (the storefront
 * read path) resolves to, for every boundary case
 * `tests/unit/lib/content/settings.test.ts` itself exercises: in-range,
 * out-of-range low/high, wrong type, missing key, and an unrecognized enum
 * member. A future edit that silently diverges the two now fails here, not
 * just a source regex.
 */

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  recordTelemetry: vi.fn(),
}));
vi.mock("@/lib/utils/settings", () => ({ getSettings: mocks.getSettings }));
vi.mock("@/lib/observability/telemetry", () => ({ recordTelemetry: mocks.recordTelemetry }));

import {
  BLOG_HOME_BLOCK_COUNT_MAX,
  BLOG_HOME_BLOCK_COUNT_MIN,
  BLOG_HOME_BLOCK_HEADING_MAX_LENGTH,
  BLOG_NAV_LABEL_MAX_LENGTH,
  CONTENT_SETTING_DEFAULTS,
  CONTENT_SETTING_KEYS,
  getContentSettings,
} from "@/lib/content/settings";
import {
  normalizeContentText,
  normalizeContentFlag,
  normalizeContentCount,
  normalizeContentPlacement,
} from "@/lib/content/normalize-client";

/** A distinguishable "this key is absent from the stored record" marker —
 * `getSettings()` never returns a row for a key it doesn't have, so the
 * admin's `forEach` branch for that key never runs either; both paths are
 * exercised here via an empty stored record. */
const MISSING = Symbol("missing");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizeContentCount matches getContentSettings()'s count resolution", () => {
  it.each([
    ["in-range", 5, 5],
    ["boundary-exact min", BLOG_HOME_BLOCK_COUNT_MIN, BLOG_HOME_BLOCK_COUNT_MIN],
    ["boundary-exact max", BLOG_HOME_BLOCK_COUNT_MAX, BLOG_HOME_BLOCK_COUNT_MAX],
    ["out-of-range high", 999, BLOG_HOME_BLOCK_COUNT_MAX],
    ["out-of-range low", -3, BLOG_HOME_BLOCK_COUNT_MIN],
    ["fractional (truncates)", 4.9, 4],
    ["wrong type", "five", CONTENT_SETTING_DEFAULTS.blogHomeBlockCount],
    ["missing", MISSING, CONTENT_SETTING_DEFAULTS.blogHomeBlockCount],
  ])("%s", async (_label, stored, expected) => {
    mocks.getSettings.mockResolvedValue(
      stored === MISSING ? {} : { [CONTENT_SETTING_KEYS.blogHomeBlockCount]: stored },
    );

    const admin = normalizeContentCount(
      stored === MISSING ? undefined : stored,
      CONTENT_SETTING_DEFAULTS.blogHomeBlockCount,
    );
    const storefront = (await getContentSettings()).blogHomeBlockCount;

    expect(admin).toBe(expected);
    expect(storefront).toBe(expected);
    expect(admin).toBe(storefront);
  });
});

describe("normalizeContentPlacement matches getContentSettings()'s placement resolution", () => {
  it.each([
    ["valid member", "before_featured", "before_featured"],
    ["unrecognized enum value", "middle_of_page", CONTENT_SETTING_DEFAULTS.blogHomeBlockPlacement],
    ["wrong type", 42, CONTENT_SETTING_DEFAULTS.blogHomeBlockPlacement],
    ["missing", MISSING, CONTENT_SETTING_DEFAULTS.blogHomeBlockPlacement],
  ])("%s", async (_label, stored, expected) => {
    mocks.getSettings.mockResolvedValue(
      stored === MISSING ? {} : { [CONTENT_SETTING_KEYS.blogHomeBlockPlacement]: stored },
    );

    const admin = normalizeContentPlacement(
      stored === MISSING ? undefined : stored,
      CONTENT_SETTING_DEFAULTS.blogHomeBlockPlacement,
    );
    const storefront = (await getContentSettings()).blogHomeBlockPlacement;

    expect(admin).toBe(expected);
    expect(storefront).toBe(expected);
    expect(admin).toBe(storefront);
  });
});

describe("normalizeContentText matches getContentSettings()'s text resolution (blogNavLabel)", () => {
  it.each([
    ["valid value", "Articles", "Articles"],
    ["wrong type", 42, CONTENT_SETTING_DEFAULTS.blogNavLabel],
    ["whitespace-only", "   ", CONTENT_SETTING_DEFAULTS.blogNavLabel],
    ["over-length", "x".repeat(BLOG_NAV_LABEL_MAX_LENGTH + 1), CONTENT_SETTING_DEFAULTS.blogNavLabel],
    ["missing", MISSING, CONTENT_SETTING_DEFAULTS.blogNavLabel],
  ])("%s", async (_label, stored, expected) => {
    mocks.getSettings.mockResolvedValue(
      stored === MISSING ? {} : { [CONTENT_SETTING_KEYS.blogNavLabel]: stored },
    );

    const admin = normalizeContentText(
      stored === MISSING ? undefined : stored,
      CONTENT_SETTING_DEFAULTS.blogNavLabel,
      BLOG_NAV_LABEL_MAX_LENGTH,
    );
    const storefront = (await getContentSettings()).blogNavLabel;

    expect(admin).toBe(expected);
    expect(storefront).toBe(expected);
    expect(admin).toBe(storefront);
  });
});

describe("normalizeContentText matches getContentSettings()'s text resolution (blogHomeBlockHeading)", () => {
  it("falls back an over-length heading identically on both paths", async () => {
    const stored = "x".repeat(BLOG_HOME_BLOCK_HEADING_MAX_LENGTH + 1);
    mocks.getSettings.mockResolvedValue({ [CONTENT_SETTING_KEYS.blogHomeBlockHeading]: stored });

    const admin = normalizeContentText(
      stored,
      CONTENT_SETTING_DEFAULTS.blogHomeBlockHeading,
      BLOG_HOME_BLOCK_HEADING_MAX_LENGTH,
    );
    const storefront = (await getContentSettings()).blogHomeBlockHeading;

    expect(admin).toBe(CONTENT_SETTING_DEFAULTS.blogHomeBlockHeading);
    expect(admin).toBe(storefront);
  });
});

describe("normalizeContentFlag matches getContentSettings()'s flag resolution (blogHomeBlockEnabled)", () => {
  it.each([
    ["valid boolean (false)", false, false],
    ["valid boolean (true)", true, true],
    ["wrong type", "yes", CONTENT_SETTING_DEFAULTS.blogHomeBlockEnabled],
    ["missing", MISSING, CONTENT_SETTING_DEFAULTS.blogHomeBlockEnabled],
  ])("%s", async (_label, stored, expected) => {
    mocks.getSettings.mockResolvedValue(
      stored === MISSING ? {} : { [CONTENT_SETTING_KEYS.blogHomeBlockEnabled]: stored },
    );

    const admin = normalizeContentFlag(
      stored === MISSING ? undefined : stored,
      CONTENT_SETTING_DEFAULTS.blogHomeBlockEnabled,
    );
    const storefront = (await getContentSettings()).blogHomeBlockEnabled;

    expect(admin).toBe(expected);
    expect(storefront).toBe(expected);
    expect(admin).toBe(storefront);
  });
});
