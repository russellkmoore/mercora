export type Money = {
  amount: number; // Amount in the smallest currency unit (e.g., cents for USD)
  currency: string; // ISO 4217 currency code (e.g., "USD", "EUR")
};