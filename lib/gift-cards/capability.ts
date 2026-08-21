import { Money } from "@/lib/money";
import type {
  GiftCardCheckoutCapability,
  GiftCardTenderRequestIdentity,
} from "@/lib/commerce/capabilities";
import type { Order } from "@/lib/types/order";
import {
  GiftCardCodeConfigurationError,
  giftCardLookupCandidates,
  type GiftCardKeyRing,
} from "./code";
import {
  assertGiftCardMoney,
  assertReserveGiftCardInput,
  type GiftCardAccount,
} from "./domain";
import { createGiftCardRepository } from "./repository";
import { GiftCardRuntimeConfigurationError } from "./config";

type GiftCardRepository = Pick<ReturnType<typeof createGiftCardRepository>,
  | "findAccountByCodeHash"
  | "reserve"
  | "commitReservation"
  | "settleReservation"
  | "findSettledRedemption"
  | "restoreRedemption"
  | "releaseReservation"
>;

export interface ResolveGiftCardTenderInput {
  token: string;
  currency: string;
  amountDue: Money;
  requestIdentity: GiftCardTenderRequestIdentity;
}

export interface GiftCardCapabilityDependencies {
  resolveLookupRuntime(): Promise<{
    repository: GiftCardRepository;
    keyRing: GiftCardKeyRing;
  }>;
  resolveRepository(): Promise<GiftCardRepository>;
  now?: () => number;
}

export class GiftCardTenderRequestError extends Error {
  constructor() {
    super("Gift-card tender request is invalid");
    this.name = "GiftCardTenderRequestError";
  }
}

export class GiftCardTenderUnavailableError extends Error {
  constructor() {
    super("Gift-card tender is unavailable");
    this.name = "GiftCardTenderUnavailableError";
  }
}

export class GiftCardTenderReconciliationError extends Error {
  constructor() {
    super("Gift-card tender reconciliation failed");
    this.name = "GiftCardTenderReconciliationError";
  }
}

interface GiftCardTenderStateV1 {
  v: 1;
  reservationId: string;
}

function hex(bytes: Uint8Array): string {
  let result = "";
  for (const byte of bytes) result += byte.toString(16).padStart(2, "0");
  return result;
}

async function reservationId(requestKey: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`mercora:gift-card:reservation\u0000v1\u0000${requestKey}`),
  );
  return `gift_reservation_${hex(new Uint8Array(digest))}`;
}

function exactState(value: unknown): GiftCardTenderStateV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (
    Object.keys(raw).length !== 2
    || raw.v !== 1
    || typeof raw.reservationId !== "string"
    || raw.reservationId.length < 1
    || raw.reservationId.length > 128
    || raw.reservationId.trim() !== raw.reservationId
  ) return null;
  return { v: 1, reservationId: raw.reservationId };
}

function epochNow(dependencies: GiftCardCapabilityDependencies): number {
  const value = dependencies.now?.() ?? Math.floor(Date.now() / 1_000);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new GiftCardTenderReconciliationError();
  }
  return value;
}

function protectedTender(order: Order): Money {
  try {
    const amount = Money.fromStored(
      order.extensions?.checkout_tender ?? 0,
      order.currency_code,
    );
    assertGiftCardMoney(amount);
    return amount;
  } catch {
    throw new GiftCardTenderReconciliationError();
  }
}

function exactAccount(matches: Array<GiftCardAccount | undefined>): GiftCardAccount | null {
  const accounts = new Map<string, GiftCardAccount>();
  for (const account of matches) {
    if (account) accounts.set(account.id, account);
  }
  return accounts.size === 1 ? [...accounts.values()][0] : null;
}

function assertResolutionRequest(input: ResolveGiftCardTenderInput): void {
  const identity = input.requestIdentity;
  try {
    if (
      typeof input.token !== "string"
      || input.token.length === 0
      || !(input.amountDue instanceof Money)
      || input.currency !== input.amountDue.currency
      || !identity
      || typeof identity.requestKey !== "string"
      || identity.requestKey.length < 8
      || identity.requestKey.length > 256
      || identity.requestKey.trim() !== identity.requestKey
      || typeof identity.quoteFingerprint !== "string"
      || !/^[0-9a-f]{64}$/.test(identity.quoteFingerprint)
      || !Number.isSafeInteger(identity.reservedAt)
      || identity.reservedAt < 0
      || !Number.isSafeInteger(identity.expiresAt)
      || identity.expiresAt <= identity.reservedAt
    ) throw new GiftCardTenderRequestError();
    assertGiftCardMoney(input.amountDue, { positive: true });
  } catch (error) {
    if (error instanceof GiftCardTenderRequestError) throw error;
    throw new GiftCardTenderRequestError();
  }
}

