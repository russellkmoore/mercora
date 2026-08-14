export function allowedShippingCountries(settings: Record<string, unknown>): string[] {
  const configured = settings['shipping.allowed_countries'];
  if (!Array.isArray(configured) || configured.length === 0) return ['US'];
  const normalized = configured
    .filter((value): value is string => typeof value === 'string' && /^[A-Za-z]{2}$/.test(value))
    .map((value) => value.toUpperCase());
  return normalized.length === configured.length && normalized.length > 0
    ? [...new Set(normalized)]
    : ['US'];
}

export const DEFAULT_SHIPPING_METHODS = [
  { id: 'standard', label: 'Standard (5–7 days)', cost: 5.99, estimatedDays: 5, enabled: true },
  { id: 'express', label: 'Express (2–3 days)', cost: 9.99, estimatedDays: 2, enabled: true },
  { id: 'overnight', label: 'Overnight', cost: 19.99, estimatedDays: 1, enabled: true },
] as const;

export const DEFAULT_FREE_SHIPPING_THRESHOLD = 75;
export const DEFAULT_FREE_SHIPPING_METHODS = ['standard'] as const;

export function freeShippingThreshold(settings: Record<string, unknown>): number {
  const raw = settings['store.free_shipping_threshold'];
  const configured = typeof raw === 'number'
    ? raw
    : typeof raw === 'string' && raw.trim() !== ''
      ? Number(raw)
      : Number.NaN;
  return Number.isFinite(configured) && configured >= 0
    ? configured
    : DEFAULT_FREE_SHIPPING_THRESHOLD;
}

export function freeShippingMethodIds(settings: Record<string, unknown>): string[] {
  const configured = settings['shipping.free_methods'];
  if (!Array.isArray(configured)) return [...DEFAULT_FREE_SHIPPING_METHODS];
  return configured.filter((value): value is string => typeof value === 'string');
}

export function configuredShippingMethods(
  settings: Record<string, unknown>
): Array<Record<string, unknown>> {
  return Array.isArray(settings['shipping.methods'])
    ? settings['shipping.methods'] as Array<Record<string, unknown>>
    : DEFAULT_SHIPPING_METHODS.map((method) => ({ ...method }));
}

export function enabledShippingMethods(
  settings: Record<string, unknown>
): Array<Record<string, unknown>> {
  return configuredShippingMethods(settings).filter((method) => method.enabled !== false);
}
