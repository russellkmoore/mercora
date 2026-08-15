'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchCustomerSubscriptions,
  formatSubscriptionDate,
  submitCustomerSubscriptionAction,
  subscriptionStatusLabel,
  type CustomerSubscriptionAction,
  type CustomerSubscriptionSummary,
} from './subscription-dashboard';

interface SubscriptionContentProps {
  loading: boolean;
  error: string;
  subscriptions: CustomerSubscriptionSummary[];
  busyId: string | null;
  onAction: (subscription: CustomerSubscriptionSummary, action: CustomerSubscriptionAction) => void;
  onRefresh: () => void;
}

function detail(label: string, value: string | number | undefined) {
  if (value === undefined) return null;
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-1 text-sm text-gray-200">{value}</dd></div>;
}

function lifecycleNotice(subscription: CustomerSubscriptionSummary): string | undefined {
  if (subscription.endedAt !== undefined) {
    return `Ended ${formatSubscriptionDate(subscription.endedAt) ?? 'on the recorded end date'}.`;
  }
  if (subscription.cancelAtPeriodEnd) {
    return `Cancellation is scheduled${subscription.currentPeriodEnd
      ? ` for ${formatSubscriptionDate(subscription.currentPeriodEnd)}`
      : ' for the end of the current period'}.`;
  }
  if (subscription.cancelAt !== undefined) {
    return `Cancellation is scheduled for ${formatSubscriptionDate(subscription.cancelAt)}.`;
  }
  if (subscription.pauseCollection || subscription.status === 'paused') {
    const resumes = formatSubscriptionDate(subscription.pauseCollection?.resumesAt);
    return resumes ? `Collection is paused until ${resumes}.` : 'Collection is paused.';
  }
  return undefined;
}

function canManage(subscription: CustomerSubscriptionSummary): boolean {
  return !['pending', 'provider_created', 'incomplete_expired', 'canceled'].includes(subscription.status)
    && subscription.endedAt === undefined;
}

export function SubscriptionContent({
  loading,
  error,
  subscriptions,
  busyId,
  onAction,
  onRefresh,
}: SubscriptionContentProps) {
  if (loading) {
    return <div role="status" aria-live="polite" className="rounded-lg border border-neutral-700 bg-neutral-900 p-6 text-sm text-gray-300">Loading subscriptions…</div>;
  }
  if (error) {
    return <div role="alert" className="rounded-lg border border-red-900 bg-red-950/40 p-5"><p className="text-sm text-red-200">{error}</p><button type="button" onClick={onRefresh} className="mt-4 rounded-md border border-red-700 px-3 py-2 text-sm text-red-100 hover:border-red-500">Try again</button></div>;
  }
  if (subscriptions.length === 0) {
    return <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-6"><h2 className="font-semibold text-white">No subscriptions yet</h2><p className="mt-2 text-sm text-gray-400">Active and past subscriptions will appear here after provider confirmation.</p></div>;
  }

  return <div className="space-y-5">
    {subscriptions.map((subscription) => {
      const paused = subscription.status === 'paused' || subscription.pauseCollection !== undefined;
      const manageable = canManage(subscription);
      const notice = lifecycleNotice(subscription);
      const isBusy = busyId === subscription.id;
      return <article key={subscription.id} aria-labelledby={`${subscription.id}-heading`} className="rounded-lg border border-neutral-700 bg-neutral-900 p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0"><h2 id={`${subscription.id}-heading`} className="break-words text-lg font-semibold text-white">Plan {subscription.planId}</h2><p className="mt-1 break-all text-xs text-gray-500">Subscription {subscription.id}</p></div>
          <span className="w-fit rounded-full border border-neutral-600 bg-neutral-950 px-3 py-1 text-xs font-medium text-gray-200">{subscriptionStatusLabel(subscription.status)}</span>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {detail('Quantity', subscription.quantity)}
          {detail('Period starts', formatSubscriptionDate(subscription.currentPeriodStart))}
          {detail('Period ends', formatSubscriptionDate(subscription.currentPeriodEnd))}
          {detail('Canceled', formatSubscriptionDate(subscription.canceledAt))}
        </dl>
        {notice && <p className="mt-5 rounded-md border border-amber-900/70 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">{notice}</p>}
        {manageable && <div className="mt-5 flex flex-wrap gap-3 border-t border-neutral-800 pt-4">
          {paused
            ? <button type="button" disabled={busyId !== null} onClick={() => onAction(subscription, { type: 'resume' })} className="rounded-md border border-neutral-600 px-3 py-2 text-sm text-gray-100 hover:border-orange-500 disabled:cursor-not-allowed disabled:opacity-50">{isBusy ? 'Requesting…' : 'Resume collection'}</button>
            : <button type="button" disabled={busyId !== null} onClick={() => onAction(subscription, { type: 'pause' })} className="rounded-md border border-neutral-600 px-3 py-2 text-sm text-gray-100 hover:border-orange-500 disabled:cursor-not-allowed disabled:opacity-50">{isBusy ? 'Requesting…' : 'Pause collection'}</button>}
          {!subscription.cancelAtPeriodEnd && <button type="button" disabled={busyId !== null} onClick={() => onAction(subscription, { type: 'cancel', mode: 'period_end' })} className="rounded-md border border-neutral-600 px-3 py-2 text-sm text-gray-100 hover:border-orange-500 disabled:cursor-not-allowed disabled:opacity-50">Cancel at period end</button>}
          <button type="button" disabled={busyId !== null} onClick={() => onAction(subscription, { type: 'cancel', mode: 'immediate' })} className="rounded-md border border-red-900 px-3 py-2 text-sm text-red-300 hover:border-red-600 disabled:cursor-not-allowed disabled:opacity-50">Cancel immediately</button>
        </div>}
      </article>;
    })}
  </div>;
}

export function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState<CustomerSubscriptionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      setSubscriptions(await fetchCustomerSubscriptions());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Subscriptions could not be loaded');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchCustomerSubscriptions()
      .then((loaded) => {
        if (active) setSubscriptions(loaded);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Subscriptions could not be loaded');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function act(subscription: CustomerSubscriptionSummary, action: CustomerSubscriptionAction) {
    if (action.type === 'cancel' && action.mode === 'immediate'
      && !window.confirm('Cancel this subscription immediately? This can end access before the current period finishes.')) {
      return;
    }
    setBusyId(subscription.id);
    setError('');
    setNotice('');
    try {
      await submitCustomerSubscriptionAction({
        id: subscription.id,
        action,
        refresh: () => refresh(false),
      });
      setNotice('Change accepted. Provider confirmation is pending; the subscription list has been refreshed.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Subscription change could not be requested');
    } finally {
      setBusyId(null);
    }
  }

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-sm text-gray-400">Changes are confirmed by the payment provider before the status shown here updates.</p><button type="button" disabled={loading || busyId !== null} onClick={() => void refresh(true)} className="w-fit rounded-md border border-neutral-700 px-3 py-2 text-sm text-gray-200 hover:border-orange-500 disabled:cursor-not-allowed disabled:opacity-50">Refresh</button></div>
    {notice && <p role="status" aria-live="polite" className="rounded-md border border-emerald-900 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">{notice}</p>}
    <SubscriptionContent loading={loading} error={error} subscriptions={subscriptions} busyId={busyId} onAction={(subscription, action) => void act(subscription, action)} onRefresh={() => void refresh(true)} />
  </div>;
}