/** Required internal reservation seam used once orchestration has durable identity. */
export async function resolveGiftCardTender(
  input: ResolveGiftCardTenderInput,
  dependencies: GiftCardCapabilityDependencies,
): Promise<{ amount: Money; state: GiftCardTenderStateV1 }> {
  assertResolutionRequest(input);

  try {
    const runtime = await dependencies.resolveLookupRuntime();
    // The codec computes every bounded rotation candidate before any lookup.
    const candidates = await giftCardLookupCandidates(input.token, runtime.keyRing);
    if (candidates.length === 0) throw new GiftCardTenderUnavailableError();
    const account = exactAccount(await Promise.all(
      candidates.map((candidate) => runtime.repository.findAccountByCodeHash(candidate)),
    ));
    if (
      !account
      || account.status !== "active"
      || account.currency !== input.currency
    ) throw new GiftCardTenderUnavailableError();

    const id = await reservationId(input.requestIdentity.requestKey);
    const reservationInput = {
      id,
      giftCardId: account.id,
      requestKey: input.requestIdentity.requestKey,
      quoteFingerprint: input.requestIdentity.quoteFingerprint,
      requestedAmount: input.amountDue,
      reservedAt: input.requestIdentity.reservedAt,
      expiresAt: input.requestIdentity.expiresAt,
    };
    assertReserveGiftCardInput(reservationInput);
    const result = await runtime.repository.reserve(reservationInput);
    if (!result.available) throw new GiftCardTenderUnavailableError();
    return {
      amount: result.reservation.amount,
      state: Object.freeze({ v: 1, reservationId: result.reservation.id }),
    };
  } catch (error) {
    if (error instanceof GiftCardTenderRequestError) throw error;
    if (error instanceof GiftCardRuntimeConfigurationError) throw error;
    if (error instanceof GiftCardCodeConfigurationError) {
      throw new GiftCardRuntimeConfigurationError();
    }
    if (error instanceof GiftCardTenderUnavailableError) throw error;
    throw new GiftCardTenderUnavailableError();
  }
}

export function createRepositoryBackedGiftCardCapability(
  dependencies: GiftCardCapabilityDependencies,
): Required<GiftCardCheckoutCapability> {
  return {
    async resolveTender({ token, currency, amountDue, requestIdentity }) {
      if (token === undefined || token === "") {
        return { amount: Money.zero(currency) };
      }
      if (typeof token !== "string") throw new GiftCardTenderUnavailableError();
      if (!requestIdentity) throw new GiftCardTenderRequestError();
      return resolveGiftCardTender({ token, currency, amountDue, requestIdentity }, dependencies);
    },

    async verifyReservedTender({ order, state, expectedTender }) {
      if (!(expectedTender instanceof Money)) {
        throw new GiftCardTenderReconciliationError();
      }
      if (expectedTender.isZero() && state === undefined) return;
      const parsed = exactState(state);
      if (!parsed || expectedTender.isZero() || !order.id) {
        throw new GiftCardTenderReconciliationError();
      }
      try {
        assertGiftCardMoney(expectedTender, { positive: true });
        const repository = await dependencies.resolveRepository();
        await repository.commitReservation({
          reservationId: parsed.reservationId,
          orderId: order.id,
          expectedAmount: expectedTender,
          committedAt: epochNow(dependencies),
        });
      } catch (error) {
        if (error instanceof GiftCardRuntimeConfigurationError) throw error;
        throw new GiftCardTenderReconciliationError();
      }
    },

    async applyTender({ order, state }) {
      const expectedTender = protectedTender(order);
      if (expectedTender.isZero() && state === undefined) return;
      const parsed = exactState(state);
      if (!parsed || expectedTender.isZero() || !order.id) {
        throw new GiftCardTenderReconciliationError();
      }
      try {
        const repository = await dependencies.resolveRepository();
        await repository.settleReservation({
          reservationId: parsed.reservationId,
          orderId: order.id,
          settledAt: epochNow(dependencies),
        });
      } catch (error) {
        if (error instanceof GiftCardRuntimeConfigurationError) throw error;
        throw new GiftCardTenderReconciliationError();
      }
    },

    async releaseTender({ state, reason }) {
      if (state === undefined) return;
      const parsed = exactState(state);
      if (!parsed) throw new GiftCardTenderReconciliationError();
      try {
        const repository = await dependencies.resolveRepository();
        await repository.releaseReservation({
          reservationId: parsed.reservationId,
          reason: reason ?? "checkout abandoned",
          releasedAt: epochNow(dependencies),
        });
      } catch (error) {
        if (error instanceof GiftCardRuntimeConfigurationError) throw error;
        throw new GiftCardTenderReconciliationError();
      }
    },

    async restoreTender({ order, state, refundKey, amount }) {
      if (!(amount instanceof Money)) throw new GiftCardTenderReconciliationError();
      if (amount.isZero()) return;
      const parsed = exactState(state);
      if (!parsed || !order.id) throw new GiftCardTenderReconciliationError();
      try {
        assertGiftCardMoney(amount, { positive: true });
        const repository = await dependencies.resolveRepository();
        const redemption = await repository.findSettledRedemption({
          reservationId: parsed.reservationId,
          orderId: order.id,
        });
        if (!redemption) throw new GiftCardTenderReconciliationError();
        await repository.restoreRedemption({
          redemptionEntryId: redemption.id,
          orderId: order.id,
          refundKey,
          amount,
          restoredAt: epochNow(dependencies),
        });
      } catch (error) {
        if (error instanceof GiftCardRuntimeConfigurationError) throw error;
        if (error instanceof GiftCardTenderReconciliationError) throw error;
        throw new GiftCardTenderReconciliationError();
      }
    },
  };
}
