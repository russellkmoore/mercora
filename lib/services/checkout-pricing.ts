import { Money, type StoredMoney } from '@/lib/money';
import { getProduct, getProductVariant } from '@/lib/models/mach/products';
import { validateCouponCode } from '@/lib/models/mach/couponInstance';
import { checkTimeValidity, getPromotionById } from '@/lib/models/mach/promotions';
import { getSettings } from '@/lib/utils/settings';
import { calculateTax } from '@/lib/stripe';
import {
  noOpCommerceCapabilities,
  type CommerceCapabilities,
} from '@/lib/commerce/capabilities';
import type { Address, OrderItem, Promotion } from '@/lib/types';
import {
  allowedShippingCountries,
  enabledShippingMethods,
} from '@/lib/shipping/allowed-countries';

export const MAX_CHECKOUT_LINES = 100;
export const MAX_DISCOUNT_CODES = 25;

export interface CheckoutLineInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface CheckoutPricingInput {
  items: CheckoutLineInput[];
  shippingAddress: Address;
  shippingMethodId: string;
  discountCodes?: string[];
  giftCardToken?: string;
  customerId?: string;
}

export interface CheckoutQuote {
  currency: string;
  items: OrderItem[];
  subtotal: StoredMoney;
  discount: StoredMoney;
  merchandiseDiscount: StoredMoney;
  shippingDiscount: StoredMoney;
  shipping: StoredMoney;
  tax: StoredMoney;
  tender: StoredMoney;
  total: StoredMoney;
  discountCodes: string[];
  shippingMethod: { id: string; label: string };
  taxSource: 'provider' | 'configured_fallback';
  /** Opaque server-only state passed back to the tender capability at finalization. */
  tenderState?: unknown;
}

interface PricingDependencies {
  getProduct: typeof getProduct;
  getProductVariant: typeof getProductVariant;
  validateCouponCode: typeof validateCouponCode;
  getPromotionById: typeof getPromotionById;
  getSettings: typeof getSettings;
  calculateTax: typeof calculateTax;
}

const defaultDependencies: PricingDependencies = {
  getProduct,
  getProductVariant,
  validateCouponCode,
  getPromotionById,
  getSettings,
  calculateTax,
};

function localized(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const entries = value as Record<string, unknown>;
    const candidate = entries.en ?? Object.values(entries)[0];
    if (typeof candidate === 'string') return candidate;
  }
  throw new Error('Catalog product has no display name');
}

function normalizeCodes(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_DISCOUNT_CODES) {
    if (Array.isArray(value) && value.length > MAX_DISCOUNT_CODES) {
      throw new Error(`No more than ${MAX_DISCOUNT_CODES} discount codes are allowed`);
    }
    return [];
  }
  return [...new Set(value.map((code) => {
    if (typeof code !== 'string' || !code.trim() || code.length > 128) {
      throw new Error('Discount codes must be non-empty strings of at most 128 characters');
    }
    return code.trim().toUpperCase();
  }))];
}

function moneyValue(value: unknown, currency: string): Money {
  return Money.fromStored(value, currency);
}

function optionValues(value: unknown): Array<{ option_id: string; value: string }> {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((entry): entry is { option_id: string; value: string } =>
    !!entry &&
    typeof entry === 'object' &&
    typeof (entry as { option_id?: unknown }).option_id === 'string' &&
    typeof (entry as { value?: unknown }).value === 'string'
  );
}

type PricedCatalogLine = {
  product: Awaited<ReturnType<typeof getProduct>> & {};
  lineTotal: Money;
};

interface EligibilityContext {
  customerId?: string;
  region?: string;
  country: string;
}

