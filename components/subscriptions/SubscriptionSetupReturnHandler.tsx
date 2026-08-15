"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  completeStripeSetupRedirect,
  scrubStripeSetupRedirect,
  type StripeSetupRedirect,
} from "./acquisition-client";

type ReturnError = {
  ownerId: string | null;
  message: string;
  retryable: boolean;
};

/**
 * Owns Stripe SetupIntent returns at the application shell so URL secrets are
 * scrubbed even when a product disappears or subscription acquisition is off.
 */
export default function SubscriptionSetupReturnHandler() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const currentOwner = isLoaded && isSignedIn && userId ? userId : null;
  const ownerRef = useRef<string | null>(null);
  const [redirect, setRedirect] = useState<StripeSetupRedirect | null>(null);
  const [workingOwner, setWorkingOwner] = useState<string | null>(null);
  const [completedOwner, setCompletedOwner] = useState<string | null>(null);
  const [error, setError] = useState<ReturnError | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const parsed = scrubStripeSetupRedirect(
      window.location.href,
      window.location.origin,
      (cleanUrl) => window.history.replaceState(window.history.state, "", cleanUrl),
    );
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (parsed.kind === "failure") {
        setError({ ownerId: null, message: "Payment method setup was not completed", retryable: false });
        return;
      }
      if (parsed.kind === "malformed") {
        setError({ ownerId: null, message: "Payment method setup return was invalid", retryable: false });
        return;
      }
      setRedirect(parsed);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    ownerRef.current = currentOwner;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setWorkingOwner(null);
      setError((existing) => existing?.ownerId === null ? existing : null);
      setCompletedOwner((existing) => existing === currentOwner ? existing : null);
    });
    return () => { active = false; };
  }, [currentOwner]);

  useEffect(() => {
    if (redirect?.kind !== "success" || !currentOwner) return;
    const owner = currentOwner;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted && ownerRef.current === owner) {
        setError(null);
        setWorkingOwner(owner);
      }
    });
    completeStripeSetupRedirect({
      fetcher: fetch,
      redirect,
      ownerId: owner,
      currentOwner: () => ownerRef.current,
      signal: controller.signal,
    }).then((result) => {
      if (result && !controller.signal.aborted && ownerRef.current === owner) {
        setRedirect({ kind: "none" });
        setCompletedOwner(owner);
      }
    }).catch((failure) => {
      if (!controller.signal.aborted && ownerRef.current === owner) {
        setError({
          ownerId: owner,
          message: failure instanceof Error
            ? failure.message
            : "Subscription finalization is temporarily unavailable",
          retryable: true,
        });
      }
    }).finally(() => {
      if (!controller.signal.aborted && ownerRef.current === owner) setWorkingOwner(null);
    });
    return () => controller.abort();
  }, [currentOwner, redirect, retry]);

  if (redirect?.kind === "success" && !isLoaded) {
    return (
      <aside className="border-b border-orange-800 bg-neutral-950 px-4 py-3 text-center text-sm text-gray-200" role="status">
        Checking your account to finish the subscription request…
      </aside>
    );
  }
  if (redirect?.kind === "success" && !currentOwner) {
    return (
      <aside className="border-b border-orange-800 bg-neutral-950 px-4 py-3 text-center text-sm text-white" role="status">
        <span>Sign in to finish your subscription request. </span>
        <SignInButton mode="modal">
          <button type="button" className="font-semibold text-orange-400 underline">Sign in</button>
        </SignInButton>
      </aside>
    );
  }
  if (workingOwner === currentOwner && currentOwner) {
    return (
      <aside className="border-b border-orange-800 bg-neutral-950 px-4 py-3 text-center text-sm text-gray-200" role="status">
        Finalizing your subscription request…
      </aside>
    );
  }
  if (completedOwner === currentOwner && currentOwner) {
    return (
      <aside className="border-b border-green-800 bg-green-950 px-4 py-3 text-center text-sm text-green-100" role="status">
        Subscription request received and pending secure reconciliation.{" "}
        <Link href="/account/subscriptions" className="font-semibold text-orange-300 underline">
          View subscriptions
        </Link>
      </aside>
    );
  }
  if (error && (error.ownerId === null || error.ownerId === currentOwner)) {
    return (
      <aside className="border-b border-red-800 bg-red-950 px-4 py-3 text-center text-sm text-red-100" role="alert">
        <span>{error.message}. </span>
        {error.retryable ? (
          <button
            type="button"
            className="font-semibold text-orange-300 underline"
            onClick={() => {
              setError(null);
              setRetry((value) => value + 1);
            }}
          >
            Retry finalization
          </button>
        ) : (
          <button type="button" className="font-semibold text-orange-300 underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        )}
      </aside>
    );
  }
  return null;
}
