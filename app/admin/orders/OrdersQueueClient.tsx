"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Edit, ExternalLink, Mail, Package, RefreshCw, Search, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ShipmentModal, { type ShipmentSubmit } from "./ShipmentModal";
import {
  QUEUE_VIEWS,
  QUEUE_VIEW_LABELS,
  buildQueueQuery,
  clampOffsetAfterRemoval,
  createPerKeyGate,
  createRequestGate,
  deriveEmailState,
  formatQueueMoney,
  mergeShipmentResult,
  type AdminQueueOrder,
  type CarrierOption,
  type EmailState,
  type QueueView,
  type ShippingEmailStatus,
} from "./queue-model";

const PAGE_SIZE = 20;
const EMPTY_COUNTS: Record<QueueView, number> = { awaiting: 0, shipped: 0, cancelled: 0, all: 0 };

interface QueueResponse {
  orders?: AdminQueueOrder[];
  total?: number;
  counts?: Record<QueueView, number>;
  carriers?: CarrierOption[];
  error?: string;
}

interface MutationResponse {
  order?: { status?: string };
  tracking?: AdminQueueOrder["shipment"];
  email?: { success?: boolean; pending?: boolean; needsReview?: boolean; error?: string };
  error?: string;
  code?: string;
}

type Target = { mode: "ship" | "tracking"; order: AdminQueueOrder };
type Notice = { tone: "success" | "warning" | "error"; message: string };

