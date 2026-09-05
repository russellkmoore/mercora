"use client";

import { useEffect, useState } from "react";
import { getThemeTokens, type ThemeTokens } from "@/lib/themes/tokens";
import { parseThemeResponse } from "@/lib/themes/theme-response";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root fallback rendered in place of the normal layout. It deliberately uses
 * no application provider, router component, stylesheet, or error detail.
 * Because it renders with no stylesheet, its colors come from
 * `getThemeTokens()` directly rather than the client theme-token hook,
 * which throws outside the provider this page is, by definition, rendered
 * without.
 *
 * Two-paint sequence (D-02): the first paint (server render, and the
 * client's own initial render before any effect runs) always uses the
 * manifest default with no async gate, so there is no flash of unstyled
 * content. After mount, one `useEffect` fetches `/api/theme` and, only on
 * success, repaints with the admin-selected theme's tokens via
 * `parseThemeResponse`. Every failure path — a rejected fetch, a non-ok
 * status, unparseable JSON, or a body naming a theme this bundle doesn't
 * recognise — is swallowed with no state change and no rendered error: a
 * theming failure must never clutter the crash-recovery UI the user is
 * actually looking at.
 */
export default function GlobalError({ reset }: GlobalErrorProps) {
  const [tokens, setTokens] = useState<ThemeTokens>(() => getThemeTokens());

  useEffect(() => {
    let cancelled = false;

    fetch("/api/theme")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled) return;
        const parsed = parseThemeResponse(body);
        if (parsed) {
          setTokens(parsed);
        }
      })
      .catch(() => {
        // Swallow every failure path — see docstring above.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: tokens.surfaceElevated,
          color: tokens.foreground,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "3rem 1.5rem",
            boxSizing: "border-box",
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Something went wrong</h1>
          <p style={{ maxWidth: "28rem", margin: "0.75rem 0 0", color: tokens.mutedForeground }}>
            The storefront could not be loaded. Please try again.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                border: 0,
                borderRadius: "0.375rem",
                background: tokens.primary,
                color: tokens.onPrimary,
                padding: "0.625rem 1.25rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* A root-layout failure cannot rely on Next's router provider. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                border: `1px solid ${tokens.border}`,
                borderRadius: "0.375rem",
                color: tokens.foreground,
                padding: "0.625rem 1.25rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
