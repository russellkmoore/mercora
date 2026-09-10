"use client";

import { useAuth, SignInButton } from "@clerk/nextjs";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import StripeProvider from "@/components/checkout/StripeProvider";
import AddAddressDialog from "@/components/subscriptions/AddAddressDialog";
import type { MACHCustomerAddress } from "@/lib/types/mach/Customer";
import {
  ADD_NEW_ADDRESS_VALUE,
  attemptFactsKey,
  confirmSubscriptionSetup,
  createOwnerBoundSubscriptionSetupAttempt,
  fetchSavedAddressesForPlan,
  fetchSubscriptionPlans,
  finalizeSubscriptionSetup,
  nextAddressSelection,
  recurringTotal,
  shippingAddressFromSaved,
  type PublicSubscriptionPlan,
  type SavedSubscriptionAddress,
} from "./acquisition-client";

export interface SubscriptionAcquisitionPanelProps {
  productId: string;
  variantId: string;
  available: boolean;
  enabled: boolean;
  termsVersion?: string;
  termsUrl: string;
}

function cadenceLabel(plan: PublicSubscriptionPlan): string {
  const unit = plan.cadence.count === 1 ? plan.cadence.unit : `${plan.cadence.unit}s`;
  return plan.cadence.count === 1 ? `every ${unit}` : `every ${plan.cadence.count} ${unit}`;
}

function formatPlanPrice(plan: PublicSubscriptionPlan): string {
  return recurringTotal(plan, 1)?.formatted ?? "Unavailable";
}

function addressLabel(saved: SavedSubscriptionAddress): string {
  const localized = (value: string | Record<string, string>) =>
    typeof value === "string" ? value : Object.values(value)[0] ?? "";
  return saved.label || [localized(saved.address.line1), localized(saved.address.city)]
    .filter(Boolean).join(", ");
}

function SetupPaymentForm(props: {
  ownerId: string;
  currentOwner: () => string | null;
  onConfirmed: (setupIntentId: string) => void;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!stripe || !elements || submitting) return;
        const controller = new AbortController();
        requestRef.current?.abort();
        requestRef.current = controller;
        setSubmitting(true);
        props.onError("");
        try {
          const setupIntent = await confirmSubscriptionSetup({
            stripe,
            elements,
            returnUrl: window.location.href,
          });
          if (!controller.signal.aborted && props.currentOwner() === props.ownerId) {
            props.onConfirmed(setupIntent.id);
          }
        } catch (error) {
          if (!controller.signal.aborted && props.currentOwner() === props.ownerId) {
            props.onError(error instanceof Error ? error.message : "Subscription setup failed");
          }
        } finally {
          if (!controller.signal.aborted && props.currentOwner() === props.ownerId) setSubmitting(false);
        }
      }}
    >
      <PaymentElement options={{ paymentMethodOrder: ["card"] }} />
      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="w-full rounded bg-primary px-5 py-3 font-bold text-on-primary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Confirming…" : "Confirm subscription"}
      </button>
    </form>
  );
}

