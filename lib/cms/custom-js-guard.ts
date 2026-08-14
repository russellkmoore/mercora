import { getSettings } from "@/lib/utils/settings";

export const CUSTOM_JS_ENABLED_SETTING = "cms.custom_js_enabled";

export function isCustomJsEnabled(raw: Record<string, unknown>): boolean {
  return raw[CUSTOM_JS_ENABLED_SETTING] === true;
}

export async function getCustomJsEnabled(): Promise<boolean> {
  try {
    return isCustomJsEnabled(await getSettings("cms"));
  } catch {
    return false;
  }
}

function normalizeScript(value: string | null | undefined): string | null {
  return value == null || value.trim() === "" ? null : value;
}

export function isNonEmptyScript(value: string | null | undefined): boolean {
  return normalizeScript(value) !== null;
}

export function customJsChanged(
  incoming: { custom_js?: string | null },
  current?: { custom_js?: string | null } | null,
): boolean {
  if (!("custom_js" in incoming)) return false;
  return normalizeScript(incoming.custom_js) !== normalizeScript(current?.custom_js);
}

export function logCustomJsAudit(entry: {
  actorUserId?: string;
  pageId?: number;
  action: "create" | "update";
  allowed: boolean;
}): void {
  console.warn("[audit][cms.custom_js]", JSON.stringify({
    event: "cms.custom_js.write",
    action: entry.action,
    allowed: entry.allowed,
    actorUserId: entry.actorUserId ?? "unknown",
    pageId: entry.pageId ?? null,
    at: new Date().toISOString(),
  }));
}
