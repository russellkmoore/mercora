export const DEFAULT_MAINTENANCE_MESSAGE =
  "We're making some improvements! We'll be back soon.";

/** Escape an untrusted value for interpolation as HTML text. */
export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Type-check, default, and escape the configurable maintenance message. */
export function safeMaintenanceMessage(value: unknown): string {
  const message = typeof value === 'string' && value.trim().length > 0
    ? value
    : DEFAULT_MAINTENANCE_MESSAGE;
  return escapeHtmlText(message);
}
