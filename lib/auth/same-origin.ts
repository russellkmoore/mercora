type OriginRequest = {
  headers: { get(name: string): string | null };
  nextUrl: { origin: string };
};

function normalizeHttpOrigin(value: string | null): string | null {
  if (!value || value === 'null') return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    if (url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Compare a browser Origin header to the exact request origin after URL normalization. */
export function hasSameOrigin(request: OriginRequest): boolean {
  const suppliedOrigin = normalizeHttpOrigin(request.headers.get('origin'));
  const requestOrigin = normalizeHttpOrigin(request.nextUrl.origin);
  return suppliedOrigin !== null && requestOrigin !== null && suppliedOrigin === requestOrigin;
}