function eligibilityMatches(promotion: Promotion, context: EligibilityContext): boolean {
  const eligibility = promotion.eligibility;
  if (!eligibility) return true;
  if (eligibility.channels?.length && !eligibility.channels.includes('web')) return false;
  if (
    eligibility.regions?.length &&
    !eligibility.regions.includes(context.region ?? '') &&
    !eligibility.regions.includes(context.country)
  ) return false;
  if (
    eligibility.exclude_regions?.includes(context.region ?? '') ||
    eligibility.exclude_regions?.includes(context.country)
  ) return false;
  if (eligibility.payment_methods?.length && !eligibility.payment_methods.includes('stripe')) {
    return false;
  }
  if (eligibility.requires_account && !context.customerId) return false;
  if (
    eligibility.customer_segments?.length ||
    eligibility.customer_types?.some((type) => type !== 'all')
  ) {
    // Core checkout has no authoritative segment/customer-type resolver.
    return false;
  }
  return true;
}

function eligibleLineIndexes(
  promotion: Promotion,
  subtotal: Money,
  catalog: PricedCatalogLine[],
  context: EligibilityContext
): number[] | null {
  if (!eligibilityMatches(promotion, context)) return null;
  let eligible = catalog.map((_, index) => index);
  for (const condition of promotion.rules.conditions ?? []) {
    if (condition.type === 'cart_minimum' || condition.type === 'cart_subtotal') {
      if (condition.operator !== 'gte') return null;
      const amount = typeof condition.value === 'object'
        ? (condition.value as { amount?: unknown }).amount
        : condition.value;
      let minimum: Money;
      try {
        minimum = moneyValue(amount ?? 0, subtotal.currency);
      } catch {
        return null;
      }
      if (subtotal.lt(minimum)) return null;
      continue;
    }
    if (condition.type === 'product_category' && condition.operator === 'in') {
      const required = Array.isArray(condition.value) ? condition.value : [condition.value];
      eligible = eligible.filter((index) =>
        (catalog[index].product.categories ?? []).some((category) => required.includes(category))
      );
      if (eligible.length === 0) return null;
      continue;
    }
    // Never credit a promotion whose condition core checkout cannot prove.
    return null;
  }
  return eligible;
}

function actionDiscount(promotion: Promotion, target: Money): Money {
  const action = promotion.rules.actions?.[0];
  if (!action) return Money.zero(target.currency);
  switch (action.type) {
    case 'percentage_discount':
    case 'item_percentage_discount':
    case 'shipping_percentage_discount': {
      const percentage = Number(action.value);
      if (!Number.isFinite(percentage) || percentage <= 0) return Money.zero(target.currency);
      return target.applyRate(Math.min(100, percentage) / 100);
    }
    case 'fixed_discount':
    case 'item_fixed_discount':
    case 'shipping_fixed_discount': {
      try {
        const fixed = moneyValue(
          typeof action.value === 'object'
            ? (action.value as { amount?: unknown }).amount ?? 0
            : action.value ?? 0,
          target.currency
        );
        return fixed.lte(target) ? fixed : target;
      } catch {
        return Money.zero(target.currency);
      }
    }
    default:
      return Money.zero(target.currency);
  }
}

function allocateDiscount(
  amount: Money,
  eligible: number[],
  lineTotals: Money[],
  existing: Money[]
): void {
  const available = eligible.map((index) => lineTotals[index].subtract(existing[index]));
  const availableTotal = available.reduce(
    (sum, value) => sum.add(value),
    Money.zero(amount.currency)
  );
  const applied = amount.lte(availableTotal) ? amount : availableTotal;
  if (applied.isZero() || availableTotal.isZero()) return;

  let remaining = applied.toMinorUnits();
  eligible.forEach((index, position) => {
    const cents = position === eligible.length - 1
      ? remaining
      : Math.min(
          available[position].toMinorUnits(),
          Math.floor(
            applied.toMinorUnits() * available[position].toMinorUnits() /
            availableTotal.toMinorUnits()
          )
        );
    existing[index] = existing[index].add(Money.fromMinor(cents, amount.currency));
    remaining -= cents;
  });
}

