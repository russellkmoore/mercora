'use client';

import DOMPurify from 'isomorphic-dompurify';
import {
  SAFE_HTML_ATTRIBUTES,
  SAFE_HTML_TAGS,
  type HtmlSanitizerOptions,
  isAllowedLinkSource,
  isAllowedImageSource,
} from './sanitize-html-policy';

let activeAllowedImageOrigin: string | undefined;

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    const href = node.getAttribute('href');
    if (href && !isAllowedLinkSource(href)) {
      node.removeAttribute('href');
    }
    if (node.getAttribute('target')?.toLowerCase() === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }
  if (node.tagName === 'IMG') {
    const src = node.getAttribute('src') ?? '';
    if (!isAllowedImageSource(src, activeAllowedImageOrigin)) {
      node.removeAttribute('src');
    }
  }
});

/** Client render-time defense in depth. Server write sanitation is authoritative. */
export function sanitizeRichHtml(
  html: string,
  options: HtmlSanitizerOptions = {}
): string {
  const previousOrigin = activeAllowedImageOrigin;
  activeAllowedImageOrigin = options.allowedImageOrigin;
  try {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [...SAFE_HTML_TAGS],
      ALLOWED_ATTR: [...SAFE_HTML_ATTRIBUTES],
      ALLOW_DATA_ATTR: false,
      ALLOW_ARIA_ATTR: false,
    });
  } finally {
    activeAllowedImageOrigin = previousOrigin;
  }
}

export const sanitizePageHtml = sanitizeRichHtml;