export default function SubscriptionAcquisitionPanel({
  productId,
  variantId,
  available,
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
  const [quantityText, setQuantityText] = useState("1");
  const [addresses, setAddresses] = useState<SavedSubscriptionAddress[]>([]);
  const [addressesOwner, setAddressesOwner] = useState<string | null>(null);
  const [addressId, setAddressId] = useState("");
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [setup, setSetup] = useState<{
    acquisitionId: string;
    setupIntentId: string;
    clientSecret: string;
    ownerId: string;
  } | null>(null);
  const [working, setWorking] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [completedOwner, setCompletedOwner] = useState<string | null>(null);
  const [confirmedSetup, setConfirmedSetup] = useState<{
    ownerId: string;
    setupIntentId: string;
  } | null>(null);
  const [finalizationWorking, setFinalizationWorking] = useState(false);
  const [finalizationRetry, setFinalizationRetry] = useState(0);
  const attemptRef = useRef<{ facts: string; key: string } | null>(null);
  const ownerRef = useRef<string | null>(null);
  const beginControllerRef = useRef<AbortController | null>(null);
  const refreshControllerRef = useRef<AbortController | null>(null);
  const currentOwner = isLoaded && isSignedIn && userId ? userId : null;
  const [stateOwner, setStateOwner] = useState(currentOwner);
  if (stateOwner !== currentOwner) {
    setStateOwner(currentOwner);
    setSetup(null);
    setCheckoutError("");
    setCompletedOwner(null);
    if (currentOwner !== null && confirmedSetup?.ownerId !== currentOwner) {
      setConfirmedSetup(null);
      setFinalizationWorking(false);
      setFinalizationRetry(0);
    }
    setAccepted(false);
    setWorking(false);
  }

  useEffect(() => {
    ownerRef.current = currentOwner;
    beginControllerRef.current?.abort();
    refreshControllerRef.current?.abort();
    attemptRef.current = null;
  }, [currentOwner]);

  useEffect(() => () => refreshControllerRef.current?.abort(), []);

  useEffect(() => {
    if (!confirmedSetup || confirmedSetup.ownerId !== currentOwner) return;
    const owner = confirmedSetup.ownerId;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted && ownerRef.current === owner) {
        setCheckoutError("");
        setFinalizationWorking(true);
      }
    });
    finalizeSubscriptionSetup(fetch, confirmedSetup.setupIntentId, controller.signal)
      .then(() => {
        if (!controller.signal.aborted && ownerRef.current === owner) {
          setConfirmedSetup(null);
          setCompletedOwner(owner);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && ownerRef.current === owner) {
          setCheckoutError(error instanceof Error ? error.message : "Subscription finalization failed");
          setFinalizationWorking(false);
        }
      });
    return () => controller.abort();
  }, [confirmedSetup, currentOwner, finalizationRetry]);

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
          setAddressId(nextAddressSelection(next));
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
    return () => {
      controller.abort();
      // A plan or auth change reloads the list; a post-save refresh still in
      // flight must not race that reload for `addresses`/`addressId`.
      refreshControllerRef.current?.abort();
    };
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

  const parsedQuantity = Number(quantityText);
  const quantity = Number.isSafeInteger(parsedQuantity) && parsedQuantity >= 1 && parsedQuantity <= 1000
    ? parsedQuantity : null;
  const total = selectedPlan && quantity !== null ? recurringTotal(selectedPlan, quantity) : null;
  const facts = useMemo(() => selectedPlan && termsVersion && quantity !== null ? attemptFactsKey({
    planId: selectedPlan.id,
    quantity,
    shippingAddress: selectedPlan.shippingRequired ? selectedShippingAddress : undefined,
    termsVersion,
  }) : "", [quantity, selectedPlan, selectedShippingAddress, termsVersion]);

  // address-save-region:start
  async function handleAddressSaved(saved: MACHCustomerAddress) {
    setAddressDialogOpen(false);
    const owner = currentOwner;
    if (!owner || !selectedPlan) return;
    // Same reset discipline as a manual address change (D-05), applied before
    // the refresh so nothing can be started against the previous address while
    // the list is reloading; `loadingAddresses` also gates Continue below.
    setSetup(null);
    setCheckoutError("");
    setCompletedOwner(null);
    const controller = new AbortController();
    refreshControllerRef.current?.abort();
    refreshControllerRef.current = controller;
    const live = () => !controller.signal.aborted && ownerRef.current === owner;
    setLoadingAddresses(true);
    setAddressError("");
    try {
      const next = await fetchSavedAddressesForPlan(fetch, selectedPlan, controller.signal);
      if (!live()) return;
      const nextId = nextAddressSelection(next, saved.id);
      setAddresses(next);
      setAddressesOwner(owner);
      setAddressId(nextId);
      if (saved.id && nextId !== saved.id) {
        // The account API accepted it but the subscription filter did not:
        // say so instead of silently selecting a different address.
        setAddressError("The new address was saved but cannot be used for this subscription. Edit it under Account > Addresses.");
      }
    } catch (error) {
      if (live()) {
        setAddressError(error instanceof Error ? error.message : "Saved addresses could not be loaded");
      }
    } finally {
      if (live()) setLoadingAddresses(false);
    }
  }
  // address-save-region:end

  if (!enabled || !termsVersion) return null;
  if (completedOwner === currentOwner && currentOwner) {
    return (
      <section className="rounded-lg border border-success bg-success/30 p-5" aria-live="polite">
        <h2 className="font-semibold text-success">Subscription request received</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your payment method is confirmed. The subscription is pending secure reconciliation.
        </p>
        <Link className="mt-3 inline-block text-sm font-semibold text-primary underline" href="/account/subscriptions">
          View subscriptions
        </Link>
      </section>
    );
  }
  if (confirmedSetup?.ownerId === currentOwner && currentOwner) {
    if (finalizationWorking) {
      return <p className="text-sm text-muted-foreground" role="status">Finalizing your subscription request…</p>;
    }
    return (
      <section className="rounded-lg border border-danger bg-danger/30 p-5" role="alert">
        <h2 className="font-semibold text-danger">Subscription finalization needs attention</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {checkoutError || "Subscription finalization is temporarily unavailable"}
        </p>
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-primary underline"
          onClick={() => {
            setCheckoutError("");
            setFinalizationWorking(true);
            setFinalizationRetry((value) => value + 1);
          }}
        >
          Retry finalization
        </button>
      </section>
    );
  }
  // Keep an already-started provider form mounted through inventory changes;
  // explicit Back/auth changes still unmount it and abort owner-bound handling.
  if (!available && !setup) return null;
  if (loadingPlans) return <p className="text-sm text-muted-foreground" role="status">Checking subscription options…</p>;
  if (planError) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm">
        <p className="text-muted-foreground">{planError}</p>
        <button
          type="button"
          className="mt-2 text-primary underline"
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

  return (
    <section className="rounded-lg border border-primary/70 bg-surface p-4 sm:p-5" aria-labelledby="subscribe-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="subscribe-heading" className="font-bold text-foreground">Subscribe</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatPlanPrice(selectedPlan)} {cadenceLabel(selectedPlan)}
          </p>
        </div>
        {plans.length > 1 && !setup ? (
          <label className="text-sm text-muted-foreground">
            Delivery schedule
            <select
              className="mt-1 block rounded border border-border bg-surface-elevated px-3 py-2 text-foreground"
              value={selectedPlanId}
              onChange={(event) => {
                setSelectedPlanId(event.target.value);
                setAddressId("");
                setAccepted(false);
                setSetup(null);
                setCheckoutError("");
                setCompletedOwner(null);
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

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Recurring charges continue {cadenceLabel(selectedPlan)} until canceled. You can request cancellation from your account.
      </p>
      <p className="mt-2 text-sm font-semibold text-foreground" aria-live="polite">
        Recurring total: {total?.formatted ?? "Unavailable"} {cadenceLabel(selectedPlan)}
      </p>

      {!isLoaded ? <p className="mt-4 text-sm text-muted-foreground">Checking your account…</p> : null}
      {isLoaded && !isSignedIn ? (
        <div className="mt-4">
          <SignInButton mode="modal">
            <button type="button" className="rounded bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary/90">
              Sign in to subscribe
            </button>
          </SignInButton>
        </div>
      ) : null}

      {isLoaded && isSignedIn && !setup ? (
        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-foreground">
            Quantity
            <input
              type="number"
              min={1}
              max={1000}
              inputMode="numeric"
              value={quantityText}
              onChange={(event) => {
                setQuantityText(event.target.value.slice(0, 16));
                setSetup(null);
                setCheckoutError("");
                setCompletedOwner(null);
              }}
              className="mt-1 block w-24 rounded border border-border bg-surface-elevated px-3 py-2 text-foreground"
            />
          </label>

          {selectedPlan.shippingRequired ? (
            <div>
              <label className="block text-sm font-medium text-foreground">
                Shipping address
                <select
                  value={addressId}
                  disabled={loadingAddresses}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === ADD_NEW_ADDRESS_VALUE) {
                      setAddressDialogOpen(true);
                      return;
                    }
                    setAddressId(value);
                    setSetup(null);
                    setCheckoutError("");
                    setCompletedOwner(null);
                  }}
                  className="mt-1 block w-full rounded border border-border bg-surface-elevated px-3 py-2 text-foreground disabled:opacity-50"
                >
                  <option value="">
                    {visibleAddresses.length === 0 ? "Add an address to continue" : "Select an address"}
                  </option>
                  {visibleAddresses.map((address) => (
                    <option key={address.id} value={address.id}>{addressLabel(address)}</option>
                  ))}
                  <option value={ADD_NEW_ADDRESS_VALUE}>Add a new address…</option>
                </select>
              </label>
              {loadingAddresses ? <p className="mt-2 text-xs text-muted-foreground">Loading saved addresses…</p> : null}
              {addressError ? <p className="mt-2 text-sm text-danger" role="alert">{addressError}</p> : null}
            </div>
          ) : null}
          <AddAddressDialog
            open={addressDialogOpen}
            onOpenChange={setAddressDialogOpen}
            onSaved={handleAddressSaved}
          />

          {quantity === null || total === null ? (
            <p className="text-sm text-danger" role="alert">Enter a valid quantity and recurring amount.</p>
          ) : (
            <p className="rounded border border-border bg-surface-elevated p-3 text-sm text-foreground">
              You will confirm a recurring total of <strong>{total.formatted}</strong> {cadenceLabel(selectedPlan)}.
            </p>
          )}

          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <span>
              I agree to the recurring purchase terms in the{" "}
              <Link href={termsUrl} className="text-primary underline">terms of service</Link>.
            </span>
          </label>

          {checkoutError ? <p className="text-sm text-danger" role="alert">{checkoutError}</p> : null}
          <button
            type="button"
            disabled={working || loadingAddresses || !accepted || quantity === null || total === null
              || !currentOwner
              || (selectedPlan.shippingRequired
              && !selectedShippingAddress)}
            onClick={async () => {
              if (!currentOwner || quantity === null || total === null) {
                setCheckoutError("Enter a valid subscription quantity");
                return;
              }
              const owner = currentOwner;
              const controller = new AbortController();
              beginControllerRef.current?.abort();
              beginControllerRef.current = controller;
              setWorking(true);
              setCheckoutError("");
              try {
                if (!attemptRef.current || attemptRef.current.facts !== facts) {
                  attemptRef.current = { facts, key: crypto.randomUUID() };
                }
                if (selectedPlan.shippingRequired && !selectedShippingAddress) {
                  throw new Error("Select a valid saved shipping address");
                }
                const result = await createOwnerBoundSubscriptionSetupAttempt(fetch, {
                  planId: selectedPlan.id,
                  quantity,
                  shippingAddress: selectedShippingAddress,
                  termsVersion,
                  idempotencyKey: attemptRef.current.key,
                }, owner, () => ownerRef.current, controller.signal);
                if (result) setSetup(result);
              } catch (error) {
                if (!controller.signal.aborted && ownerRef.current === owner) {
                  setCheckoutError(error instanceof Error ? error.message : "Subscription setup failed");
                }
              } finally {
                if (!controller.signal.aborted && ownerRef.current === owner) setWorking(false);
              }
            }}
            className="w-full rounded bg-primary px-5 py-3 font-bold text-on-primary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {working ? "Starting secure setup…" : "Continue to payment method"}
          </button>
        </div>
      ) : null}

      {setup && setup.ownerId === currentOwner ? (
        <div className="mt-5 space-y-4 rounded bg-surface-elevated p-4 text-foreground">
          <StripeProvider clientSecret={setup.clientSecret}>
            <SetupPaymentForm
              ownerId={setup.ownerId}
              currentOwner={() => ownerRef.current}
              onConfirmed={(setupIntentId) => {
                setSetup(null);
                setCheckoutError("");
                setFinalizationWorking(true);
                setConfirmedSetup({ ownerId: setup.ownerId, setupIntentId });
              }}
              onError={setCheckoutError}
            />
          </StripeProvider>
          {checkoutError ? <p className="text-sm text-danger" role="alert">{checkoutError}</p> : null}
          <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setSetup(null)}>
            Back to subscription options
          </button>
        </div>
      ) : null}
    </section>
  );
}