export default function OrdersQueueClient() {
  const [view, setView] = useState<QueueView>("awaiting");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [orders, setOrders] = useState<AdminQueueOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [carriers, setCarriers] = useState<CarrierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [emailStates, setEmailStates] = useState<Record<string, EmailState>>({});
  const [emailBusy, setEmailBusy] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [notesBusy, setNotesBusy] = useState(false);
  const requestGate = useRef(createRequestGate());
  const emailGate = useRef(createPerKeyGate());

  const beginEmailAction = useCallback((orderId: string): boolean => {
    if (!emailGate.current.start(orderId)) return false;
    setEmailBusy(emailGate.current.snapshot());
    return true;
  }, []);

  const finishEmailAction = useCallback((orderId: string): void => {
    emailGate.current.finish(orderId);
    setEmailBusy(emailGate.current.snapshot());
  }, []);

  const load = useCallback(async () => {
    const request = requestGate.current.start();
    setLoading(true);
    setLoadError(null);
    try {
      const params = buildQueueQuery({ view, query, limit: PAGE_SIZE, offset });
      const response = await fetch(`/api/admin/orders?${params}`, { signal: request.signal });
      const body = (await response.json().catch(() => ({}))) as QueueResponse;
      if (!response.ok) throw new Error(body.error ?? `Failed to load orders (${response.status})`);
      if (!request.isCurrent()) return;
      setOrders(body.orders ?? []);
      setTotal(body.total ?? 0);
      setCounts(body.counts ?? EMPTY_COUNTS);
      setCarriers(body.carriers ?? []);
    } catch (error) {
      if (!request.isCurrent() || (error instanceof DOMException && error.name === "AbortError")) return;
      setOrders([]);
      setTotal(0);
      setLoadError(error instanceof Error ? error.message : "Failed to load orders");
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [offset, query, view]);

  useEffect(() => {
    const gate = requestGate.current;
    void load();
    return () => gate.abort();
  }, [load]);

  const refreshEmailState = useCallback(async (orderId: string) => {
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/shipping-email`);
    const body = (await response.json().catch(() => ({}))) as { status?: ShippingEmailStatus; error?: string };
    if (!response.ok) throw new Error(body.error ?? "Could not load shipping email status");
    if (!body.status) throw new Error("Shipping email status was unavailable");
    const emailStatus = body.status;
    setEmailStates((current) => ({ ...current, [orderId]: deriveEmailState(emailStatus) }));
  }, []);

  const loadEmailState = useCallback(async (orderId: string) => {
    if (!beginEmailAction(orderId)) return;
    try {
      await refreshEmailState(orderId);
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Could not load email status" });
    } finally {
      finishEmailAction(orderId);
    }
  }, [beginEmailAction, finishEmailAction, refreshEmailState]);

  const updateOrderNotes = useCallback(async (orderId: string, notes: string) => {
    setNotesBusy(true);
    try {
      const response = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          notes
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Failed to update order notes");
      setOrders((current) => current.map((order) => order.id === orderId
        ? { ...order, notes }
        : order));
      setEditingOrder(null);
      setEditNotes("");
      setNotice({ tone: "success", message: `Notes updated for order ${orderId}.` });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Failed to update order notes" });
    } finally {
      setNotesBusy(false);
    }
  }, []);

  const submitShipment = useCallback(async (input: ShipmentSubmit) => {
    if (!target) return;
    setMutationBusy(true);
    setMutationError(null);
    const endpoint = target.mode === "ship" ? "ship" : "tracking";
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(target.order.id)}/${endpoint}`, {
        method: target.mode === "ship" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrier: input.carrier, trackingNumber: input.trackingNumber }),
      });
      const body = (await response.json().catch(() => ({}))) as MutationResponse;
      if (!response.ok) {
        setMutationError(body.error ?? body.code ?? `Fulfillment update failed (${response.status})`);
        return;
      }

      const updated = mergeShipmentResult(target.order, body);
      // Local state changes only after the server has committed successfully.
      setOrders((current) => view === "awaiting" && target.mode === "ship"
        ? current.filter((order) => order.id !== updated.id)
        : current.map((order) => order.id === updated.id ? updated : order));
      setTarget(null);
      setNotice({
        tone: body.email?.success === false ? "warning" : "success",
        message: body.email?.pending
          ? `Order ${updated.id} is shipped; its email is still processing.`
          : body.email?.needsReview
          ? `Order ${updated.id} is shipped, but its email delivery outcome needs manual review before retrying.`
          : body.email?.success === false
          ? `Order ${updated.id} is shipped, but its email failed${body.email.error ? `: ${body.email.error}` : ""}.`
          : target.mode === "ship"
            ? `Order ${updated.id} marked shipped.`
            : `Tracking updated for order ${updated.id}.`,
      });

      if (view === "awaiting" && target.mode === "ship") {
        const nextOffset = clampOffsetAfterRemoval(offset, PAGE_SIZE, Math.max(0, total - 1));
        if (nextOffset !== offset) setOffset(nextOffset);
        else await load();
      } else {
        await load();
      }
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Fulfillment update failed");
    } finally {
      setMutationBusy(false);
    }
  }, [load, offset, target, total, view]);

  const sendEmail = useCallback(async (order: AdminQueueOrder, state: EmailState) => {
    if (!beginEmailAction(order.id)) return;
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/shipping-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: state.mode }),
      });
      const body = (await response.json().catch(() => ({}))) as MutationResponse;
      if (body.email?.pending) {
        setNotice({ tone: "warning", message: `A matching shipping email for order ${order.id} is still processing.` });
        await refreshEmailState(order.id);
        return;
      }
      if (body.email?.needsReview) {
        setNotice({ tone: "warning", message: `Shipping email delivery for order ${order.id} needs manual review before retrying.` });
        await refreshEmailState(order.id);
        return;
      }
      if (!response.ok || body.email?.success === false) {
        throw new Error(body.error ?? body.email?.error ?? `Shipping email failed (${response.status})`);
      }
      setNotice({ tone: "success", message: `Shipping email sent for order ${order.id}.` });
      await refreshEmailState(order.id);
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Shipping email failed" });
    } finally {
      finishEmailAction(order.id);
    }
  }, [beginEmailAction, finishEmailAction, refreshEmailState]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Fulfillment</h1>
          <p className="text-text-secondary">Ship paid orders and keep customers informed.</p>
        </div>
        <Button onClick={() => void load()} disabled={loading} aria-label="Refresh fulfillment queue">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </header>

      {notice && (
        <Card role="status" className="admin-card flex items-start gap-3 p-4">
          {notice.tone === "success"
            ? <CheckCircle className="h-5 w-5 shrink-0 text-state-success" />
            : <AlertTriangle className={`h-5 w-5 shrink-0 ${notice.tone === "error" ? "text-state-error" : "text-state-warning"}`} />}
          <p className="flex-1 text-sm text-text-secondary">{notice.message}</p>
          <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>Dismiss</Button>
        </Card>
      )}

      <Card className="admin-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label="Fulfillment queue views" className="flex flex-wrap gap-2">
            {QUEUE_VIEWS.map((candidate) => (
              <Button
                key={candidate}
                role="tab"
                aria-selected={view === candidate}
                size="sm"
                variant={view === candidate ? "default" : "ghost"}
                onClick={() => { setView(candidate); setOffset(0); }}
              >
                {QUEUE_VIEW_LABELS[candidate]}
                <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-xs">{Math.min(99, counts[candidate])}{counts[candidate] > 99 ? "+" : ""}</span>
              </Button>
            ))}
          </div>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => { event.preventDefault(); setQuery(searchInput.trim()); setOffset(0); }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
              <Input
                aria-label="Search orders"
                value={searchInput}
                maxLength={40}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Order, recipient, or email"
                className="admin-input w-72 pl-10"
              />
            </div>
            <Button type="submit" size="sm" variant="secondary">Search</Button>
            {query && <Button type="button" size="sm" variant="ghost" onClick={() => { setSearchInput(""); setQuery(""); setOffset(0); }}>Clear</Button>}
          </form>
        </div>
      </Card>

      <Card className="admin-card" aria-busy={loading}>
        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-12 text-text-secondary">
            <RefreshCw className="h-6 w-6 animate-spin" />Loading fulfillment queue…
          </div>
        ) : loadError ? (
          <div role="alert" className="p-8 text-center">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-state-error" />
            <h2 className="font-medium text-text-primary">Could not load orders</h2>
            <p className="mt-1 text-sm text-text-secondary">{loadError}</p>
            <Button className="mt-4" onClick={() => void load()}>Try again</Button>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardList className="mx-auto mb-3 h-10 w-10 text-text-muted" />
            <h2 className="font-medium text-text-primary">Nothing in {QUEUE_VIEW_LABELS[view].toLowerCase()}</h2>
            <p className="mt-1 text-sm text-text-secondary">{query ? "No orders match that search." : "New eligible orders will appear here."}</p>
          </div>
        ) : (
          <div className="divide-y divide-border-default">
            {orders.map((order) => {
              const canShip = order.status === "processing" && order.paymentStatus === "paid";
              const canEditTracking = order.status === "shipped";
              const email = emailStates[order.id];
              const isExpanded = expandedOrders.has(order.id);
              const isEditing = editingOrder === order.id;
              const pricing = order.pricing;
              const totalDisplay = formatQueueMoney(order.totalAmount) ?? "Unavailable";
              const hasCheckoutBreakdown = Object.values(pricing).some(
                (value) => value !== undefined,
              );
              return (
                <article key={order.id} className="space-y-3 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <Link href={`/admin/orders/${encodeURIComponent(order.id)}`} className="font-medium text-text-primary hover:underline">#{order.id}</Link>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                        <span>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "Date unavailable"}</span>
                        <span>{order.customer.name}</span>
                        {order.customer.email && <span>{order.customer.email}</span>}
                        <span className="flex items-center"><Package className="mr-1 h-3 w-3" />{order.itemCount} items</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge>{order.status}</Badge>
                      <span className="font-semibold text-text-primary">{totalDisplay}</span>
                      {canShip && <Button size="sm" onClick={() => { setMutationError(null); setTarget({ mode: "ship", order }); }}><Truck className="mr-2 h-4 w-4" />Mark shipped</Button>}
                      {canEditTracking && <Button size="sm" variant="outline" onClick={() => { setMutationError(null); setTarget({ mode: "tracking", order }); }}>Edit tracking</Button>}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedOrders((current) => {
                          const next = new Set(current);
                          if (next.has(order.id)) next.delete(order.id);
                          else next.add(order.id);
                          return next;
                        })}
                      >
                        <ChevronDown className={`mr-2 h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />Details
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="grid gap-4 rounded bg-surface p-4 lg:grid-cols-2">
                      <div>
                        <h3 className="mb-2 text-sm font-medium text-text-primary">Stored checkout breakdown</h3>
                        {hasCheckoutBreakdown ? (
                          <dl className="space-y-1 text-sm text-text-secondary">
                            {pricing.checkout_catalog_subtotal !== undefined && <div className="flex justify-between gap-4"><dt>Subtotal</dt><dd>{formatQueueMoney(pricing.checkout_catalog_subtotal) ?? "Unavailable"}</dd></div>}
                            {pricing.checkout_shipping_before_discount !== undefined && <div className="flex justify-between gap-4"><dt>Shipping</dt><dd>{formatQueueMoney(pricing.checkout_shipping_before_discount) ?? "Unavailable"}</dd></div>}
                            {pricing.checkout_tax !== undefined && <div className="flex justify-between gap-4"><dt>Tax</dt><dd>{formatQueueMoney(pricing.checkout_tax) ?? "Unavailable"}</dd></div>}
                            {pricing.checkout_discount !== undefined && <div className="flex justify-between gap-4"><dt>Discount</dt><dd>{formatQueueMoney(pricing.checkout_discount) ? `-${formatQueueMoney(pricing.checkout_discount)}` : "Unavailable"}</dd></div>}
                            <div className="flex justify-between gap-4 border-t border-border-default pt-1 font-medium text-text-primary"><dt>Total</dt><dd>{totalDisplay}</dd></div>
                          </dl>
                        ) : (
                          <p className="text-sm text-text-secondary">No stored checkout breakdown.</p>
                        )}
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h3 className="text-sm font-medium text-text-primary">Internal notes</h3>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (isEditing) {
                                setEditingOrder(null);
                                setEditNotes("");
                              } else {
                                setEditingOrder(order.id);
                                setEditNotes(order.notes ?? "");
                              }
                            }}
                          ><Edit className="mr-2 h-4 w-4" />{isEditing ? "Cancel" : "Edit notes"}</Button>
                        </div>
                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea value={editNotes} onChange={(event) => setEditNotes(event.target.value)} rows={3} aria-label={`Internal notes for order ${order.id}`} />
                            <Button size="sm" disabled={notesBusy} onClick={() => void updateOrderNotes(order.id, editNotes)}>{notesBusy ? "Saving…" : "Save notes"}</Button>
                          </div>
                        ) : <p className="whitespace-pre-wrap text-sm text-text-secondary">{order.notes || "No internal notes."}</p>}
                      </div>
                    </div>
                  )}
                  {(order.status === "shipped" || order.status === "delivered") && (
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded bg-surface p-3 text-sm text-text-secondary">
                      <span>Carrier: <strong className="text-text-primary">{order.shipment.carrierLabel ?? "not recorded"}</strong></span>
                      <span>Tracking: {order.shipment.trackingNumber
                        ? order.shipment.trackingUrl
                          ? <a className="inline-flex items-center text-primary-600 hover:underline" href={order.shipment.trackingUrl} target="_blank" rel="noreferrer noopener">{order.shipment.trackingNumber}<ExternalLink className="ml-1 h-3 w-3" /></a>
                          : <strong className="text-text-primary">{order.shipment.trackingNumber}</strong>
                        : <strong className="text-text-primary">none</strong>}</span>
                      {email ? (
                        <>
                          <span className={email.tone === "error" ? "text-state-error" : email.tone === "success" ? "text-state-success" : ""}>{email.message}</span>
                          {order.status === "shipped" && <Button size="sm" variant="outline" disabled={email.disabled || emailBusy.has(order.id)} onClick={() => void sendEmail(order, email)}><Mail className="mr-2 h-4 w-4" />{email.label}</Button>}
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" disabled={emailBusy.has(order.id)} onClick={() => void loadEmailState(order.id)}>
                          {emailBusy.has(order.id) ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}Check email status
                        </Button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Card>

      {total > PAGE_SIZE && (
        <nav aria-label="Fulfillment queue pages" className="flex items-center justify-between rounded-lg border p-4">
          <span className="text-sm text-text-secondary">Page {page} of {pages} ({total} orders)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button>
            <Button size="sm" variant="ghost" disabled={offset + PAGE_SIZE >= total || loading} onClick={() => setOffset(offset + PAGE_SIZE)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>
        </nav>
      )}

      {target && (
        <ShipmentModal
          key={`${target.mode}-${target.order.id}`}
          mode={target.mode}
          orderId={target.order.id}
          carriers={carriers}
          initialCarrier={target.mode === "tracking" ? target.order.shipment.carrier : null}
          initialTrackingNumber={target.mode === "tracking" ? target.order.shipment.trackingNumber : null}
          busy={mutationBusy}
          error={mutationError}
          onCancel={() => { setTarget(null); setMutationError(null); }}
          onSubmit={(input) => void submitShipment(input)}
        />
      )}
    </div>
  );
}
