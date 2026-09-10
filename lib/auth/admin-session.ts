/**
 * === Server-side admin page gate ===
 *
 * `app/admin/layout.tsx` decides whether to *mount* a page, but in the App
 * Router a page segment renders in parallel with its layout and is streamed in
 * the RSC payload either way (Phase 14 security audit, UF-14-1). So a page that
 * server-renders data has to refuse on its own. Every async `app/admin/**\/page.tsx`
 * calls this first; a non-admin session (or none) gets the same 404 an unknown
 * admin URL gets, so the response reveals nothing about what lives there.
 *
 * `middleware.ts` additionally redirects anonymous `/admin` requests to sign-in
 * before any segment renders; this helper is the second, role-aware line.
 */
import { notFound } from "next/navigation";
import { checkAdminSession, type AdminAuthResult } from "./admin-middleware";

export type AdminSession = AdminAuthResult & { success: true; userId: string };

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await checkAdminSession();
  if (!session.success || !session.userId) {
    notFound();
  }
  return session as AdminSession;
}
