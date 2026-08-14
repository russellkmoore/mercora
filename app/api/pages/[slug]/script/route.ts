import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { getCustomJsEnabled } from "@/lib/cms/custom-js-guard";
import { getPageBySlug } from "@/lib/models/pages";

const SCRIPT_HEADERS = {
  "cache-control": "private, no-store",
  "content-type": "text/javascript; charset=utf-8",
  "cross-origin-resource-policy": "same-origin",
  "x-content-type-options": "nosniff",
};

function unavailable(): Response {
  return new Response("", { status: 404, headers: SCRIPT_HEADERS });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  try {
    if (!(await getCustomJsEnabled())) return unavailable();
    const { slug } = await context.params;
    const page = await getPageBySlug(slug, false, { includeProtected: true });
    if (!page?.custom_js) return unavailable();
    if (page.is_protected && !(await auth()).userId) return unavailable();
    return new Response(`"use strict";\n${page.custom_js}`, { headers: SCRIPT_HEADERS });
  } catch {
    return unavailable();
  }
}
