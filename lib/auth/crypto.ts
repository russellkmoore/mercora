/**
 * Dependency-free crypto helpers shared by the auth layer.
 *
 * This module intentionally relies only on Web Crypto so it works in both
 * Cloudflare Workers and the Node test environment.
 */

/** SHA-256 hex digest using Web Crypto (Workers-compatible). */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compare arbitrary strings without leaking a matching prefix through timing.
 * Hashing first makes both comparison inputs fixed-length.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [aHash, bHash] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let mismatch = 0;

  for (let index = 0; index < aHash.length; index += 1) {
    mismatch |= aHash.charCodeAt(index) ^ bHash.charCodeAt(index);
  }

  return mismatch === 0;
}
