import { describe, expect, it } from "vitest";
import { blogErrorStatus, isPlainObject, parseBlogId, parseBlogPage, parseBlogStatus, parseOffset, parsePositiveInt } from "@/lib/blog/http";

describe("Blog HTTP validation", () => {
  it("bounds pagination and IDs", () => {
    expect(parsePositiveInt("999", 20, 100)).toBe(100);
    expect(parsePositiveInt("-1", 20, 100)).toBe(20);
    expect(parseOffset("99999")).toBe(10_000);
    expect(parseBlogPage("9999")).toBe(417);
    expect(parseBlogPage("not-a-page")).toBe(1);
    expect(parseBlogId("01")).toBe(1);
    expect(parseBlogId("1x")).toBeNull();
  });

  it("accepts only known statuses and object request bodies", () => {
    expect(parseBlogStatus("published")).toBe("published");
    expect(() => parseBlogStatus("archived")).toThrow();
    expect(isPlainObject({ title: "Post" })).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
  });

  it("classifies validation, uniqueness, and infrastructure errors", () => {
    expect(blogErrorStatus(new Error("Title is required"))).toBe(400);
    expect(blogErrorStatus(new Error("UNIQUE constraint failed: blog_posts.slug"))).toBe(409);
    expect(blogErrorStatus(new Error("D1 unavailable"))).toBe(500);
  });
});
