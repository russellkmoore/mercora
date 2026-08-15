export type BoundedRequestBodyResult =
  | { ok: true; text: string }
  | { ok: false };

async function cancelBody(body: ReadableStream<Uint8Array> | null): Promise<void> {
  try {
    await body?.cancel();
  } catch {
    // Preserve the bounded public parse failure if upstream cancellation fails.
  }
}

/** Read a request body without ever materializing more than maxBytes. */
export async function readBoundedUtf8RequestBody(
  request: Request,
  maxBytes: number,
): Promise<BoundedRequestBodyResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new TypeError("Request body limit must be a nonnegative safe integer");
  }
  const declaredHeader = request.headers.get("content-length");
  if (declaredHeader !== null) {
    if (!/^\d+$/.test(declaredHeader)) {
      await cancelBody(request.body);
      return { ok: false };
    }
    const declared = Number(declaredHeader);
    if (!Number.isSafeInteger(declared) || declared > maxBytes) {
      await cancelBody(request.body);
      return { ok: false };
    }
  }
  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let received = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // Preserve the bounded public parse failure.
        }
        return { ok: false };
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, text };
  } catch {
    try {
      await reader.cancel();
    } catch {
      // Preserve the bounded public parse failure.
    }
    return { ok: false };
  } finally {
    reader.releaseLock();
  }
}
