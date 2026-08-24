export const LEGACY_REDIRECT_PREFIXES = [
  "/products/",
  "/collections/",
  "/pages/",
  "/blogs/",
  "/policies/",
] as const;

export type PermanentRedirectStatus = 301 | 308;

export interface RedirectCandidate {
  targetPath: string;
  statusCode: number | null;
}

export interface ValidatedRedirect {
  targetPath: string;
  statusCode: PermanentRedirectStatus;
}

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._~-]*$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

function hasSafeSegments(pathname: string): boolean {
  if (pathname === "/") return true;
  const segments = pathname.slice(1).split("/");
  return segments.length <= 12 && segments.every((segment) => SAFE_SEGMENT.test(segment));
}

/** Limit D1 work to canonical old-platform paths that the importer can own. */
export function isLegacyRedirectLookupPath(pathname: string): boolean {
  return pathname.length <= 2048
    && LEGACY_REDIRECT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    && !CONTROL_CHARACTER.test(pathname)
    && !pathname.includes("\\")
    && !pathname.includes("%")
    && !pathname.includes("?")
    && !pathname.includes("#")
    && hasSafeSegments(pathname);
}

/** Validate untrusted redirect rows again at their runtime use boundary. */
export function validateRedirectCandidate(
  sourcePath: string,
  candidate: RedirectCandidate | null,
): ValidatedRedirect | null {
  if (!candidate || (candidate.statusCode !== 301 && candidate.statusCode !== 308)) {
    return null;
  }

  const targetPath = candidate.targetPath;
  if (
    targetPath.length > 2048
    || !targetPath.startsWith("/")
    || targetPath.startsWith("//")
    || CONTROL_CHARACTER.test(targetPath)
    || targetPath.includes("\\")
    || targetPath.includes("%")
    || targetPath.includes("?")
    || targetPath.includes("#")
    || !hasSafeSegments(targetPath)
    || sourcePath === targetPath
    || LEGACY_REDIRECT_PREFIXES.some((prefix) => targetPath.startsWith(prefix))
  ) {
    return null;
  }

  return { targetPath, statusCode: candidate.statusCode };
}
