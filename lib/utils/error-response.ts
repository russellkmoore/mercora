export type ErrorDetails = { details?: string };

/** Include raw exception detail only for local development diagnostics. */
export function errorDetails(error: unknown): ErrorDetails {
  if (process.env.NODE_ENV !== 'development') return {};

  return {
    details: error instanceof Error ? error.message : String(error),
  };
}
