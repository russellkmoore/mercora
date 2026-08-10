import { describe, expect, it } from "vitest";
import { normalizeRecommendationSettings } from "@/lib/utils/settings";

describe("normalizeRecommendationSettings", () => {
  it("uses portable defaults for absent or malformed values", () => {
    expect(normalizeRecommendationSettings({})).toEqual({
      strategy: "deterministic",
      personalize: true,
      limit: 3,
      excludeOwned: true,
    });
    expect(
      normalizeRecommendationSettings({
        "recommendations.strategy": "unknown",
        "recommendations.limit": Number.NaN,
      }),
    ).toMatchObject({ strategy: "deterministic", limit: 3 });
  });

  it("accepts AI batch and clamps the display limit", () => {
    expect(
      normalizeRecommendationSettings({
        "recommendations.strategy": "ai_batch",
        "recommendations.personalize": false,
        "recommendations.limit": 99,
        "recommendations.exclude_owned": false,
      }),
    ).toEqual({
      strategy: "ai_batch",
      personalize: false,
      limit: 6,
      excludeOwned: false,
    });
  });
});
