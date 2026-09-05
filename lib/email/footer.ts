import { getStoreConfig } from "@/lib/store-config";
import { escapeHtmlText } from "@/lib/utils/maintenance-html";

/**
 * The one field these footer helpers read. Kept as a minimal structural
 * type rather than importing the full `ThemeTokens` type (this module must
 * not import the token lookup module at all, D-01) — any caller's full
 * token set satisfies this structurally.
 */
type FooterTokens = { mutedOnInverse: string };

export function postalFooterHtml(tokens: FooterTokens): string {
  const store = getStoreConfig();
  const name = store.identity.name || "Store";
  const address = store.contact.postalAddress || "";
  return `<p style="color:${tokens.mutedOnInverse};font-size:12px;line-height:16px;margin:8px 0 0">${escapeHtmlText(name)} · ${escapeHtmlText(address)}</p>`;
}

export function unsubscribeFooterHtml(url: string, tokens: FooterTokens): string {
  return `<p style="color:${tokens.mutedOnInverse};font-size:12px;line-height:16px;margin:8px 0 0">Prefer not to receive review reminders? <a href="${escapeHtmlText(url)}" style="color:${tokens.mutedOnInverse};text-decoration:underline">Unsubscribe</a>.</p>`;
}

export function postalFooterText(): string {
  const store = getStoreConfig();
  return `${store.identity.name || "Store"} · ${store.contact.postalAddress || ""}`;
}
