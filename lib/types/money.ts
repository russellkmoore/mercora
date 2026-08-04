import type { StoredMoney } from '@/lib/money';

/** Persisted Mercora money is always an integer minor-unit value. */
export type Money = StoredMoney;
