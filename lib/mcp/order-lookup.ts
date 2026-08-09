const MAX_LOOKUP_BODY_BYTES = 1_024;
const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export type OrderLookupParseResult =
  | { ok: true; orderId: string }
  | { ok: false; status: 400 | 413; code: string; message: string };

function bodyTooLarge(): OrderLookupParseResult {
  return {
    ok: false,
    status: 413,
    code: "BODY_TOO_LARGE",
    message: "Request body is too large",
  };
}

export function parseMcpOrderId(value: unknown): OrderLookupParseResult {
  if (value === null || value === undefined || value === "") {
    return {
      ok: false,
      status: 400,
      code: "MISSING_ORDER_ID",
      message: "orderId is required",
    };
  }
  if (typeof value !== "string" || !ORDER_ID_PATTERN.test(value)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_ORDER_ID",
      message: "A valid orderId is required",
    };
  }
  return { ok: true, orderId: value };
}

/** Read the deliberately tiny order-lookup body without unbounded buffering. */
export async function readMcpOrderLookup(request: Request): Promise<OrderLookupParseResult> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && !/^\d+$/.test(declaredLength)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_CONTENT_LENGTH",
      message: "Invalid Content-Length header",
    };
  }
  if (declaredLength !== null && Number(declaredLength) > MAX_LOOKUP_BODY_BYTES) {
    return bodyTooLarge();
  }

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  const reader = request.body?.getReader();
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_LOOKUP_BODY_BYTES) {
        await reader.cancel();
        return bodyTooLarge();
      }
      chunks.push(value);
    }
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const raw = new TextDecoder().decode(bytes);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, code: "INVALID_REQUEST", message: "Invalid JSON body" };
  }
  const orderId = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>).orderId
    : undefined;
  return parseMcpOrderId(orderId);
}
