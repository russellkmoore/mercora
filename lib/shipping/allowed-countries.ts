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
