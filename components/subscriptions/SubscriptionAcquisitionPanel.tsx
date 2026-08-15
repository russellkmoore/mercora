"use client";

import { useAuth, SignInButton } from "@clerk/nextjs";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import StripeProvider from "@/components/checkout/StripeProvider";
import {
  attemptFactsKey,
  confirmSetupAndFinalize,
  createSubscriptionSetupAttempt,
  fetchSavedAddressesForPlan,
  fetchSubscriptionPlans,
  shippingAddressFromSaved,
  type PublicSubscriptionPlan,
  type SavedSubscriptionAddress,
} from "./acquisition-client";

export interface SubscriptionAcquisitionPanelProps {
  productId: string;
  variantId: string;
  enabled: boolean;
  termsVersion?: string;
  termsUrl: string;
}

function cadenceLabel(plan: PublicSubscriptionPlan): string {
  const unit = plan.cadence.count === 1 ? plan.cadence.unit : `${plan.cadence.unit}s`;
  return plan.cadence.count === 1 ? `every ${unit}` : `every ${plan.cadence.count} ${unit}`;
}

function formatPlanPrice(plan: PublicSubscriptionPlan): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: plan.price.currency,
    minimumFractionDigits: plan.price.precision,
    maximumFractionDigits: plan.price.precision,
  }).format(plan.price.amount);
}

function addressLabel(saved: SavedSubscriptionAddress): string {
  const localized = (value: string | Record<string, string>) =>
    typeof value === "string" ? value : Object.values(value)[0] ?? "";
  return saved.label || [localized(saved.address.line1), localized(saved.address.city)]
    .filter(Boolean).join(", ");
}

function SetupPaymentForm(props: {
  onComplete: () => void;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!stripe || !elements || submitting) return;
        setSubmitting(true);
        props.onError("");
        try {
          await confirmSetupAndFinalize({
            stripe,
            elements,
            fetcher: fetch,
            returnUrl: window.location.href,
          });
          props.onComplete();
        } catch (error) {
          props.onError(error instanceof Error ? error.message : "Subscription setup failed");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <PaymentElement options={{ paymentMethodOrder: ["card"] }} />
      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="w-full rounded bg-orange-500 px-5 py-3 font-bold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Confirming…" : "Confirm subscription"}
      </button>
    </form>
  );
}

