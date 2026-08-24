import { getCloudflareContext } from "@opennextjs/cloudflare";
import { resolvePublicMediaKey } from "@/lib/media/public-key";

interface RouteContext {
  params: Promise<{ key?: string[] }>;
}

const REVALIDATING_CACHE = "public, max-age=0, must-revalidate";
const INERT_MEDIA_CSP = "default-src 'none'; sandbox";

const CONTENT_TYPES_BY_EXTENSION: Readonly<Record<string, string>> = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function simpleResponse(message: string, status: number, head = false): Response {
  return new Response(head ? null : message, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": INERT_MEDIA_CSP,
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function verifiedContentType(object: R2Object): string | null {
  const extension = object.key.split(".").pop()?.toLowerCase();
  if (!extension) return null;
  const expected = CONTENT_TYPES_BY_EXTENSION[extension];
  const declared = object.httpMetadata?.contentType?.split(";", 1)[0].trim().toLowerCase();
  const normalizedDeclared = declared === "image/jpg" ? "image/jpeg" : declared;
  return expected && normalizedDeclared === expected ? expected : null;
}

function responseHeaders(object: R2Object, contentType: string): Headers {
  const headers = new Headers({
    "Cache-Control": REVALIDATING_CACHE,
    "Content-Security-Policy": INERT_MEDIA_CSP,
    "Content-Length": String(object.size),
    "Content-Type": contentType,
    "ETag": object.httpEtag,
    "X-Content-Type-Options": "nosniff",
  });
  if (object.uploaded instanceof Date && Number.isFinite(object.uploaded.getTime())) {
    headers.set("Last-Modified", object.uploaded.toUTCString());
  }
  return headers;
}

function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  const normalizedEtag = etag.startsWith("W/") ? etag.slice(2) : etag;
  return header.split(",").some((value) => {
    const candidate = value.trim();
    return candidate === "*" || (candidate.startsWith("W/") ? candidate.slice(2) : candidate) === normalizedEtag;
  });
}

async function serveMedia(request: Request, context: RouteContext, head: boolean): Promise<Response> {
  const { key: segments } = await context.params;
  const key = resolvePublicMediaKey(segments);
  if (!key) return simpleResponse("Not found", 404, head);

  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket: CloudflareEnv["MEDIA"] | undefined = env.MEDIA;
    if (!bucket) return simpleResponse("Service unavailable", 503, head);

    const object = head ? await bucket.head(key) : await bucket.get(key);
    if (!object) return simpleResponse("Not found", 404, head);

    const contentType = verifiedContentType(object);
    if (!contentType) return simpleResponse("Not found", 404, head);

    const headers = responseHeaders(object, contentType);
    if (etagMatches(request.headers.get("if-none-match"), object.httpEtag)) {
      headers.delete("Content-Length");
      headers.delete("Content-Type");
      return new Response(null, { status: 304, headers });
    }

    if (head) return new Response(null, { status: 200, headers });
    if (!("body" in object) || !object.body) return simpleResponse("Service unavailable", 503, head);
    return new Response(object.body as ReadableStream, { status: 200, headers });
  } catch {
    return simpleResponse("Service unavailable", 503, head);
  }
}

export function GET(request: Request, context: RouteContext): Promise<Response> {
  return serveMedia(request, context, false);
}

export function HEAD(request: Request, context: RouteContext): Promise<Response> {
  return serveMedia(request, context, true);
}
