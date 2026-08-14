import { describe, expect, it } from "vitest";
import { decodeFaqHash } from "@/components/pages/FaqAccordion";

describe("FAQ hash decoding", () => {
  it("decodes valid URI fragments", () => {
    expect(decodeFaqHash("#shipping%20times")).toBe("shipping times");
  });

  it("fails closed for malformed URI fragments without throwing", () => {
    expect(() => decodeFaqHash("#bad%E0%A4%A")).not.toThrow();
    expect(decodeFaqHash("#bad%E0%A4%A")).toBeNull();
  });
});
