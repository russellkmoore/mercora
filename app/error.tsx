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
      <h1 className="text-2xl font-semibold text-white">Something went wrong</h1>
      <p className="mt-3 max-w-md text-gray-300">
        This page could not be loaded. Please try again.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-orange-600 px-5 py-2.5 font-medium text-white hover:bg-orange-700"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-gray-500 px-5 py-2.5 font-medium text-white hover:bg-neutral-800"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
