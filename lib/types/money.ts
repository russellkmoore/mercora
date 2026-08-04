export type Money = {
  /** Stored internally as integer minor units, e.g. USD cents. */
  amount: number;
  currency: string; // ISO 4217 currency code (e.g., "USD", "EUR")
  /** Reserved for the public MACH wire type; prevents accidental unit mixing. */
  precision?: never;
};