async function resolveDiscounts(
  codes: string[],
  subtotal: Money,
  shipping: Money,
  catalog: PricedCatalogLine[],
  context: EligibilityContext,
  deps: PricingDependencies
): Promise<{ merchandise: Money; shipping: Money; perLine: Money[]; appliedCodes: string[] }> {
  const promotionIds = new Set<string>();
  const candidates: Array<{ code: string; promotion: Promotion; eligible: number[] }> = [];
  for (const code of codes) {
    const validation = await deps.validateCouponCode(code, context.customerId);
    const coupon = validation.coupon;
    if (
      !coupon ||
      !validation.canBeUsed ||
      (coupon.assigned_to && coupon.assigned_to !== context.customerId) ||
      promotionIds.has(coupon.promotion_id)
    ) {
      continue;
    }
    const promotion = await deps.getPromotionById(coupon.promotion_id);
    const eligible = promotion ? eligibleLineIndexes(promotion, subtotal, catalog, context) : null;
    if (
      !promotion ||
      promotion.status !== 'active' ||
      !checkTimeValidity(promotion) ||
      !eligible
    ) {
      continue;
    }
    promotionIds.add(promotion.id);
    candidates.push({ code, promotion, eligible });
  }

  candidates.sort((a, b) => (b.promotion.priority ?? 0) - (a.promotion.priority ?? 0));
  // A non-stackable candidate makes the selection exclusive independent of the
  // request's code ordering. The highest-priority valid promotion wins.
  const selected = candidates.some(({ promotion }) => !promotion.stackable)
    ? candidates.slice(0, 1)
    : candidates;

  const perLine = catalog.map(() => Money.zero(subtotal.currency));
  let shippingDiscount = Money.zero(subtotal.currency);
  const appliedCodes: string[] = [];
  for (const { code, promotion, eligible } of selected) {
    if (promotion.type === 'shipping') {
      const remaining = shipping.subtract(shippingDiscount);
      const applied = actionDiscount(promotion, remaining);
      if (!applied.isZero()) {
        shippingDiscount = shippingDiscount.add(applied);
        appliedCodes.push(code);
      }
      continue;
    }
    const currentEligibleTotal = eligible.reduce(
      (sum, index) => sum.add(catalog[index].lineTotal.subtract(perLine[index])),
      Money.zero(subtotal.currency)
    );
    const before = perLine.reduce((sum, amount) => sum.add(amount), Money.zero(subtotal.currency));
    allocateDiscount(
      actionDiscount(promotion, currentEligibleTotal),
      eligible,
      catalog.map(({ lineTotal }) => lineTotal),
      perLine
    );
    const after = perLine.reduce((sum, amount) => sum.add(amount), Money.zero(subtotal.currency));
    if (after.gt(before)) appliedCodes.push(code);
  }

  const merchandise = perLine.reduce(
    (sum, amount) => sum.add(amount),
    Money.zero(subtotal.currency)
  );
  return {
    merchandise,
    shipping: shippingDiscount,
    perLine,
    appliedCodes,
  };
}

function configuredRate(value: unknown): number | null {
  const percentage = Number(value);
  return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100
    ? percentage / 100
    : null;
}

