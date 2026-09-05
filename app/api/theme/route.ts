/**
 * === Public Active Theme Route (D-02) ===
 *
 * A public, unauthenticated route serving the active theme's name and its
 * manifest token values to a client rendered without the root layout
 * (`app/global-error.tsx`). No admin guard, no request parameter, no
 * request body. This handler must never read or forward a settings row, a
 * D1 record, or an env value directly — the only two things that leave it
 * are a manifest theme name and that theme's manifest token values
 * (T-08.1-01).
 */

import { NextResponse } from "next/server";
import { getActiveTheme } from "@/lib/themes/active-theme";
import { getThemeTokens } from "@/lib/themes/tokens";

// Load-bearing: without this, a build-time prerender would bake the build
// machine's default theme into every response forever (T-08.1-03) — no
// per-request read would ever run again after the first deploy.
export const dynamic = "force-dynamic";

export async function GET() {
  const name = await getActiveTheme();
  const tokens = getThemeTokens(name);

  return NextResponse.json(
    { name, tokens },
    { headers: { "Cache-Control": "no-store" } },
  );
}