export default function SubscriptionAcquisitionPanel({
  productId,
  variantId,
  enabled,
  termsVersion,
  termsUrl,
}: SubscriptionAcquisitionPanelProps) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [plans, setPlans] = useState<PublicSubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [planError, setPlanError] = useState("");
  const [planRetry, setPlanRetry] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addresses, setAddresses] = useState<SavedSubscriptionAddress[]>([]);
  const [addressesOwner, setAddressesOwner] = useState<string | null>(null);
  const [addressId, setAddressId] = useState("");
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [setup, setSetup] = useState<{
    acquisitionId: string;
    setupIntentId: string;
    clientSecret: string;
  } | null>(null);
  const [working, setWorking] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [completed, setCompleted] = useState(false);
  const attemptRef = useRef<{ facts: string; key: string } | null>(null);

  useEffect(() => {
    if (!enabled || !termsVersion || !variantId) return;
    const controller = new AbortController();
    fetchSubscriptionPlans(fetch, variantId, controller.signal)
      .then((next) => {
        const matching = next.filter((plan) => plan.product.id === productId);
        setPlans(matching);
        setSelectedPlanId(matching[0]?.id ?? "");
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setPlanError(error instanceof Error ? error.message : "Subscription options could not be loaded");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPlans(false);
      });
    return () => controller.abort();
  }, [enabled, planRetry, productId, termsVersion, variantId]);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);

  useEffect(() => {
    if (!selectedPlan?.shippingRequired || !isLoaded || !isSignedIn || !userId) {
      return;
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoadingAddresses(true);
      setAddressError("");
      fetchSavedAddressesForPlan(fetch, selectedPlan, controller.signal)
        .then((next) => {
          setAddresses(next);
          setAddressesOwner(userId);
          setAddressId(next.find((entry) => entry.is_default)?.id ?? next[0]?.id ?? "");
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            setAddressError(error instanceof Error ? error.message : "Saved addresses could not be loaded");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingAddresses(false);
        });
    });
    return () => controller.abort();
  }, [isLoaded, isSignedIn, selectedPlan, userId]);

  const visibleAddresses = useMemo(
    () => addressesOwner === userId ? addresses : [],
    [addresses, addressesOwner, userId],
  );
  const selectedSavedAddress = useMemo(
    () => visibleAddresses.find((entry) => entry.id === addressId),
    [addressId, visibleAddresses],
  );
  const selectedShippingAddress = useMemo(() => {
    if (!selectedPlan?.shippingRequired || !selectedSavedAddress) return undefined;
    try {
      return shippingAddressFromSaved(selectedSavedAddress);
    } catch {
      return undefined;
    }
  }, [selectedPlan?.shippingRequired, selectedSavedAddress]);

  const facts = useMemo(() => selectedPlan && termsVersion ? attemptFactsKey({
    planId: selectedPlan.id,
    quantity,
    shippingAddress: selectedPlan.shippingRequired ? selectedShippingAddress : undefined,
    termsVersion,
  }) : "", [quantity, selectedPlan, selectedShippingAddress, termsVersion]);

  if (!enabled || !termsVersion) return null;
  if (loadingPlans) return <p className="text-sm text-gray-400" role="status">Checking subscription options…</p>;
  if (planError) {
    return (
      <div className="rounded-lg border border-neutral-700 p-4 text-sm">
        <p className="text-gray-300">{planError}</p>
        <button
          type="button"
          className="mt-2 text-orange-400 underline"
          onClick={() => {
            setLoadingPlans(true);
            setPlanError("");
            setPlans([]);
            setSelectedPlanId("");
            setPlanRetry((value) => value + 1);
          }}
        >
          Retry
        </button>
      </div>
    );
  }
  if (!selectedPlan) return null;

  if (completed) {
    return (
      <section className="rounded-lg border border-green-700 bg-green-950/30 p-5" aria-live="polite">
        <h2 className="font-semibold text-green-300">Subscription request received</h2>
        <p className="mt-2 text-sm text-gray-300">
          Your payment method is confirmed. The subscription is pending secure reconciliation.
        </p>
        <Link className="mt-3 inline-block text-sm font-semibold text-orange-400 underline" href="/account/subscriptions">
          View subscriptions
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-orange-700/70 bg-neutral-950 p-4 sm:p-5" aria-labelledby="subscribe-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="subscribe-heading" className="font-bold text-white">Subscribe</h2>
          <p className="mt-1 text-sm text-gray-300">
            {formatPlanPrice(selectedPlan)} {cadenceLabel(selectedPlan)}
          </p>
        </div>
        {plans.length > 1 && !setup ? (
          <label className="text-sm text-gray-300">
            Delivery schedule
            <select
              className="mt-1 block rounded border border-neutral-600 bg-neutral-900 px-3 py-2 text-white"
              value={selectedPlanId}
              onChange={(event) => {
                setSelectedPlanId(event.target.value);
                setAddressId("");
                setAccepted(false);
                setSetup(null);
                setCheckoutError("");
                setCompleted(false);
              }}
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {formatPlanPrice(plan)} {cadenceLabel(plan)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-gray-400">
        Recurring charges continue {cadenceLabel(selectedPlan)} until canceled. You can request cancellation from your account.
      </p>

      {!isLoaded ? <p className="mt-4 text-sm text-gray-400">Checking your account…</p> : null}
      {isLoaded && !isSignedIn ? (
        <div className="mt-4">
          <SignInButton mode="modal">
            <button type="button" className="rounded bg-orange-500 px-4 py-2 font-semibold text-black hover:bg-orange-400">
              Sign in to subscribe
            </button>
          </SignInButton>
        </div>
      ) : null}

      {isLoaded && isSignedIn && !setup ? (
        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-gray-200">
            Quantity
            <input
              type="number"
              min={1}
              max={1000}
              inputMode="numeric"
              value={quantity}
              onChange={(event) => {
                const next = Number(event.target.value);
                setQuantity(Number.isSafeInteger(next) ? Math.min(1000, Math.max(1, next)) : 1);
                setSetup(null);
                setCheckoutError("");
                setCompleted(false);
              }}
              className="mt-1 block w-24 rounded border border-neutral-600 bg-neutral-900 px-3 py-2 text-white"
            />
          </label>

          {selectedPlan.shippingRequired ? (
            <div>
              <label className="block text-sm font-medium text-gray-200">
                Shipping address
                <select
                  value={addressId}
                  disabled={loadingAddresses || visibleAddresses.length === 0}
                  onChange={(event) => {
                    setAddressId(event.target.value);
                    setSetup(null);
                    setCheckoutError("");
                    setCompleted(false);
                  }}
                  className="mt-1 block w-full rounded border border-neutral-600 bg-neutral-900 px-3 py-2 text-white disabled:opacity-50"
                >
                  <option value="">Select an address</option>
                  {visibleAddresses.map((address) => (
                    <option key={address.id} value={address.id}>{addressLabel(address)}</option>
                  ))}
                </select>
              </label>
              {loadingAddresses ? <p className="mt-2 text-xs text-gray-400">Loading saved addresses…</p> : null}
              {addressError ? <p className="mt-2 text-sm text-red-300" role="alert">{addressError}</p> : null}
              {!loadingAddresses && visibleAddresses.length === 0 ? (
                <p className="mt-2 text-sm text-gray-300">
                  A saved shipping address is required.{" "}
                  <Link className="text-orange-400 underline" href="/account/addresses">Manage addresses</Link>
                </p>
              ) : null}
            </div>
          ) : null}

          <label className="flex items-start gap-3 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1 h-4 w-4 accent-orange-500"
            />
            <span>
              I agree to the recurring purchase terms in the{" "}
              <Link href={termsUrl} className="text-orange-400 underline">terms of service</Link>.
            </span>
          </label>

          {checkoutError ? <p className="text-sm text-red-300" role="alert">{checkoutError}</p> : null}
          <button
            type="button"
            disabled={working || !accepted || (selectedPlan.shippingRequired
              && !selectedShippingAddress)}
            onClick={async () => {
              setWorking(true);
              setCheckoutError("");
              try {
                if (!attemptRef.current || attemptRef.current.facts !== facts) {
                  attemptRef.current = { facts, key: crypto.randomUUID() };
                }
                if (selectedPlan.shippingRequired && !selectedShippingAddress) {
                  throw new Error("Select a valid saved shipping address");
                }
                const result = await createSubscriptionSetupAttempt(fetch, {
                  planId: selectedPlan.id,
                  quantity,
                  shippingAddress: selectedShippingAddress,
                  termsVersion,
                  idempotencyKey: attemptRef.current.key,
                });
                setSetup(result);
              } catch (error) {
                setCheckoutError(error instanceof Error ? error.message : "Subscription setup failed");
              } finally {
                setWorking(false);
              }
            }}
            className="w-full rounded bg-orange-500 px-5 py-3 font-bold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {working ? "Starting secure setup…" : "Continue to payment method"}
          </button>
        </div>
      ) : null}

      {setup ? (
        <div className="mt-5 space-y-4 rounded bg-white p-4 text-black">
          <StripeProvider clientSecret={setup.clientSecret}>
            <SetupPaymentForm onComplete={() => setCompleted(true)} onError={setCheckoutError} />
          </StripeProvider>
          {checkoutError ? <p className="text-sm text-red-700" role="alert">{checkoutError}</p> : null}
          <button type="button" className="text-sm text-neutral-700 underline" onClick={() => setSetup(null)}>
            Back to subscription options
          </button>
        </div>
      ) : null}
    </section>
  );
}
