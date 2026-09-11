import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { StripeElementsOptions } from '@stripe/stripe-js';
import { getThemeTokens } from '@/lib/themes/tokens';

const mocks = vi.hoisted(() => ({
  capturedOptions: undefined as StripeElementsOptions | undefined,
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ options, children }: { options: StripeElementsOptions; children: React.ReactNode }) => {
    mocks.capturedOptions = options;
    return React.createElement('div', null, children);
  },
}));

vi.mock('@/lib/stripe', () => ({
  loadStripe: () => Promise.resolve(null),
}));

vi.mock('@/lib/store', () => ({
  useThemeTokens: () => getThemeTokens(),
}));

import StripeProvider from '@/components/checkout/StripeProvider';

describe('StripeProvider Customer Session forwarding (D-06, D-07)', () => {
  it('forwards customerSessionClientSecret into Elements options when supplied', () => {
    renderToStaticMarkup(
      React.createElement(StripeProvider, {
        clientSecret: 'pi_123_secret_abc',
        customerSessionClientSecret: 'cuss_secret_xyz',
        children: React.createElement('div', null, 'child'),
      })
    );

    const options = mocks.capturedOptions;
    expect(options).toBeDefined();
    expect(options?.clientSecret).toBe('pi_123_secret_abc');
    expect((options as { customerSessionClientSecret?: string })?.customerSessionClientSecret).toBe(
      'cuss_secret_xyz'
    );
    expect(options?.appearance).toEqual({
      theme: 'stripe',
      variables: expect.objectContaining({
        colorPrimary: getThemeTokens().primary,
        colorBackground: getThemeTokens().surfaceInverse,
        colorText: getThemeTokens().onInverse,
        colorDanger: getThemeTokens().danger,
        fontFamily: getThemeTokens().fontSans,
        spacingUnit: '4px',
        borderRadius: '8px',
      }),
      rules: expect.any(Object),
    });
  });

  it('omits customerSessionClientSecret from Elements options when not supplied', () => {
    renderToStaticMarkup(
      React.createElement(StripeProvider, {
        clientSecret: 'pi_123_secret_abc',
        children: React.createElement('div', null, 'child'),
      })
    );

    const options = mocks.capturedOptions;
    expect(options).toBeDefined();
    expect(options?.clientSecret).toBe('pi_123_secret_abc');
    expect('customerSessionClientSecret' in (options as object)).toBe(false);
    expect(options?.appearance).toEqual({
      theme: 'stripe',
      variables: expect.objectContaining({
        colorPrimary: getThemeTokens().primary,
        colorBackground: getThemeTokens().surfaceInverse,
        colorText: getThemeTokens().onInverse,
        colorDanger: getThemeTokens().danger,
        fontFamily: getThemeTokens().fontSans,
        spacingUnit: '4px',
        borderRadius: '8px',
      }),
      rules: expect.any(Object),
    });
  });
});
