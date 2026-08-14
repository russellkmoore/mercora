import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('HTML sanitizer source and sink wiring', () => {
  it('sanitizes CMS content before the public dangerouslySetInnerHTML sink', () => {
    const renderer = source('app/[slug]/PageRenderer.tsx');

    expect(renderer).toContain('sanitizePageHtmlServer(page.content, { allowedImageOrigin })');
    expect(renderer).toContain('parsePageHtml(sanitized');
    expect(renderer).not.toContain('dangerouslySetInnerHTML={{ __html: page.content }}');
  });

  it('passes the runtime-configured image CDN from the server page', () => {
    const page = source('app/[slug]/page.tsx');

    expect(page).toContain('const store = getStoreConfig()');
    expect(page).toContain('allowedImageOrigin={store.urls.imageCdn}');
  });

  it('sanitizes marked AI output without granting an external image origin', () => {
    const admin = source('app/admin/page.tsx');

    expect(admin).toMatch(/sanitizeRichHtml\(marked\(aiAnalytics\.insights\) as string\)/);
    expect(admin).not.toMatch(/__html:\s*aiAnalytics\.insights\s*\?\s*marked\(/);
  });

  it('uses the server-only sanitizer on both authoritative page write paths', () => {
    const pages = source('lib/models/pages.ts');

    expect(pages).toContain('from "@/lib/utils/sanitize-html-server"');
    expect(pages.match(/sanitizePageHtmlServer\(/g)).toHaveLength(2);
    expect(pages.match(/Content is required after sanitization/g)).toHaveLength(2);
  });

  it('escapes both maintenance message and configured store name before interpolation', () => {
    const middleware = source('middleware.ts');

    expect(middleware).toContain('safeMaintenanceMessage(');
    expect(middleware).toContain('escapeHtmlText(getStoreConfig().identity.name)');
    expect(middleware).toContain('${maintenanceMessage}');
    expect(middleware).toContain('${storeName}');
    expect(middleware).not.toContain('<div class="logo">Voltique</div>');
  });
});
