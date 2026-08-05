import { describe, expect, it } from 'vitest';
import { sanitizeRichHtmlServer } from '@/lib/utils/sanitize-html-core';
import { sanitizeRichHtml } from '@/lib/utils/sanitize-html';

const allowedImageOrigin = 'https://cdn.example.test/assets';
const sanitizers = [
  ['server', sanitizeRichHtmlServer],
  ['client', sanitizeRichHtml],
] as const;

describe.each(sanitizers)('%s rich HTML sanitizer', (_name, sanitize) => {
  const clean = (html: string) => sanitize(html, { allowedImageOrigin });

  it('removes scripts, event handlers, and scriptable links', () => {
    const output = clean(
      '<p onclick="alert(1)">Safe<script>alert(1)</script>' +
      '<a href="javascript:alert(2)" onmouseover="alert(3)">link</a></p>'
    );

    expect(output).toContain('<p>Safe');
    expect(output).not.toMatch(/script|onclick|onmouseover|javascript:/i);
  });

  it('allows only the shared safe link schemes and same-origin relatives', () => {
    const output = clean(
      '<a href="https://example.test/a">https</a>' +
      '<a href="mailto:help@example.test">mail</a>' +
      '<a href="../contact">relative</a>' +
      '<a href="ftp://example.test/a">ftp</a>' +
      '<a href="tel:+15555550100">tel</a>' +
      '<a href="//example.test/a">protocol</a>'
    );

    expect(output).toContain('href="https://example.test/a"');
    expect(output).toContain('href="mailto:help@example.test"');
    expect(output).toContain('href="../contact"');
    expect(output).not.toContain('ftp://');
    expect(output).not.toContain('tel:');
    expect(output).not.toContain('href="//example.test/a"');
  });

  it('removes data, protocol-relative, and unapproved image sources', () => {
    const output = clean(
      '<img src="data:image/png;base64,AAAA" alt="data">' +
      '<img src="//cdn.example.test/assets/a.png" alt="protocol">' +
      '<img src="https://images.example.test/a.png" alt="other">'
    );

    expect(output).not.toContain('data:image');
    expect(output).not.toContain('//cdn.example.test');
    expect(output).not.toContain('https://images.example.test');
    expect(output).toContain('alt="data"');
  });

  it('allows root-relative and exact configured CDN-path images', () => {
    const output = clean(
      '<img src="/media/local.png" alt="local">' +
      '<img src="images/nearby.png" alt="nearby">' +
      '<img src="https://cdn.example.test/assets/remote.png" alt="remote">'
    );

    expect(output).toContain('src="/media/local.png"');
    expect(output).toContain('src="images/nearby.png"');
    expect(output).toContain('src="https://cdn.example.test/assets/remote.png"');
  });

  it('rejects lookalike CDN hosts and path-prefix lookalikes', () => {
    const output = clean(
      '<img src="https://cdn.example.test.evil/assets/a.png" alt="host">' +
      '<img src="https://cdn.example.test/assets-evil/a.png" alt="path">'
    );

    expect(output).not.toContain('cdn.example.test.evil');
    expect(output).not.toContain('assets-evil');
  });

  it('forces noopener and noreferrer on target-blank links', () => {
    const output = clean('<a href="https://example.test" target="_BLANK" rel="opener">Open</a>');

    expect(output).toContain('target="_BLANK"');
    expect(output).toContain('rel="noopener noreferrer"');
    expect(output).not.toContain('rel="opener"');
  });

  it('retains corrected formatting, structure, and safe attributes', () => {
    const output = clean(
      '<div class="content"><p><strong>Bold</strong> <em>em</em> <u>u</u> ' +
      '<s>s</s> <del>del</del> <ins>ins</ins> H<sub>2</sub>O<sup>2</sup> ' +
      '<small>small</small> <mark>mark</mark> <abbr title="Example">Ex</abbr></p>' +
      '<figure><img src="/media/a.png" alt="A" width="20" height="10" loading="lazy">' +
      '<figcaption>Caption</figcaption></figure>' +
      '<table><caption>Table</caption><colgroup><col span="2"></colgroup><tbody><tr>' +
      '<th scope="col" rowspan="2">H</th><td colspan="2" headers="h">D</td>' +
      '</tr></tbody></table></div>'
    );

    for (const fragment of [
      '<strong>Bold</strong>', '<em>em</em>', '<u>u</u>', '<s>s</s>',
      '<del>del</del>', '<ins>ins</ins>', '<sub>2</sub>', '<sup>2</sup>',
      '<small>small</small>', '<mark>mark</mark>', 'title="Example"',
      '<figure>', '<figcaption>Caption</figcaption>', '<table>', '<caption>Table</caption>',
      'span="2"', 'scope="col"', 'rowspan="2"', 'colspan="2"', 'headers="h"',
      'class="content"',
    ]) {
      expect(output).toContain(fragment);
    }
  });

  it('strips style, SVG, form, iframe, event, and data attributes', () => {
    const output = clean(
      '<style>body{display:none}</style><svg><circle></circle></svg>' +
      '<form><input value="secret"></form><iframe src="https://example.test"></iframe>' +
      '<p style="color:red" data-secret="x" aria-label="bad" onfocus="alert(1)">Text</p>'
    );

    expect(output).not.toMatch(/<\/?(?:style|svg|circle|form|input|iframe)\b/i);
    expect(output).not.toMatch(/\s(?:style|data-secret|aria-label|onfocus)=/i);
    expect(output).toContain('<p>Text</p>');
  });

  it('can reduce an unsafe-only payload to empty content', () => {
    expect(clean('<script>alert(1)</script>')).toBe('');
  });
});

describe('client sanitizer call isolation', () => {
  it('does not leak an allowed image origin into a later call', () => {
    const image = '<img src="https://cdn.example.test/assets/a.png">';

    expect(sanitizeRichHtml(image, { allowedImageOrigin })).toContain('src=');
    expect(sanitizeRichHtml(image)).not.toContain('src=');
  });
});
