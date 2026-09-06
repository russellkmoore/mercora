'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchCustomerSubscriptions,
  formatSubscriptionDate,
  submitCustomerSubscriptionAction,
  subscriptionStatusLabel,
  type CustomerSubscriptionAction,
  type CustomerSubscriptionStatus,
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
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 text-sm text-foreground">{value}</dd></div>;
}

function statusToneClasses(status: CustomerSubscriptionStatus): string {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'border-success bg-success/10 text-success';
    case 'paused':
    case 'past_due':
      return 'border-warning bg-warning/10 text-warning';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'border-danger bg-danger/10 text-danger';
    default:
      return 'border-info bg-info/10 text-info';
  }
}

function lifecycleNotice(subscription: CustomerSubscriptionSummary): string | undefined {
  if (subscription.endedAt !== undefined) {
    return `Ended ${formatSubscriptionDate(subscription.endedAt) ?? 'on the recorded end date'}.`;
  }
  const notices: string[] = [];
  if (subscription.cancelAtPeriodEnd) {
    notices.push(`Cancellation is scheduled${subscription.currentPeriodEnd
      ? ` for ${formatSubscriptionDate(subscription.currentPeriodEnd)}`
      : ' for the end of the current period'}.`);
  } else if (subscription.cancelAt !== undefined) {
    notices.push(`Cancellation is scheduled for ${formatSubscriptionDate(subscription.cancelAt)}.`);
  }
  if (subscription.pauseCollection) {
    const resumes = formatSubscriptionDate(subscription.pauseCollection.resumesAt);
    notices.push(resumes ? `Collection is paused until ${resumes}.` : 'Collection is paused.');
  } else if (subscription.status === 'paused') {
    notices.push('Subscription lifecycle status is paused. Collection controls are unavailable while this status remains.');
  }
  return notices.length > 0 ? notices.join(' ') : undefined;
}

function canManage(subscription: CustomerSubscriptionSummary): boolean {
  return !['pending', 'provider_created', 'incomplete_expired', 'canceled'].includes(subscription.status)
    && subscription.endedAt === undefined;
}

export function subscriptionCollectionAction(
  subscription: CustomerSubscriptionSummary,
): Extract<CustomerSubscriptionAction, { type: 'pause' | 'resume' }> | undefined {
  if (!canManage(subscription)) return undefined;
  if (subscription.pauseCollection) return { type: 'resume' };
  if (subscription.status === 'paused') return undefined;
  return { type: 'pause' };
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
    return <div role="status" aria-live="polite" className="rounded-lg border border-border bg-surface-elevated p-6 text-sm text-muted-foreground">Loading subscriptions…</div>;
  }
  if (error) {
    return <div role="alert" className="rounded-lg border border-danger bg-danger/40 p-5"><p className="text-sm text-danger">{error}</p><button type="button" onClick={onRefresh} className="mt-4 rounded-md border border-danger px-3 py-2 text-sm text-danger hover:border-danger">Try again</button></div>;
  }
  if (subscriptions.length === 0) {
    return <div className="rounded-lg border border-border bg-surface-elevated p-6"><h2 className="font-semibold text-foreground">No subscriptions yet</h2><p className="mt-2 text-sm text-muted-foreground">Active and past subscriptions will appear here after provider confirmation.</p></div>;
  }

  return <div className="space-y-5">
    {subscriptions.map((subscription) => {
      const manageable = canManage(subscription);
      const collectionAction = subscriptionCollectionAction(subscription);
      const notice = lifecycleNotice(subscription);
      const isBusy = busyId === subscription.id;
      return <article key={subscription.id} aria-labelledby={`${subscription.id}-heading`} className="rounded-lg border border-border bg-surface-elevated p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0"><h2 id={`${subscription.id}-heading`} className="break-words text-lg font-semibold text-foreground">Plan {subscription.planId}</h2><p className="mt-1 break-all text-xs text-muted-foreground">Subscription {subscription.id}</p></div>
          <span className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${statusToneClasses(subscription.status)}`}>{subscriptionStatusLabel(subscription.status)}</span>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {detail('Quantity', subscription.quantity)}
          {detail('Period starts', formatSubscriptionDate(subscription.currentPeriodStart))}
          {detail('Period ends', formatSubscriptionDate(subscription.currentPeriodEnd))}
          {detail('Canceled', formatSubscriptionDate(subscription.canceledAt))}
        </dl>
        {notice && <p className="mt-5 rounded-md border border-warning/70 bg-warning/30 px-3 py-2 text-sm text-warning">{notice}</p>}
        {manageable && <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-4">
          {collectionAction?.type === 'resume' && <button type="button" disabled={busyId !== null} onClick={() => onAction(subscription, collectionAction)} className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:border-primary disabled:cursor-not-allowed disabled:opacity-50">{isBusy ? 'Requesting…' : 'Resume collection'}</button>}
          {collectionAction?.type === 'pause' && <button type="button" disabled={busyId !== null} onClick={() => onAction(subscription, collectionAction)} className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:border-primary disabled:cursor-not-allowed disabled:opacity-50">{isBusy ? 'Requesting…' : 'Pause collection'}</button>}
          {!subscription.cancelAtPeriodEnd && <button type="button" disabled={busyId !== null} onClick={() => onAction(subscription, { type: 'cancel', mode: 'period_end' })} className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:border-primary disabled:cursor-not-allowed disabled:opacity-50">Cancel at period end</button>}
          <button type="button" disabled={busyId !== null} onClick={() => onAction(subscription, { type: 'cancel', mode: 'immediate' })} className="rounded-md border border-danger px-3 py-2 text-sm text-danger hover:border-danger disabled:cursor-not-allowed disabled:opacity-50">Cancel immediately</button>
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-sm text-muted-foreground">Changes are confirmed by the payment provider before the status shown here updates.</p><button type="button" disabled={loading || busyId !== null} onClick={() => void refresh(true)} className="w-fit rounded-md border border-border px-3 py-2 text-sm text-foreground hover:border-primary disabled:cursor-not-allowed disabled:opacity-50">Refresh</button></div>
    {notice && <p role="status" aria-live="polite" className="rounded-md border border-success bg-success/30 px-4 py-3 text-sm text-success">{notice}</p>}
    <SubscriptionContent loading={loading} error={error} subscriptions={subscriptions} busyId={busyId} onAction={(subscription, action) => void act(subscription, action)} onRefresh={() => void refresh(true)} />
  </div>;
}
