import { NextRequest } from "next/server";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { suppressEmail } from "@/lib/models/email-preferences";
import { getStoreConfig } from "@/lib/store-config";
import { escapeHtmlText } from "@/lib/utils/maintenance-html";

function page(title: string, content: string, status = 200): Response {
  const store = getStoreConfig();
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>${escapeHtmlText(title)} - ${escapeHtmlText(store.identity.name)}</title></head><body><div role="main" style="font-family:system-ui;max-width:36rem;margin:4rem auto;padding:1rem"><h1>${escapeHtmlText(title)}</h1>${content}</div></body></html>`, {
    status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function invalid() { return page("Invalid unsubscribe link", "<p>This link is invalid or expired. Contact support for help.</p>", 400); }

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const payload = token ? await verifyUnsubscribeToken(token) : null;
  if (!payload) return invalid();
  return page("Confirm unsubscribe", `<p>Stop review reminders for <strong>${escapeHtmlText(payload.email)}</strong>?</p><form method="post" action="/api/email/unsubscribe?token=${encodeURIComponent(token!)}"><button type="submit">Confirm unsubscribe</button></form>`);
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit("PUBLIC_RATE_LIMITER", `unsubscribe:${getClientIp(request)}`);
  if (limited) {
    limited.headers.set("cache-control", "no-store");
    return limited;
  }
  const token = request.nextUrl.searchParams.get("token");
  const payload = token ? await verifyUnsubscribeToken(token) : null;
  if (!payload) return invalid();
  await suppressEmail(payload.email, payload.category);
  return page("Preferences updated", "<p>Review reminders have been turned off. Transactional messages about orders and account activity are unchanged.</p>");
}
