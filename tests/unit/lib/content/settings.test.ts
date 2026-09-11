import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  recordTelemetry: vi.fn(),
}));
vi.mock("@/lib/utils/settings", () => ({ getSettings: mocks.getSettings }));
vi.mock("@/lib/observability/telemetry", () => ({ recordTelemetry: mocks.recordTelemetry }));

import { defaultSettings } from "@/lib/db/schema/settings";
import {
  BLOG_HOME_BLOCK_COUNT_MAX,
  BLOG_HOME_BLOCK_COUNT_MIN,
  BLOG_HOME_BLOCK_HEADING_MAX_LENGTH,
  BLOG_NAV_LABEL_MAX_LENGTH,
  CONTENT_SETTING_DEFAULTS,
  CONTENT_SETTING_KEYS,
  getContentSettings,
} from "@/lib/content/settings";

/** Builds a raw stored record the way `getSettings()` really returns one —
 * parsed JSON, keyed by the dotted `content.*` key. */
function recordFromDefaults(): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const setting of defaultSettings.filter((s) => s.category === "content")) {
    result[setting.key] = JSON.parse(setting.value as string);
  }
  return result;
}

describe("getContentSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("declares exactly five content.* defaults, matching CONTENT_SETTING_KEYS", () => {
    const contentDefaults = defaultSettings.filter((s) => s.category === "content");
    expect(contentDefaults).toHaveLength(5);
    expect(new Set(contentDefaults.map((s) => s.key))).toEqual(
      new Set(Object.values(CONTENT_SETTING_KEYS)),
    );
  });

  it("returns all five documented defaults against an empty record (fresh database)", async () => {
    mocks.getSettings.mockResolvedValue({});

    const result = await getContentSettings();

    expect(result).toEqual({
      blogNavLabel: CONTENT_SETTING_DEFAULTS.blogNavLabel,
      blogHomeBlockEnabled: CONTENT_SETTING_DEFAULTS.blogHomeBlockEnabled,
      blogHomeBlockHeading: CONTENT_SETTING_DEFAULTS.blogHomeBlockHeading,
      blogHomeBlockCount: CONTENT_SETTING_DEFAULTS.blogHomeBlockCount,
      blogHomeBlockPlacement: CONTENT_SETTING_DEFAULTS.blogHomeBlockPlacement,
    });
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("resolves the real schema-default rows to the same five defaults, proving parity", async () => {
    mocks.getSettings.mockResolvedValue(recordFromDefaults());

    const result = await getContentSettings();

    expect(result).toEqual({
      blogNavLabel: CONTENT_SETTING_DEFAULTS.blogNavLabel,
      blogHomeBlockEnabled: CONTENT_SETTING_DEFAULTS.blogHomeBlockEnabled,
      blogHomeBlockHeading: CONTENT_SETTING_DEFAULTS.blogHomeBlockHeading,
      blogHomeBlockCount: CONTENT_SETTING_DEFAULTS.blogHomeBlockCount,
      blogHomeBlockPlacement: CONTENT_SETTING_DEFAULTS.blogHomeBlockPlacement,
    });
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("returns stored values when present and valid", async () => {
    mocks.getSettings.mockResolvedValue({
      [CONTENT_SETTING_KEYS.blogNavLabel]: "Articles",
      [CONTENT_SETTING_KEYS.blogHomeBlockEnabled]: false,
      [CONTENT_SETTING_KEYS.blogHomeBlockHeading]: "Latest Reads",
      [CONTENT_SETTING_KEYS.blogHomeBlockCount]: 5,
      [CONTENT_SETTING_KEYS.blogHomeBlockPlacement]: "before_featured",
    });

    const result = await getContentSettings();

    expect(result).toEqual({
      blogNavLabel: "Articles",
      blogHomeBlockEnabled: false,
      blogHomeBlockHeading: "Latest Reads",
      blogHomeBlockCount: 5,
      blogHomeBlockPlacement: "before_featured",
    });
    expect(mocks.recordTelemetry).not.toHaveBeenCalled();
  });

  it("clamps the count on both ends and truncates a fractional value", async () => {
    mocks.getSettings.mockResolvedValueOnce({
      [CONTENT_SETTING_KEYS.blogHomeBlockCount]: 999,
    });
    expect((await getContentSettings()).blogHomeBlockCount).toBe(BLOG_HOME_BLOCK_COUNT_MAX);

    mocks.getSettings.mockResolvedValueOnce({
      [CONTENT_SETTING_KEYS.blogHomeBlockCount]: -3,
    });
    expect((await getContentSettings()).blogHomeBlockCount).toBe(BLOG_HOME_BLOCK_COUNT_MIN);

    mocks.getSettings.mockResolvedValueOnce({
      [CONTENT_SETTING_KEYS.blogHomeBlockCount]: 4.9,
    });
    expect((await getContentSettings()).blogHomeBlockCount).toBe(4);
  });

  it("falls back on an unknown placement and records exactly one signal with no stored value in the payload", async () => {
    mocks.getSettings.mockResolvedValue({
      [CONTENT_SETTING_KEYS.blogHomeBlockPlacement]: "middle_of_page",
    });

    const result = await getContentSettings();

    expect(result.blogHomeBlockPlacement).toBe(CONTENT_SETTING_DEFAULTS.blogHomeBlockPlacement);
    expect(mocks.recordTelemetry).toHaveBeenCalledTimes(1);
    expect(mocks.recordTelemetry).toHaveBeenCalledWith(
      "content.unknown_selection",
      { outcome: "invalid" },
    );
    const payload = mocks.recordTelemetry.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("stored");
  });

  it("falls back a non-string label, a non-boolean flag, a whitespace-only heading, and an over-long label", async () => {
    mocks.getSettings.mockResolvedValueOnce({ [CONTENT_SETTING_KEYS.blogNavLabel]: 42 });
    expect((await getContentSettings()).blogNavLabel).toBe(CONTENT_SETTING_DEFAULTS.blogNavLabel);

    mocks.getSettings.mockResolvedValueOnce({
      [CONTENT_SETTING_KEYS.blogHomeBlockEnabled]: "yes",
    });
    expect((await getContentSettings()).blogHomeBlockEnabled).toBe(
      CONTENT_SETTING_DEFAULTS.blogHomeBlockEnabled,
    );

    mocks.getSettings.mockResolvedValueOnce({
      [CONTENT_SETTING_KEYS.blogHomeBlockHeading]: "   ",
    });
    expect((await getContentSettings()).blogHomeBlockHeading).toBe(
      CONTENT_SETTING_DEFAULTS.blogHomeBlockHeading,
    );

    mocks.getSettings.mockResolvedValueOnce({
      [CONTENT_SETTING_KEYS.blogNavLabel]: "x".repeat(BLOG_NAV_LABEL_MAX_LENGTH + 1),
    });
    expect((await getContentSettings()).blogNavLabel).toBe(CONTENT_SETTING_DEFAULTS.blogNavLabel);

    mocks.getSettings.mockResolvedValueOnce({
      [CONTENT_SETTING_KEYS.blogHomeBlockHeading]: "x".repeat(BLOG_HOME_BLOCK_HEADING_MAX_LENGTH + 1),
    });
    expect((await getContentSettings()).blogHomeBlockHeading).toBe(
      CONTENT_SETTING_DEFAULTS.blogHomeBlockHeading,
    );
  });

  it("resolves to the five defaults with no throw when getSettings rejects", async () => {
    mocks.getSettings.mockRejectedValue(new Error("D1_ERROR: connection lost"));

    await expect(getContentSettings()).resolves.toEqual({
      blogNavLabel: CONTENT_SETTING_DEFAULTS.blogNavLabel,
      blogHomeBlockEnabled: CONTENT_SETTING_DEFAULTS.blogHomeBlockEnabled,
      blogHomeBlockHeading: CONTENT_SETTING_DEFAULTS.blogHomeBlockHeading,
      blogHomeBlockCount: CONTENT_SETTING_DEFAULTS.blogHomeBlockCount,
      blogHomeBlockPlacement: CONTENT_SETTING_DEFAULTS.blogHomeBlockPlacement,
    });
  });

  it("calls getSettings exactly once per call, scoped to the content category", async () => {
    mocks.getSettings.mockResolvedValue({});

    await getContentSettings();

    expect(mocks.getSettings).toHaveBeenCalledTimes(1);
    expect(mocks.getSettings).toHaveBeenCalledWith("content");
  });
});
