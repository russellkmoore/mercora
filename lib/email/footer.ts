import { getStoreConfig } from "@/lib/store-config";
import { escapeHtmlText } from "@/lib/utils/maintenance-html";

export function postalFooterHtml(): string {
  const store = getStoreConfig();
  const name = store.identity.name || "Store";
  const address = store.contact.postalAddress || "";
  return `<p style="color:#94a3b8;font-size:12px;line-height:16px;margin:8px 0 0">${escapeHtmlText(name)} · ${escapeHtmlText(address)}</p>`;
}

export function unsubscribeFooterHtml(url: string): string {
  return `<p style="color:#94a3b8;font-size:12px;line-height:16px;margin:8px 0 0">Prefer not to receive review reminders? <a href="${escapeHtmlText(url)}" style="color:#94a3b8;text-decoration:underline">Unsubscribe</a>.</p>`;
}

export function postalFooterText(): string {
  const store = getStoreConfig();
  return `${store.identity.name || "Store"} · ${store.contact.postalAddress || ""}`;
}
