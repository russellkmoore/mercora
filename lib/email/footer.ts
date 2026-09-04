import { getStoreConfig } from "@/lib/store-config";
import { escapeHtmlText } from "@/lib/utils/maintenance-html";
import { getThemeTokens } from "@/lib/themes/tokens";

export function postalFooterHtml(): string {
  const store = getStoreConfig();
  const tokens = getThemeTokens();
  const name = store.identity.name || "Store";
  const address = store.contact.postalAddress || "";
  return `<p style="color:${tokens.mutedOnInverse};font-size:12px;line-height:16px;margin:8px 0 0">${escapeHtmlText(name)} · ${escapeHtmlText(address)}</p>`;
}

export function unsubscribeFooterHtml(url: string): string {
  const tokens = getThemeTokens();
  return `<p style="color:${tokens.mutedOnInverse};font-size:12px;line-height:16px;margin:8px 0 0">Prefer not to receive review reminders? <a href="${escapeHtmlText(url)}" style="color:${tokens.mutedOnInverse};text-decoration:underline">Unsubscribe</a>.</p>`;
}

export function postalFooterText(): string {
  const store = getStoreConfig();
  return `${store.identity.name || "Store"} · ${store.contact.postalAddress || ""}`;
}
