"use client";

import { getThemeTokens } from "@/lib/themes/tokens";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root fallback rendered in place of the normal layout. It deliberately uses
 * no application provider, router component, stylesheet, or error detail.
 * Because it renders with no stylesheet, its colors come from getThemeTokens()
 * directly rather than the client theme-token hook, which throws outside the
 * provider this page is, by definition, rendered without.
 */
export default function GlobalError({ reset }: GlobalErrorProps) {
  const tokens = getThemeTokens();
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
