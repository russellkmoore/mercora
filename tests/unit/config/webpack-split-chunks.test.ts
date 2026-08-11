import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

describe("Next client chunking", () => {
  it("does not override webpack chunk groups or scope hoisting", () => {
    expect(nextConfig.webpack).toBeUndefined();
  });
});
