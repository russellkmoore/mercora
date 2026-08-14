import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Blog admin UI contracts", () => {
  it("sanitizes preview HTML and relies on server sanitization for persistence", () => {
    const editor = source("components/admin/blog/BlogEditor.tsx");
    expect(editor).toContain("sanitizeRichHtml(form.html)");
    expect(editor).toContain("HTML is sanitized again on the server");
    expect(editor).not.toContain("dangerouslySetInnerHTML={{ __html: form.html }}");
  });

  it("uses the shared hardened upload route and the server-owned Blog prefix", () => {
    const editor = source("components/admin/blog/BlogEditor.tsx");
    expect(editor).toContain('data.set("folder", "blog")');
    expect(editor).toContain('fetch("/api/admin/upload-image"');
    expect(editor).not.toContain("img.beauteas.com");
  });

  it("does not introduce the downstream mixed-major editor stack", () => {
    const editor = source("components/admin/blog/BlogEditor.tsx");
    const packageJson = source("package.json");
    expect(editor).not.toMatch(/Novel|Tiptap|tiptap/i);
    expect(packageJson).not.toMatch(/"novel"|"@tiptap\//i);
  });

  it("exposes labeled edit/delete controls and the admin navigation entry", () => {
    const management = source("components/admin/blog/BlogManagement.tsx");
    expect(management).toContain("aria-label={`Edit ${post.title}`}");
    expect(management).toContain("aria-label={`Delete ${post.title}`}");
    expect(source("components/admin/AdminSidebar.tsx")).toContain('href: "/admin/blog"');
  });
});
