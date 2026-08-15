"use client";

import { useEffect, useState } from "react";
import {
  AdminSubscriptionPlanApiError,
  createAdminSubscriptionPlan,
  getAdminSubscriptionPlan,
  listAdminSubscriptionPlans,
  updateAdminSubscriptionPlan,
  type AdminPlanStatusFilter,
  type AdminSubscriptionPlan,
  type CadenceUnit,
  type SubscriptionPlanWrite,
} from "./plan-admin-client";

const PAGE_SIZE = 20;
const emptyPlan: SubscriptionPlanWrite = {
  id: "",
  productId: "",
  variantId: "",
  currency: "USD",
  unitAmountMinor: 0,
  stripePriceId: "",
  cadence: { unit: "month", count: 1 },
  active: false,
};

function safeMessage(error: unknown): string {
  if (error instanceof AdminSubscriptionPlanApiError) return error.message;
  return "Subscription plan management is temporarily unavailable.";
}

function cadence(plan: AdminSubscriptionPlan): string {
  const plural = plan.cadence.count === 1 ? plan.cadence.unit : `${plan.cadence.unit}s`;
  return plan.cadence.count === 1 ? `Every ${plural}` : `Every ${plan.cadence.count} ${plural}`;
}

function PlanForm(props: {
  original?: AdminSubscriptionPlan;
  onSaved: (plan: AdminSubscriptionPlan) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<SubscriptionPlanWrite>(() => props.original ? {
    id: props.original.id,
    productId: props.original.product.id,
    variantId: props.original.variant.id,
    currency: props.original.price.currency,
    unitAmountMinor: props.original.unitAmountMinor,
    stripePriceId: props.original.stripePriceId,
    cadence: props.original.cadence,
    active: props.original.active,
  } : emptyPlan);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const editing = props.original !== undefined;

  const textField = (
    label: string,
    key: "id" | "productId" | "variantId" | "currency" | "stripePriceId",
    options: { disabled?: boolean; hint?: string } = {},
  ) => (
    <label className="block text-sm text-gray-200">
      {label}
      <input
        required
        disabled={options.disabled}
        value={draft[key]}
        onChange={(event) => setDraft((current) => ({
          ...current,
          [key]: key === "currency" ? event.target.value.toUpperCase() : event.target.value,
        }))}
        className="mt-1 block w-full rounded border border-neutral-600 bg-neutral-950 px-3 py-2 text-white disabled:opacity-60"
      />
      {options.hint ? <span className="mt-1 block text-xs text-gray-400">{options.hint}</span> : null}
    </label>
  );

  return (
    <form
      className="rounded-lg border border-neutral-700 bg-neutral-900 p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        if (props.original?.active && !draft.active
          && !window.confirm("Deactivate this plan? Existing subscriptions remain, but new acquisitions stop.")) {
          return;
        }
        setSaving(true);
        setError("");
        try {
          const saved = editing
            ? await updateAdminSubscriptionPlan(fetch, props.original!, {
                productId: draft.productId,
                variantId: draft.variantId,
                currency: draft.currency,
                unitAmountMinor: draft.unitAmountMinor,
                stripePriceId: draft.stripePriceId,
                cadence: draft.cadence,
                active: draft.active,
              })
            : await createAdminSubscriptionPlan(fetch, draft);
          props.onSaved(saved);
        } catch (cause) {
          setError(safeMessage(cause));
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{editing ? "Edit plan binding" : "Create plan binding"}</h2>
          <p className="mt-1 text-sm text-gray-400">
            Bind an existing catalog variant to a pre-existing Stripe Price. This form does not create Stripe Prices.
          </p>
        </div>
        <button type="button" onClick={props.onCancel} className="text-sm text-gray-300 underline">Close</button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {textField("Plan id", "id", { disabled: editing, hint: "Stable Mercora identifier; cannot be changed later." })}
        {textField("Existing Stripe Price id", "stripePriceId", { hint: "Must start with price_. Stripe verifies the exact binding before save." })}
        {textField("Product id", "productId")}
        {textField("Variant id", "variantId")}
        {textField("Currency", "currency", { hint: "Uppercase ISO code matching the catalog variant and Stripe Price." })}
        <label className="block text-sm text-gray-200">
          Unit amount in minor units
          <input
            required
            type="number"
            min={0}
            step={1}
            value={draft.unitAmountMinor}
            onChange={(event) => setDraft((current) => ({
              ...current,
              unitAmountMinor: Number(event.target.value),
            }))}
            className="mt-1 block w-full rounded border border-neutral-600 bg-neutral-950 px-3 py-2 text-white"
          />
          <span className="mt-1 block text-xs text-gray-400">For USD, 1250 means $12.50.</span>
        </label>
        <label className="block text-sm text-gray-200">
          Cadence count
          <input
            required
            type="number"
            min={1}
            max={365}
            step={1}
            value={draft.cadence.count}
            onChange={(event) => setDraft((current) => ({
              ...current,
              cadence: { ...current.cadence, count: Number(event.target.value) },
            }))}
            className="mt-1 block w-full rounded border border-neutral-600 bg-neutral-950 px-3 py-2 text-white"
          />
        </label>
        <label className="block text-sm text-gray-200">
          Cadence unit
          <select
            value={draft.cadence.unit}
            onChange={(event) => setDraft((current) => ({
              ...current,
              cadence: { ...current.cadence, unit: event.target.value as CadenceUnit },
            }))}
            className="mt-1 block w-full rounded border border-neutral-600 bg-neutral-950 px-3 py-2 text-white"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
        </label>
      </div>

      <label className="mt-4 flex items-start gap-3 text-sm text-gray-200">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
          className="mt-1 h-4 w-4 accent-orange-500"
        />
        <span>Active and available for new customer acquisitions after provider verification.</span>
      </label>

      {error ? <p className="mt-4 rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-200" role="alert">{error}</p> : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
        >
          {saving ? "Verifying and saving…" : editing ? "Save binding" : "Create binding"}
        </button>
        <button type="button" onClick={props.onCancel} className="rounded border border-neutral-600 px-4 py-2 text-gray-200 hover:bg-neutral-800">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function SubscriptionPlanManager() {
  const [filter, setFilter] = useState<AdminPlanStatusFilter>("all");
  const [offset, setOffset] = useState(0);
  const [plans, setPlans] = useState<AdminSubscriptionPlan[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminSubscriptionPlan | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionId, setActionId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError("");
      setPlans([]);
      setTotal(0);
      listAdminSubscriptionPlans(fetch, { filter, limit: PAGE_SIZE, offset, signal: controller.signal })
        .then((result) => {
          setPlans(result.plans);
          setTotal(result.total);
        })
        .catch((cause) => {
          if (!controller.signal.aborted) {
            setPlans([]);
            setTotal(0);
            setError(safeMessage(cause));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });
    return () => controller.abort();
  }, [filter, offset, reload]);

  const refresh = () => {
    setCreating(false);
    setEditing(null);
    setOffset(0);
    setReload((value) => value + 1);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="text-sm text-gray-300">
          Status
          <select
            value={filter}
            onChange={(event) => {
              setPlans([]);
              setTotal(0);
              setLoading(true);
              setFilter(event.target.value as AdminPlanStatusFilter);
              setOffset(0);
            }}
            className="mt-1 block rounded border border-neutral-600 bg-neutral-900 px-3 py-2 text-white"
          >
            <option value="all">All plans</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => { setCreating(true); setEditing(null); }}
          className="rounded bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-500"
        >
          New plan binding
        </button>
      </div>

      {creating ? <PlanForm onSaved={refresh} onCancel={() => setCreating(false)} /> : null}
      {loadingDetail ? <p className="text-sm text-gray-400" role="status">Loading latest plan version…</p> : null}
      {editing ? <PlanForm key={editing.updatedAt} original={editing} onSaved={refresh} onCancel={() => setEditing(null)} /> : null}

      {error ? (
        <div className="rounded border border-red-800 bg-red-950/40 p-4" role="alert">
          <p className="text-sm text-red-200">{error}</p>
          <button type="button" className="mt-2 text-sm text-orange-300 underline" onClick={() => setReload((value) => value + 1)}>Retry</button>
        </div>
      ) : null}
      {loading ? <p className="text-sm text-gray-400" role="status">Loading subscription plans…</p> : null}

      {!loading && !error && plans.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-600 p-8 text-center text-gray-400">
          No subscription plans match this filter. You can stage an inactive binding before customer acquisition is enabled.
        </div>
      ) : null}

      {!loading && !error && plans.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-neutral-700">
          <table className="min-w-full divide-y divide-neutral-700 text-left text-sm">
            <thead className="bg-neutral-900 text-gray-300">
              <tr>
                <th scope="col" className="px-4 py-3">Plan</th>
                <th scope="col" className="px-4 py-3">Catalog binding</th>
                <th scope="col" className="px-4 py-3">Price binding</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 bg-neutral-950">
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-white">{plan.id}</div>
                    <div className="text-xs text-gray-400">{cadence(plan)}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-gray-300">
                    <div>{plan.product.label}</div>
                    <div className="text-xs text-gray-500">{plan.product.id} / {plan.variant.id}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-gray-300">
                    <div>{plan.unitAmountMinor} {plan.price.currency} minor units</div>
                    <div className="text-xs text-gray-500">{plan.stripePriceId}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${plan.active ? "bg-green-950 text-green-300" : "bg-neutral-800 text-gray-300"}`}>
                      {plan.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={loading || loadingDetail || !!actionId}
                        onClick={async () => {
                          setLoadingDetail(true);
                          setError("");
                          setEditing(null);
                          try {
                            setEditing(await getAdminSubscriptionPlan(fetch, plan.id));
                            setCreating(false);
                          } catch (cause) {
                            setError(safeMessage(cause));
                          } finally {
                            setLoadingDetail(false);
                          }
                        }}
                        className="rounded border border-neutral-600 px-3 py-1.5 text-gray-200 hover:bg-neutral-800 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      {plan.active ? (
                        <button
                          type="button"
                          disabled={loading || loadingDetail || !!actionId}
                          onClick={async () => {
                            if (!window.confirm("Deactivate this plan? Existing subscriptions remain, but customers cannot start new ones.")) return;
                            setActionId(plan.id);
                            setError("");
                            try {
                              await updateAdminSubscriptionPlan(fetch, plan, { active: false });
                              refresh();
                            } catch (cause) {
                              setError(safeMessage(cause));
                            } finally {
                              setActionId("");
                            }
                          }}
                          className="rounded border border-red-800 px-3 py-1.5 text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                        >
                          {actionId === plan.id ? "Deactivating…" : "Deactivate"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>{total === 0 ? "0 plans" : `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}`}</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={offset === 0 || loading}
            onClick={() => {
              setPlans([]);
              setTotal(0);
              setLoading(true);
              setOffset((value) => Math.max(0, value - PAGE_SIZE));
            }}
            className="rounded border border-neutral-600 px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total || loading}
            onClick={() => {
              setPlans([]);
              setTotal(0);
              setLoading(true);
              setOffset((value) => value + PAGE_SIZE);
            }}
            className="rounded border border-neutral-600 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
