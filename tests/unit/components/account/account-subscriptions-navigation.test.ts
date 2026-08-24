import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enabled: false,
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));

vi.mock('@/lib/store-config', () => ({
  getStoreConfig: () => ({
    commerce: { features: { subscriptionReconciliation: mocks.enabled } },
  }),
}));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));

import { AccountNav, accountLinks } from '@/components/account/AccountNav';
import AccountSubscriptionsPage from '@/app/account/subscriptions/page';

beforeEach(() => {
  mocks.enabled = false;
});

describe('account subscription feature gate', () => {
  it('omits the navigation destination and rejects the page while reconciliation is off', () => {
    expect(accountLinks(false)).not.toContainEqual(['Subscriptions', '/account/subscriptions']);
    expect(renderToStaticMarkup(React.createElement(AccountNav))).not.toContain('/account/subscriptions');
    expect(() => AccountSubscriptionsPage()).toThrow('NEXT_NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it('shows the navigation destination and page while reconciliation is enabled', () => {
    mocks.enabled = true;
    expect(accountLinks(true)).toContainEqual(['Subscriptions', '/account/subscriptions']);
    expect(renderToStaticMarkup(React.createElement(AccountNav))).toContain('/account/subscriptions');
    const page = renderToStaticMarkup(AccountSubscriptionsPage());
    expect(page).toContain('Subscriptions');
    expect(page).toContain('payment provider');
  });
});
