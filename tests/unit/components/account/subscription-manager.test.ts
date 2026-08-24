import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  SubscriptionContent,
  subscriptionCollectionAction,
} from '@/components/account/SubscriptionManager';
import {
  fetchCustomerSubscriptions,
  submitCustomerSubscriptionAction,
  type CustomerSubscriptionAction,
  type CustomerSubscriptionSummary,
  type SubscriptionFetch,
} from '@/components/account/subscription-dashboard';

const subscription: CustomerSubscriptionSummary = {
  id: 'subscription_acq_safe',
  planId: 'plan-monthly-tea',
  quantity: 2,
  status: 'active',
  currentPeriodStart: 1_786_147_200,
  currentPeriodEnd: 1_788_825_600,
  cancelAtPeriodEnd: false,
};

const noop = () => undefined;

function content(props: Partial<Parameters<typeof SubscriptionContent>[0]> = {}) {
  return renderToStaticMarkup(React.createElement(SubscriptionContent, {
    loading: false,
    error: '',
    subscriptions: [],
    busyId: null,
    onAction: noop,
    onRefresh: noop,
    ...props,
  }));
}

function jsonResponse(value: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(value), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

describe('customer subscription dashboard states', () => {
  it('renders accessible loading, error, empty, and list states', () => {
    const loading = content({ loading: true });
    expect(loading).toContain('role="status"');
    expect(loading).toContain('Loading subscriptions');

    const error = content({ error: 'Subscriptions are temporarily unavailable' });
    expect(error).toContain('role="alert"');
    expect(error).toContain('Try again');

    const empty = content();
    expect(empty).toContain('No subscriptions yet');

    const list = content({ subscriptions: [subscription] });
    expect(list).toContain('Plan plan-monthly-tea');
    expect(list).toContain('Quantity');
    expect(list).toContain('Active');
    expect(list).toContain('Pause collection');
    expect(list).toContain('Cancel at period end');
    expect(list).toContain('Cancel immediately');
    expect(list).not.toContain('cus_');
    expect(list).not.toContain('sub_');
    expect(list).not.toContain('price_');
  });

  it('renders pause, cancellation, and terminal lifecycle notices without false controls', () => {
    const paused = content({
      subscriptions: [{
        ...subscription,
        pauseCollection: { behavior: 'void', resumesAt: 1_788_825_600 },
      }],
    });
    expect(paused).toContain('Collection is paused until');
    expect(paused).toContain('Resume collection');

    const scheduled = content({
      subscriptions: [{ ...subscription, cancelAtPeriodEnd: true }],
    });
    expect(scheduled).toContain('Cancellation is scheduled');
    expect(scheduled).not.toContain('Cancel at period end</button>');

    const canceled = content({
      subscriptions: [{ ...subscription, status: 'canceled', endedAt: 1_788_825_600 }],
    });
    expect(canceled).toContain('Ended');
    expect(canceled).not.toContain('Pause collection');
    expect(canceled).not.toContain('Cancel immediately');
  });

  it('keeps lifecycle pause distinct from collection pause in notices and controls', () => {
    const lifecyclePaused = { ...subscription, status: 'paused' as const };
    const paused = content({ subscriptions: [lifecyclePaused] });
    expect(paused).toContain('Subscription lifecycle status is paused');
    expect(paused).toContain('Collection controls are unavailable');
    expect(paused).not.toContain('Collection is paused');
    expect(paused).not.toContain('Resume collection');
    expect(paused).not.toContain('Pause collection');
    expect(paused).toContain('Cancel at period end');
    expect(paused).toContain('Cancel immediately');

    const lifecyclePausedAndCanceling = content({
      subscriptions: [{ ...lifecyclePaused, cancelAtPeriodEnd: true }],
    });
    expect(lifecyclePausedAndCanceling).toContain('Subscription lifecycle status is paused');
    expect(lifecyclePausedAndCanceling).toContain('Cancellation is scheduled');
  });

  it('derives collection action eligibility only from durable pauseCollection state', () => {
    expect(subscriptionCollectionAction(subscription)).toEqual({ type: 'pause' });
    expect(subscriptionCollectionAction({ ...subscription, status: 'paused' })).toBeUndefined();
    expect(subscriptionCollectionAction({
      ...subscription,
      status: 'active',
      pauseCollection: { behavior: 'void' },
    })).toEqual({ type: 'resume' });
    expect(subscriptionCollectionAction({
      ...subscription,
      status: 'paused',
      pauseCollection: { behavior: 'void' },
    })).toEqual({ type: 'resume' });
  });
});

describe('customer subscription dashboard transport', () => {
  it('loads only bounded safe summaries through a same-origin no-store request', async () => {
    const fetcher = vi.fn<SubscriptionFetch>(async () => jsonResponse({
      subscriptions: [{
        ...subscription,
        stripeSubscriptionId: 'sub_provider_secret',
        stripeCustomerId: 'cus_provider_secret',
      }],
    }));
    await expect(fetchCustomerSubscriptions(fetcher)).resolves.toEqual([subscription]);
    expect(fetcher).toHaveBeenCalledWith('/api/subscriptions', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
  });

  it('rejects malformed, oversized, or unbounded list responses', async () => {
    await expect(fetchCustomerSubscriptions(vi.fn(async () => jsonResponse({
      subscriptions: [{ ...subscription, quantity: 0 }],
    })))).rejects.toThrow('invalid data');
    await expect(fetchCustomerSubscriptions(vi.fn(async () => new Response('{', {
      status: 200,
    })))).rejects.toThrow('invalid response');
    await expect(fetchCustomerSubscriptions(vi.fn(async () => jsonResponse({}, {
      headers: { 'content-length': String(65 * 1024) },
    })))).rejects.toThrow('too large');
  });

  it('cancels an actually oversized streamed response before reading its remaining bytes', async () => {
    const cancel = vi.fn();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(40 * 1024).fill(0x20));
      },
      cancel,
    });
    const fetcher = vi.fn<SubscriptionFetch>(async () => new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(fetchCustomerSubscriptions(fetcher)).rejects.toThrow('too large');
    expect(cancel).toHaveBeenCalledOnce();
    expect(pulls).toBeLessThanOrEqual(3);
  });

  it('rejects invalid streamed UTF-8 with the bounded public response error', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([0x7b, 0x22, 0xc3, 0x28]));
      },
      cancel,
    });
    const fetcher = vi.fn<SubscriptionFetch>(async () => new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(fetchCustomerSubscriptions(fetcher))
      .rejects.toThrow('Subscription service returned an invalid response');
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each(['abc', '-1'])('rejects malformed Content-Length %s before reading the body', async (length) => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"subscriptions":[]}'));
      },
      cancel,
    });
    const fetcher = vi.fn<SubscriptionFetch>(async () => new Response(body, {
      status: 200,
      headers: { 'content-length': length },
    }));

    await expect(fetchCustomerSubscriptions(fetcher))
      .rejects.toThrow('Subscription service returned an invalid response');
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([
    [{ type: 'pause' } as CustomerSubscriptionAction, '/pause', {}],
    [{ type: 'resume' } as CustomerSubscriptionAction, '/resume', {}],
    [{ type: 'cancel', mode: 'period_end' } as CustomerSubscriptionAction, '/cancel', { mode: 'period_end' }],
    [{ type: 'cancel', mode: 'immediate' } as CustomerSubscriptionAction, '/cancel', { mode: 'immediate' }],
  ])('posts %o to the exact owner-scoped action and refreshes only after accepted reconciliation', async (action, suffix, expectedBody) => {
    const order: string[] = [];
    const fetcher = vi.fn<SubscriptionFetch>(async (_url, init) => {
      order.push('action');
      expect(init).toMatchObject({
        method: 'POST',
        credentials: 'same-origin',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
      });
      expect(JSON.parse(String(init?.body))).toEqual(expectedBody);
      return jsonResponse({
        subscription,
        reconciliationPending: true,
      }, { status: 202 });
    });
    const refresh = vi.fn(async () => { order.push('refresh'); });

    await submitCustomerSubscriptionAction({
      id: subscription.id,
      action,
      fetcher,
      refresh,
    });

    expect(fetcher).toHaveBeenCalledWith(
      `/api/subscriptions/${subscription.id}${suffix}`,
      expect.any(Object),
    );
    expect(order).toEqual(['action', 'refresh']);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('does not refresh or claim final state for rejected and malformed action responses', async () => {
    const refresh = vi.fn(async () => undefined);
    await expect(submitCustomerSubscriptionAction({
      id: subscription.id,
      action: { type: 'pause' },
      refresh,
      fetcher: vi.fn(async () => jsonResponse({ error: 'Change unavailable' }, { status: 503 })),
    })).rejects.toThrow('Change unavailable');
    await expect(submitCustomerSubscriptionAction({
      id: subscription.id,
      action: { type: 'pause' },
      refresh,
      fetcher: vi.fn(async () => jsonResponse({ subscription }, { status: 202 })),
    })).rejects.toThrow('invalid action response');
    expect(refresh).not.toHaveBeenCalled();
  });
});
