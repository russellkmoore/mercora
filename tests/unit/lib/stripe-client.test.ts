import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const httpClient = { kind: 'fetch' };
  const cryptoProvider = { kind: 'subtle' };
  return {
    constructor: vi.fn(),
    createFetchHttpClient: vi.fn(() => httpClient),
    createSubtleCryptoProvider: vi.fn(() => cryptoProvider),
    paymentIntentsCreate: vi.fn(),
    paymentIntentsRetrieve: vi.fn(),
    paymentIntentsCancel: vi.fn(),
    taxCalculationCreate: vi.fn(),
    constructEventAsync: vi.fn(),
    httpClient,
    cryptoProvider,
  };
});

vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn() }));

vi.mock('stripe', () => {
  class StripeMock {
    static createFetchHttpClient = mocks.createFetchHttpClient;
    static createSubtleCryptoProvider = mocks.createSubtleCryptoProvider;

    paymentIntents = {
      create: mocks.paymentIntentsCreate,
      retrieve: mocks.paymentIntentsRetrieve,
      cancel: mocks.paymentIntentsCancel,
    };

    tax = { calculations: { create: mocks.taxCalculationCreate } };
    webhooks = { constructEventAsync: mocks.constructEventAsync };

    constructor(apiKey: string, options: unknown) {
      mocks.constructor(apiKey, options);
    }
  }

  return { default: StripeMock };
});

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_placeholder');
  vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_placeholder');
});

describe('Workers-safe Stripe client', () => {
  it('memoizes one SDK client configured with fetch HTTP', async () => {
    const { getStripe, getStripeClient } = await import('@/lib/stripe');

    expect(getStripe()).toBe(getStripe());
    expect(getStripeClient()).toBe(getStripe());
    expect(mocks.constructor).toHaveBeenCalledOnce();
    expect(mocks.constructor).toHaveBeenCalledWith('sk_test_placeholder', {
      apiVersion: '2026-07-29.dahlia',
      typescript: true,
      httpClient: mocks.httpClient,
    });
    expect(mocks.createFetchHttpClient).toHaveBeenCalledOnce();
  });

  it('routes payment and tax helpers through the SDK client', async () => {
    mocks.paymentIntentsCreate.mockResolvedValue({ id: 'pi_create' });
    mocks.paymentIntentsRetrieve.mockResolvedValue({ id: 'pi_retrieve' });
    mocks.paymentIntentsCancel.mockResolvedValue({ id: 'pi_cancel' });
    mocks.taxCalculationCreate.mockResolvedValue({ id: 'taxcalc_1' });
    const {
      calculateTax,
      cancelPaymentIntent,
      createPaymentIntent,
      retrievePaymentIntent,
    } = await import('@/lib/stripe');

    await expect(createPaymentIntent({ amount: 100, currency: 'usd' }))
      .resolves.toEqual({ id: 'pi_create' });
    await expect(retrievePaymentIntent('pi_retrieve')).resolves.toEqual({ id: 'pi_retrieve' });
    await expect(cancelPaymentIntent('pi_cancel')).resolves.toBeUndefined();
    await expect(calculateTax({
      currency: 'usd',
      customer_details: {
        address: { country: 'US' },
        address_source: 'shipping',
      },
      line_items: [{ amount: 100, reference: 'line:1' }],
    })).resolves.toEqual({ id: 'taxcalc_1' });

    expect(mocks.paymentIntentsCreate).toHaveBeenCalledWith({ amount: 100, currency: 'usd' });
    expect(mocks.paymentIntentsRetrieve).toHaveBeenCalledWith('pi_retrieve');
    expect(mocks.paymentIntentsCancel).toHaveBeenCalledWith('pi_cancel');
    expect(mocks.taxCalculationCreate).toHaveBeenCalledOnce();
  });

  it('verifies webhook signatures asynchronously with SubtleCrypto', async () => {
    const event = { id: 'evt_1', type: 'payment_intent.succeeded' };
    mocks.constructEventAsync.mockResolvedValue(event);
    const { constructWebhookEvent } = await import('@/lib/stripe');

    await expect(constructWebhookEvent('{}', 'signed', 'whsec_test')).resolves.toBe(event);
    expect(mocks.constructEventAsync).toHaveBeenCalledWith(
      '{}',
      'signed',
      'whsec_test',
      undefined,
      mocks.cryptoProvider
    );
  });
});
