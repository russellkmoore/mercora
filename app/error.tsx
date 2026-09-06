"use client";

import Link from "next/link";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Neutral route fallback. Error details are intentionally never rendered. */
export default function RouteError({ reset }: RouteErrorProps) {
  return (
    <div
      role="alert"
      className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-20 text-center"
    >
      <h1 className="text-2xl font-semibold text-foreground font-display">Something went wrong</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        This page could not be loaded. Please try again.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-primary px-5 py-2.5 font-medium text-on-primary hover:bg-primary/80"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-border px-5 py-2.5 font-medium text-foreground hover:bg-surface-elevated"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
