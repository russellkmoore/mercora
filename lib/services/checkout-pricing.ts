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
import {
  checkoutGiftCardCustomization,
  hasPhysicalCheckoutLines,
  isGiftCardOrderLine,
} from '@/lib/gift-cards/checkout';
import type { Address, CheckoutLineAllocation, OrderItem, Promotion } from '@/lib/types';
import {
  allowedShippingCountries,
  enabledShippingMethods,
  freeShippingMethodIds,
  freeShippingThreshold,
} from '@/lib/shipping/allowed-countries';

export const MAX_CHECKOUT_LINES = 100;
export const MAX_DISCOUNT_CODES = 25;

export interface CheckoutLineInput {
  lineId?: string;
  productId: string;
  variantId?: string;
  quantity: number;
  giftCardCustomization?: unknown;
}

export interface CheckoutPricingInput {
  items: CheckoutLineInput[];
  shippingAddress: Address;
  shippingMethodId: string;
  discountCodes?: string[];
  giftCardToken?: string;
  /** Server-generated request identity, stable across a checkout retry. */
  giftCardRequestKey?: string;
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
  shippingTax: StoredMoney;
  lineAllocations: CheckoutLineAllocation[];
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

type TaxCalculation = Awaited<ReturnType<typeof calculateTax>>;

interface ExpectedTaxLine {
  lineId: string;
  amount: number;
}

export interface TaxAllocationResult {
  lineTaxById: Map<string, number>;
  shippingTax: number;
  totalTax: number;
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
  // Gift cards are stored value at face value. Discounting a gift-card line
  // would let a buyer acquire a full-value card for less than face value
  // (issuance always credits the catalog unit_price), so no promotion may ever
  // target one. They still count toward cart-minimum thresholds via `subtotal`.
  let eligible = catalog
    .map((_, index) => index)
    .filter((index) => catalog[index].product.type !== 'gift_card');
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
): Promise<{
  merchandise: Money;
  shipping: Money;
  perLine: Money[];
  promotionCodesByLine: string[][];
  appliedCodes: string[];
}> {
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
  const promotionCodesByLine = catalog.map(() => [] as string[]);
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
    const lineBefore = perLine.map((amount) => amount.toMinorUnits());
    allocateDiscount(
      actionDiscount(promotion, currentEligibleTotal),
      eligible,
      catalog.map(({ lineTotal }) => lineTotal),
      perLine
    );
    perLine.forEach((amount, index) => {
      if (amount.toMinorUnits() > lineBefore[index]) {
        promotionCodesByLine[index].push(code);
      }
    });
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
    promotionCodesByLine,
    appliedCodes,
  };
}

function configuredRate(value: unknown): number | null {
  const percentage = Number(value);
  return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100
    ? percentage / 100
    : null;
}

/** Validate Stripe's expanded response before accepting any per-line tax data. */
export function mapProviderTaxAllocations(
  calculation: TaxCalculation,
  expectedLines: ExpectedTaxLine[],
  expectedShippingAmount: number
): TaxAllocationResult {
  const providerLines = calculation.line_items;
  if (!providerLines || providerLines.has_more || providerLines.data.length !== expectedLines.length) {
    throw new Error('Tax provider returned an incomplete line allocation');
  }

  const expectedByReference = new Map<string, ExpectedTaxLine>(
    expectedLines.map((line) => [`line:${line.lineId}`, line] as const)
  );
  if (expectedByReference.size !== expectedLines.length) {
    throw new Error('Checkout contains duplicate line identifiers');
  }

  const lineTaxById = new Map<string, number>();
  let allocatedTax = 0;
  for (const providerLine of providerLines.data) {
    const expected = expectedByReference.get(providerLine.reference);
    if (!expected || lineTaxById.has(expected.lineId)) {
      throw new Error('Tax provider returned an unknown or duplicate line reference');
    }
    if (
      !Number.isSafeInteger(providerLine.amount) ||
      providerLine.amount !== expected.amount ||
      !Number.isSafeInteger(providerLine.amount_tax) ||
      providerLine.amount_tax < 0 ||
      providerLine.amount_tax > expected.amount
    ) {
      throw new Error('Tax provider returned an invalid line allocation');
    }
    lineTaxById.set(expected.lineId, providerLine.amount_tax);
    allocatedTax += providerLine.amount_tax;
  }

  const shipping = calculation.shipping_cost;
  let shippingTax = 0;
  if (expectedShippingAmount > 0) {
    if (
      !shipping ||
      shipping.amount !== expectedShippingAmount ||
      !Number.isSafeInteger(shipping.amount_tax) ||
      shipping.amount_tax < 0 ||
      shipping.amount_tax > expectedShippingAmount
    ) {
      throw new Error('Tax provider returned an invalid shipping allocation');
    }
    shippingTax = shipping.amount_tax;
  } else if (shipping && (shipping.amount !== 0 || shipping.amount_tax !== 0)) {
    throw new Error('Tax provider returned unexpected shipping tax');
  }

  const totalTax = calculation.tax_amount_exclusive;
  if (
    !Number.isSafeInteger(totalTax) ||
    totalTax < 0 ||
    allocatedTax + shippingTax !== totalTax
  ) {
    throw new Error('Tax provider allocations do not match its aggregate tax');
  }
  return { lineTaxById, shippingTax, totalTax };
}

