import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOM_JS_ENABLED_SETTING,
  customJsChanged,
  isCustomJsEnabled,
  isNonEmptyScript,
  logCustomJsAudit,
} from "@/lib/cms/custom-js-guard";

describe("CMS custom JavaScript guard", () => {
  afterEach(() => vi.restoreAllMocks());

  it("enables execution only for an explicit boolean true", () => {
    expect(isCustomJsEnabled({})).toBe(false);
    expect(isCustomJsEnabled({ [CUSTOM_JS_ENABLED_SETTING]: "true" })).toBe(false);
    expect(isCustomJsEnabled({ [CUSTOM_JS_ENABLED_SETTING]: true })).toBe(true);
  });

  it("distinguishes a script write from a clear or omitted field", () => {
    expect(customJsChanged({}, { custom_js: "run()" })).toBe(false);
    expect(customJsChanged({ custom_js: "run()" }, { custom_js: null })).toBe(true);
    expect(customJsChanged({ custom_js: "" }, { custom_js: "run()" })).toBe(true);
    expect(customJsChanged({ custom_js: " " }, { custom_js: null })).toBe(false);
    expect(isNonEmptyScript("run()" )).toBe(true);
    expect(isNonEmptyScript("  ")).toBe(false);
  });

  it("audits decisions without logging the script", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logCustomJsAudit({ actorUserId: "user_1", pageId: 4, action: "update", allowed: false });
    expect(warn).toHaveBeenCalledTimes(1);
    const serialized = warn.mock.calls[0].join(" ");
    expect(serialized).toContain("cms.custom_js.write");
    expect(serialized).not.toContain("run()");
  });
});
