import sanitizeHtml from 'sanitize-html';
import {
  SAFE_HTML_TAGS,
  type HtmlSanitizerOptions,
  isAllowedLinkSource,
  isAllowedImageSource,
} from './sanitize-html-policy';

function richHtmlOptions(options: HtmlSanitizerOptions): sanitizeHtml.IOptions {
  return {
    allowedTags: [...SAFE_HTML_TAGS],
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'width', 'height', 'loading', 'title'],
      abbr: ['title'],
      ol: ['start', 'reversed', 'type'],
      li: ['value'],
      col: ['span'],
      colgroup: ['span'],
      th: ['colspan', 'rowspan', 'headers', 'scope'],
      td: ['colspan', 'rowspan', 'headers'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    parseStyleAttributes: false,
    transformTags: {
      a: (tagName, attributes) => {
        const attribs = { ...attributes };
        if (attribs.href && !isAllowedLinkSource(attribs.href)) {
          delete attribs.href;
        }
        if (attribs.target?.toLowerCase() === '_blank') {
          attribs.rel = 'noopener noreferrer';
        }
        return { tagName, attribs };
      },
      img: (tagName, attributes) => {
        if (isAllowedImageSource(attributes.src ?? '', options.allowedImageOrigin)) {
          return { tagName, attribs: attributes };
        }
        const { src: _src, ...safeAttributes } = attributes;
        return { tagName, attribs: safeAttributes };
      },
    },
  };
}

/** Workers-compatible authoritative HTML sanitizer used before persistence. */
export function sanitizeRichHtmlServer(
  html: string,
  options: HtmlSanitizerOptions = {}
): string {
  return sanitizeHtml(html, richHtmlOptions(options));
}

export const sanitizePageHtmlServer = sanitizeRichHtmlServer;