function allocateLargestRemainder(total: number, weights: number[]): number[] {
  if (!Number.isSafeInteger(total) || total < 0 || weights.some((weight) =>
    !Number.isSafeInteger(weight) || weight < 0
  )) {
    throw new Error('Tax fallback allocation requires nonnegative integer minor units');
  }
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightTotal === 0) {
    if (total !== 0) throw new Error('Cannot allocate tax across zero-value lines');
    return weights.map(() => 0);
  }

  const denominator = BigInt(weightTotal);
  const shares = weights.map((weight, index) => {
    const numerator = BigInt(total) * BigInt(weight);
    return {
      index,
      amount: Number(numerator / denominator),
      remainder: numerator % denominator,
    };
  });
  let remaining = total - shares.reduce((sum, share) => sum + share.amount, 0);
  const ranked = [...shares].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : (a.remainder > b.remainder ? -1 : 1)
  );
  for (let index = 0; index < remaining; index += 1) {
    ranked[index].amount += 1;
  }
  return shares.sort((a, b) => a.index - b.index).map((share) => share.amount);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function tenderQuoteFingerprint(args: {
  currency: string;
  items: OrderItem[];
  merchandiseDiscount: Money;
  shipping: Money;
  tax: Money;
  eligible: Money;
}): Promise<string> {
  const canonical = JSON.stringify({
    v: 1,
    currency: args.currency,
    items: args.items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      quantity: item.quantity,
      total: item.total_price,
      digitalGiftCard: isGiftCardOrderLine(item),
    })),
    merchandiseDiscount: args.merchandiseDiscount.toMinorUnits(),
    shipping: args.shipping.toMinorUnits(),
    tax: args.tax.toMinorUnits(),
    eligible: args.eligible.toMinorUnits(),
  });
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))));
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

  const seenLineIds = new Set<string>();
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
      line.quantity > 1_000 ||
      (line.lineId !== undefined && (
        typeof line.lineId !== 'string' || !/^line_[0-9a-f]{16}(?:_[2-9]\d*)?$/u.test(line.lineId)
      ))
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
    const giftCardCustomization = checkoutGiftCardCustomization(line.giftCardCustomization);
    if (product.type === 'gift_card' && !giftCardCustomization) {
      throw new Error('Gift-card lines require recipient delivery details');
    }
    if (giftCardCustomization && (
      product.type !== 'gift_card' || product.fulfillment_type !== 'digital' ||
      variant.shipping_required !== false || line.quantity !== 1
    )) {
      throw new Error('Gift-card lines must be single digital gift-card catalog items');
    }
    if (line.lineId && seenLineIds.has(line.lineId)) {
      throw new Error('Checkout contains duplicate line identifiers');
    }
    if (line.lineId) seenLineIds.add(line.lineId);
    return { line, product, variant, unitPrice, giftCardCustomization };
  }));

  const currency = catalog[0].unitPrice.currency;
  let subtotal = Money.zero(currency);
  const orderItems: OrderItem[] = catalog.map(({
    line, product, variant, unitPrice, giftCardCustomization,
  }) => {
    if (unitPrice.currency !== currency) throw new Error('Checkout cannot mix currencies');
    const totalPrice = unitPrice.times(line.quantity);
    subtotal = subtotal.add(totalPrice);
    return {
      id: line.lineId ?? `line_${crypto.randomUUID()}`,
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
      fulfillment_type: variant.shipping_required === false ? 'digital' : 'physical',
      ...(giftCardCustomization ? { gift_card: giftCardCustomization } : {}),
    };
  });

  const hasPhysicalLines = hasPhysicalCheckoutLines(orderItems);

  const [shippingSettings, storeSettings] = await Promise.all([
    deps.getSettings('shipping'),
    deps.getSettings('store'),
  ]);
  if (!input.shippingAddress) throw new Error('Checkout requires a billing or shipping address');
  const destinationCountry = input.shippingAddress.country.toUpperCase();
  let shipping = Money.zero(currency);
  let shippingMethod: CheckoutQuote['shippingMethod'] = { id: 'digital', label: 'Digital delivery' };
  if (hasPhysicalLines) {
    if (!input.shippingMethodId) throw new Error('Checkout shipping method is required');
    if (!allowedShippingCountries(shippingSettings).includes(destinationCountry)) {
      throw new Error(`Checkout shipping is not available for ${destinationCountry}`);
    }
    const methods = enabledShippingMethods(shippingSettings);
    const method = methods.find((entry) => entry.id === input.shippingMethodId);
    if (!method || typeof method.label !== 'string') {
      throw new Error(`Shipping method ${input.shippingMethodId} is not configured`);
    }
    const configuredShippingCost = Number(method.cost);
    if (!Number.isFinite(configuredShippingCost) || configuredShippingCost < 0) {
      throw new Error(`Shipping method ${input.shippingMethodId} has an invalid configured cost`);
    }
    shipping = Money.fromMajor(configuredShippingCost, currency);
    const threshold = freeShippingThreshold(storeSettings);
    const freeMethods = freeShippingMethodIds(shippingSettings);
    if (subtotal.gte(Money.fromMajor(threshold, currency)) && freeMethods.includes(input.shippingMethodId)) {
      shipping = Money.zero(currency);
    }
    shippingMethod = { id: input.shippingMethodId, label: method.label };
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
  let shippingTax: Money;
  let lineTaxes: Money[];
  let taxSource: CheckoutQuote['taxSource'] = 'provider';
  try {
    const expectedTaxLines = orderItems.map((item, index) => ({
      lineId: item.id!,
      amount: pricedCatalog[index].lineTotal.subtract(discounts.perLine[index]).toMinorUnits(),
    }));
    const calculation = await deps.calculateTax({
      currency: currency.toLowerCase(),
      line_items: expectedTaxLines.map((line, index) => ({
        amount: line.amount,
        reference: `line:${line.lineId}`,
        tax_code: taxCodes[index],
      })),
      expand: ['line_items'],
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
    const allocation = mapProviderTaxAllocations(
      calculation,
      expectedTaxLines,
      chargedShipping.toMinorUnits()
    );
    lineTaxes = orderItems.map((item) =>
      Money.fromMinor(allocation.lineTaxById.get(item.id!)!, currency)
    );
    shippingTax = Money.fromMinor(allocation.shippingTax, currency);
    tax = Money.fromMinor(allocation.totalTax, currency);
  } catch {
    taxSource = 'configured_fallback';
    const fallbackRate = configuredRate(storeSettings['store.tax_rate']);
    if (fallbackRate === null) {
      throw new Error('Tax provider failed and store.tax_rate is not a valid configured fallback');
    }
    const netLineMinor = pricedCatalog.map(({ lineTotal }, index) =>
      lineTotal.subtract(discounts.perLine[index]).toMinorUnits()
    );
    const merchandiseTax = discountedMerchandise.applyRate(fallbackRate);
    lineTaxes = allocateLargestRemainder(
      merchandiseTax.toMinorUnits(),
      netLineMinor
    ).map((amount) => Money.fromMinor(amount, currency));
    shippingTax = storeSettings['store.tax_shipping'] === true
      ? chargedShipping.applyRate(fallbackRate)
      : Money.zero(currency);
    tax = merchandiseTax.add(shippingTax);
  }

  const lineAllocations: CheckoutLineAllocation[] = orderItems.map((item, index) => ({
    lineId: item.id!,
    productId: item.product_id,
    variantId: item.variant_id!,
    quantity: item.quantity,
    catalogSubtotal: pricedCatalog[index].lineTotal.toJSON(),
    merchandiseDiscount: discounts.perLine[index].toJSON(),
    netMerchandise: pricedCatalog[index].lineTotal.subtract(discounts.perLine[index]).toJSON(),
    tax: lineTaxes[index].toJSON(),
    promotionCodes: discounts.promotionCodesByLine[index],
  }));

  const beforeTender = discountedMerchandise.add(chargedShipping).add(tax);
  // Stored value cannot fund stored value. A tender may pay only the other
  // merchandise plus the shipping/tax attributable to the whole checkout.
  const giftCardValue = orderItems.reduce((sum, item, index) => isGiftCardOrderLine(item)
    ? sum.add(pricedCatalog[index].lineTotal.subtract(discounts.perLine[index]).add(lineTaxes[index]))
    : sum, Money.zero(currency));
  const tenderEligible = beforeTender.subtract(giftCardValue);
  if (input.giftCardToken && (
    typeof input.giftCardRequestKey !== 'string' ||
    input.giftCardRequestKey.length < 8 ||
    input.giftCardRequestKey.length > 256 ||
    input.giftCardRequestKey.trim() !== input.giftCardRequestKey
  )) {
    throw new Error('Gift-card tender requires a stable checkout request identity');
  }
  const now = Math.floor(Date.now() / 1_000);
  const tenderResolution = await capabilities.giftCards.resolveTender({
    token: input.giftCardToken,
    currency,
    amountDue: tenderEligible,
    ...(input.giftCardToken ? {
      requestIdentity: {
        requestKey: input.giftCardRequestKey!,
        quoteFingerprint: await tenderQuoteFingerprint({
          currency,
          items: orderItems,
          merchandiseDiscount: discounts.merchandise,
          shipping: chargedShipping,
          tax,
          eligible: tenderEligible,
        }),
        reservedAt: now,
        expiresAt: now + (15 * 60),
      },
    } : {}),
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
  if (tender.currency !== currency || tender.isNegative() || tender.gt(tenderEligible)) {
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
    shippingTax: shippingTax.toJSON(),
    lineAllocations,
    tender: tender.toJSON(),
    total: total.toJSON(),
    discountCodes: discounts.appliedCodes,
    shippingMethod,
    taxSource,
    tenderState: tenderResolution.state,
  };
}