export async function priceCheckout(
  input: CheckoutPricingInput,
  options: {
    dependencies?: Partial<PricingDependencies>;
    capabilities?: CommerceCapabilities;
  } = {}
): Promise<CheckoutQuote> {
  const deps = { ...defaultDependencies, ...options.dependencies };
  const capabilities = options.capabilities ?? noOpCommerceCapabilities;
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > MAX_CHECKOUT_LINES) {
    throw new Error(`Checkout requires between 1 and ${MAX_CHECKOUT_LINES} line items`);
  }

  const catalog = await Promise.all(input.items.map(async (line, index) => {
    if (
      !line ||
      typeof line.productId !== 'string' ||
      !line.productId ||
      line.productId.length > 128 ||
      (line.variantId !== undefined && (
        typeof line.variantId !== 'string' || !line.variantId || line.variantId.length > 128
      )) ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity <= 0 ||
      line.quantity > 1_000
    ) {
      throw new Error(`Checkout line ${index} is invalid`);
    }
    const product = await deps.getProduct(line.productId);
    if (!product || product.status !== 'active') {
      throw new Error(`Product ${line.productId} is not available`);
    }
    const variantId = line.variantId || product.default_variant_id || product.variants?.[0]?.id;
    if (!variantId) throw new Error(`Product ${line.productId} has no sellable variant`);
    const variant = await deps.getProductVariant(variantId);
    if (!variant || variant.status !== 'active' || variant.product_id !== product.id) {
      throw new Error(`Variant ${variantId} is not available for product ${line.productId}`);
    }
    const unitPrice = Money.fromStored(variant.price);
    if (unitPrice.isNegative()) throw new Error(`Variant ${variantId} has an invalid catalog price`);
    return { line, product, variant, unitPrice };
  }));

  const currency = catalog[0].unitPrice.currency;
  let subtotal = Money.zero(currency);
  const orderItems: OrderItem[] = catalog.map(({ line, product, variant, unitPrice }) => {
    if (unitPrice.currency !== currency) throw new Error('Checkout cannot mix currencies');
    const totalPrice = unitPrice.times(line.quantity);
    subtotal = subtotal.add(totalPrice);
    return {
      product_id: product.id,
      variant_id: variant.id,
      sku: variant.sku,
      quantity: line.quantity,
      unit_price: unitPrice.toJSON(),
      total_price: totalPrice.toJSON(),
      product_name: localized(product.name),
      variant_options: optionValues(variant.option_values).map((option) => ({
        option_name: option.option_id,
        option_value: option.value,
      })),
    };
  });

  await capabilities.subscriptions.validateCheckout({
    productIds: orderItems.map((item) => item.product_id),
    customerId: input.customerId,
  });

  const [shippingSettings, storeSettings] = await Promise.all([
    deps.getSettings('shipping'),
    deps.getSettings('store'),
  ]);
  const destinationCountry = input.shippingAddress.country.toUpperCase();
  if (!allowedShippingCountries(shippingSettings).includes(destinationCountry)) {
    throw new Error(`Checkout shipping is not available for ${destinationCountry}`);
  }
  const methods = enabledShippingMethods(shippingSettings);
  const method = methods.find((entry) =>
    entry.id === input.shippingMethodId
  );
  if (!method || typeof method.label !== 'string') {
    throw new Error(`Shipping method ${input.shippingMethodId} is not configured`);
  }
  const configuredShippingCost = Number(method.cost);
  if (!Number.isFinite(configuredShippingCost) || configuredShippingCost < 0) {
    throw new Error(`Shipping method ${input.shippingMethodId} has an invalid configured cost`);
  }
  let shipping = Money.fromMajor(configuredShippingCost, currency);
  const threshold = Number(storeSettings['store.free_shipping_threshold']);
  const freeMethods = Array.isArray(shippingSettings['shipping.free_methods'])
    ? shippingSettings['shipping.free_methods']
    : [];
  if (
    Number.isFinite(threshold) &&
    threshold >= 0 &&
    subtotal.gte(Money.fromMajor(threshold, currency)) &&
    freeMethods.includes(input.shippingMethodId)
  ) {
    shipping = Money.zero(currency);
  }

  const codes = normalizeCodes(input.discountCodes);
  const pricedCatalog = catalog.map(({ product, unitPrice, line }) => ({
    product,
    lineTotal: unitPrice.times(line.quantity),
  }));
  const discounts = await resolveDiscounts(
    codes,
    subtotal,
    shipping,
    pricedCatalog,
    {
      customerId: input.customerId,
      region: input.shippingAddress.region,
      country: input.shippingAddress.country,
    },
    deps
  );
  const discount = discounts.merchandise.add(discounts.shipping);
  const discountedMerchandise = subtotal.subtract(discounts.merchandise);
  const chargedShipping = shipping.subtract(discounts.shipping);

  const defaultTaxCode = typeof storeSettings['store.default_tax_code'] === 'string'
    ? storeSettings['store.default_tax_code']
    : 'txcd_99999999';
  const requireTaxCategory = storeSettings['store.require_tax_category'] === true;
  const taxCodes = catalog.map(({ product, variant }, index) => {
    const code = variant.tax_category || product.tax_category || defaultTaxCode;
    if (
      (requireTaxCategory && !variant.tax_category && !product.tax_category) ||
      typeof code !== 'string' ||
      !/^txcd_\d{8}$/.test(code)
    ) {
      throw new Error(`Checkout line ${index} has no valid tax classification`);
    }
    return code;
  });

  let tax: Money;
  let taxSource: CheckoutQuote['taxSource'] = 'provider';
  try {
    const calculation = await deps.calculateTax({
      currency: currency.toLowerCase(),
      line_items: pricedCatalog.map(({ lineTotal }, index) => ({
        amount: lineTotal.subtract(discounts.perLine[index]).toMinorUnits(),
        reference: `checkout_line_${index}`,
        tax_code: taxCodes[index],
      })),
      customer_details: {
        address: {
          line1: String(input.shippingAddress.line1),
          city: String(input.shippingAddress.city),
          state: input.shippingAddress.region,
          postal_code: input.shippingAddress.postal_code,
          country: input.shippingAddress.country,
        },
        address_source: 'shipping',
      },
      ...(chargedShipping.isZero() ? {} : {
        shipping_cost: { amount: chargedShipping.toMinorUnits(), tax_code: 'txcd_92010001' },
      }),
    });
    const amount = Number((calculation as { tax_amount_exclusive?: unknown }).tax_amount_exclusive);
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid tax provider response');
    tax = Money.fromMinor(amount, currency);
  } catch {
    taxSource = 'configured_fallback';
    const fallbackRate = configuredRate(storeSettings['store.tax_rate']);
    if (fallbackRate === null) {
      throw new Error('Tax provider failed and store.tax_rate is not a valid configured fallback');
    }
    const taxableShipping = storeSettings['store.tax_shipping'] === true
      ? chargedShipping
      : Money.zero(currency);
    tax = discountedMerchandise
      .add(taxableShipping)
      .applyRate(fallbackRate);
  }

  const beforeTender = discountedMerchandise.add(chargedShipping).add(tax);
  const tenderResolution = await capabilities.giftCards.resolveTender({
    token: input.giftCardToken,
    currency,
    amountDue: beforeTender,
  });
  const tender = tenderResolution.amount;
  if (tenderResolution.state !== undefined) {
    try {
      const serialized = JSON.stringify(tenderResolution.state);
      if (serialized === undefined || serialized.length > 8_192) throw new Error('not serializable');
    } catch {
      throw new Error('Optional tender capability returned non-serializable server state');
    }
  }
  if (tender.currency !== currency || tender.isNegative() || tender.gt(beforeTender)) {
    throw new Error('Optional tender capability returned an invalid amount');
  }
  const total = beforeTender.subtract(tender);

  return {
    currency,
    items: orderItems,
    subtotal: subtotal.toJSON(),
    discount: discount.toJSON(),
    merchandiseDiscount: discounts.merchandise.toJSON(),
    shippingDiscount: discounts.shipping.toJSON(),
    shipping: shipping.toJSON(),
    tax: tax.toJSON(),
    tender: tender.toJSON(),
    total: total.toJSON(),
    discountCodes: discounts.appliedCodes,
    shippingMethod: { id: input.shippingMethodId, label: method.label },
    taxSource,
    tenderState: tenderResolution.state,
  };
}
