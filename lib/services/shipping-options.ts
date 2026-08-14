import { Money, type StoredMoney } from '@/lib/money';
import {
  DEFAULT_FREE_SHIPPING_THRESHOLD,
  enabledShippingMethods,
  freeShippingMethodIds,
} from '@/lib/shipping/allowed-countries';
import { getSettings } from '@/lib/utils/settings';

export interface ResolvedShippingOption {
  id: string;
  label: string;
  /** Mercora's persisted integer-minor-unit money shape. */
  cost: StoredMoney;
  estimatedDays: number;
}

export interface ResolvedShippingOptions {
  options: ResolvedShippingOption[];
  qualifiesForFreeShipping: boolean;
  /** Settings store this value in decimal major units. */
  freeShippingThresholdMajor: number;
  freeMethodIds: string[];
}

export interface ShippingOptionsDependencies {
  getSettings: typeof getSettings;
}

const DEFAULT_DEPENDENCIES: ShippingOptionsDependencies = { getSettings };
const MAX_METHODS = 20;
const MAX_METHOD_TEXT = 120;
const SAFE_METHOD_TEXT = /^[^\u0000-\u001f\u007f-\u009f]+$/u;

function majorNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
}

function configuredThreshold(settings: Record<string, unknown>): number {
  const raw = settings['store.free_shipping_threshold'];
  if (raw === undefined) return DEFAULT_FREE_SHIPPING_THRESHOLD;
  const threshold = majorNumber(raw);
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new TypeError('Configured free-shipping threshold is invalid');
  }
  return threshold;
}

/**
 * Resolve the configured storefront shipping policy without importing checkout
 * or provider SDKs. Admin settings remain decimal major units; returned prices
 * use Mercora's canonical integer-minor-unit StoredMoney representation.
 */
export async function resolveShippingOptions(
  goodsCents: number,
  options: {
    currency?: string;
    subtotalPriceable?: boolean;
    deps?: ShippingOptionsDependencies;
  } = {},
): Promise<ResolvedShippingOptions> {
  const deps = options.deps ?? DEFAULT_DEPENDENCIES;
  const currency = options.currency ?? 'USD';
  const [shippingSettings, storeSettings] = await Promise.all([
    deps.getSettings('shipping'),
    deps.getSettings('store'),
  ]);

  const configuredMethods = shippingSettings['shipping.methods'];
  const configuredFreeMethods = shippingSettings['shipping.free_methods'];
  if (
    (Array.isArray(configuredMethods) && configuredMethods.length > MAX_METHODS)
    || (Array.isArray(configuredFreeMethods) && configuredFreeMethods.length > MAX_METHODS)
  ) {
    throw new RangeError(`Too many configured shipping methods (maximum ${MAX_METHODS})`);
  }
  const methods = enabledShippingMethods(shippingSettings);

  const threshold = configuredThreshold(storeSettings);
  const thresholdMoney = Money.fromMajor(threshold, currency);
  const hasUsableSubtotal = Number.isSafeInteger(goodsCents) && goodsCents >= 0;
  const qualifiesForFreeShipping = options.subtotalPriceable !== false
    && hasUsableSubtotal
    && Money.fromMinor(goodsCents, currency).gte(thresholdMoney);
  const freeMethodIds = freeShippingMethodIds(shippingSettings);

  const resolved = methods.map((method, index): ResolvedShippingOption => {
    const id = method.id;
    const label = method.label;
    const estimatedDays = method.estimatedDays;
    const majorCost = majorNumber(method.cost);
    if (
      typeof id !== 'string'
      || id.length === 0
      || id.length > MAX_METHOD_TEXT
      || !SAFE_METHOD_TEXT.test(id)
      || typeof label !== 'string'
      || label.length === 0
      || label.length > MAX_METHOD_TEXT
      || !SAFE_METHOD_TEXT.test(label)
      || typeof estimatedDays !== 'number'
      || !Number.isSafeInteger(estimatedDays)
      || estimatedDays <= 0
      || !Number.isFinite(majorCost)
      || majorCost < 0
    ) {
      throw new TypeError(`Configured shipping method at index ${index} is invalid`);
    }

    const cost = qualifiesForFreeShipping && freeMethodIds.includes(id)
      ? Money.zero(currency)
      : Money.fromMajor(majorCost, currency);
    return { id, label, cost: cost.toJSON(), estimatedDays };
  });

  return {
    options: resolved,
    qualifiesForFreeShipping,
    freeShippingThresholdMajor: threshold,
    freeMethodIds,
  };
}
