import {
  isLegacyRedirectLookupPath,
  validateRedirectCandidate,
  type RedirectCandidate,
  type ValidatedRedirect,
} from "./policy";

export type RedirectLookup = (sourcePath: string) => Promise<RedirectCandidate | null>;

export interface ResolvedRedirect extends ValidatedRedirect {
  url: URL;
}

/**
 * Resolve one exact importer-owned mapping. Missing state and D1 failures are
 * intentionally indistinguishable from a normal non-redirected request.
 */
export async function resolveLegacyRedirect(
  requestUrl: string,
  lookup: RedirectLookup,
): Promise<ResolvedRedirect | null> {
  const sourceUrl = new URL(requestUrl);
  const sourcePath = sourceUrl.pathname;
  if (!isLegacyRedirectLookupPath(sourcePath)) return null;

  let candidate: RedirectCandidate | null;
  try {
    candidate = await lookup(sourcePath);
  } catch {
    return null;
  }

  const redirect = validateRedirectCandidate(sourcePath, candidate);
  if (!redirect) return null;

  const url = new URL(redirect.targetPath, sourceUrl.origin);
  if (url.origin !== sourceUrl.origin || url.pathname !== redirect.targetPath) return null;

  // Query state such as campaign attribution belongs to the request, not the
  // durable redirect map. Fragments never reach the server.
  url.search = sourceUrl.search;
  return { ...redirect, url };
}
