import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: null as string | null,
}));

vi.mock('@/lib/store-config', () => ({
  getStoreConfig: () => ({
    commerce: { features: { subscriptionReconciliation: false } },
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: mocks.userId })),
}));
vi.mock('@/components/account/PaymentMethodList', () => ({
  PaymentMethodList: () => null,
}));

import { AccountNav, accountLinks } from '@/components/account/AccountNav';
import PaymentMethodsPage from '@/app/account/payment-methods/page';

beforeEach(() => {
  mocks.userId = null;
});

describe('account payment methods navigation entry (D-11)', () => {
  it('lists Payment methods unconditionally, with and without the subscription flag', () => {
    expect(accountLinks(false)).toContainEqual(['Payment methods', '/account/payment-methods']);
    expect(accountLinks(true)).toContainEqual(['Payment methods', '/account/payment-methods']);
  });

  it('renders the destination in the rendered account navigation', () => {
    expect(renderToStaticMarkup(React.createElement(AccountNav))).toContain('/account/payment-methods');
  });
});

describe('account payment methods page auth gate (D-10)', () => {
  it('redirects an anonymous visitor to sign-in without rendering the page', async () => {
    mocks.userId = null;
    await expect(PaymentMethodsPage()).rejects.toThrow(
      'REDIRECT:/sign-in?redirect_url=/account/payment-methods',
    );
  });

  it('renders the heading for a signed-in shopper', async () => {
    mocks.userId = 'user_test';
    const element = await PaymentMethodsPage();
    const markup = renderToStaticMarkup(element);
    expect(markup).toContain('Payment methods');
  });
});

describe('PaymentMethodList source contract (D-10)', () => {
  const source = readFileSync(
    join(process.cwd(), 'components/account/PaymentMethodList.tsx'),
    'utf8',
  );

  it('fetches the saved-card list from the account payment-methods route', () => {
    expect(source).toContain('/api/account/payment-methods');
  });

  it('removes a card via DELETE with same-origin credentials', () => {
    expect(source).toContain('method: "DELETE"');
    expect(source).toContain('credentials: "same-origin"');
  });

  it('guards removal behind a native confirmation', () => {
    expect(source).toContain('confirm(');
  });

  it('has no add-a-card form — read/remove scope only (D-10)', () => {
    expect(source).not.toContain('<form');
  });
});
