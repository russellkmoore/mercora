import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Money, type MachMoney } from "@/lib/money";
import {
  createLazyStripePlanPriceVerifier,
  type SubscriptionPlanPriceVerifier,
} from "./plan-price-adapter";

export const DEFAULT_SUBSCRIPTION_PLAN_LIMIT = 20;
export const MAX_SUBSCRIPTION_PLAN_LIMIT = 100;
export const MAX_SUBSCRIPTION_PLAN_OFFSET = 1_000_000;
export const MAX_SUBSCRIPTION_PLAN_BODY_BYTES = 8_192;

export const SUBSCRIPTION_CADENCE_UNITS = ["day", "week", "month", "year"] as const;
export type SubscriptionPlanCadenceUnit = (typeof SUBSCRIPTION_CADENCE_UNITS)[number];

export interface SubscriptionPlanCadence {
  unit: SubscriptionPlanCadenceUnit;
  count: number;
}

export interface SubscriptionPlanWrite {
  id: string;
  productId: string;
  variantId: string;
  currency: string;
  unitAmountMinor: number;
  stripePriceId: string;
  cadence: SubscriptionPlanCadence;
  active: boolean;
}

export type SubscriptionPlanPatch = Partial<Omit<SubscriptionPlanWrite, "id">>;

export interface PublicSubscriptionPlan {
  id: string;
  product: { id: string; label: string };
  variant: { id: string; label: string };
  price: MachMoney;
  cadence: SubscriptionPlanCadence;
  shippingRequired: boolean;
}

export interface AdminSubscriptionPlan extends PublicSubscriptionPlan {
  unitAmountMinor: number;
  stripePriceId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlanPage<T> {
  plans: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface SubscriptionPlanListOptions {
  limit: number;
  offset: number;
}

export interface PublicSubscriptionPlanListOptions extends SubscriptionPlanListOptions {
  productId?: string;
  variantId?: string;
}

export interface AdminSubscriptionPlanListOptions extends SubscriptionPlanListOptions {
  active?: boolean;
}

export class SubscriptionPlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscriptionPlanValidationError";
  }
}

export class SubscriptionPlanNotFoundError extends Error {
  constructor() {
    super("Subscription plan not found");
    this.name = "SubscriptionPlanNotFoundError";
  }
}

export class SubscriptionPlanConflictError extends Error {
  constructor(message = "Subscription plan changed or conflicts with an existing plan") {
    super(message);
    this.name = "SubscriptionPlanConflictError";
  }
}

interface StoredPlanRow {
  id: string;
  product_id: string;
  variant_id: string;
  currency_code: string;
  unit_amount_minor: number;
  stripe_price_id: string;
  cadence_unit: string;
  cadence_count: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface PlanRow extends StoredPlanRow {
  product_name: string;
  product_status: string | null;
  variant_sku: string;
  variant_status: string | null;
  option_values: string;
  variant_price: string;
  shipping_required: number | null;
}

interface AdminPlanRow extends StoredPlanRow {
  product_name: string | null;
  product_status: string | null;
  variant_sku: string | null;
  variant_status: string | null;
  option_values: string | null;
  variant_price: string | null;
  shipping_required: number | null;
}

interface CatalogRow {
  product_id: string;
  product_name: string;
  product_status: string | null;
  variant_id: string;
  variant_sku: string;
  variant_status: string | null;
  option_values: string;
  variant_price: string;
  shipping_required: number | null;
}

interface CountRow { count: number }

const PLAN_SELECT = `SELECT
  sp.id, sp.product_id, sp.variant_id, sp.currency_code,
  sp.unit_amount_minor, sp.stripe_price_id, sp.cadence_unit,
  sp.cadence_count, sp.is_active, sp.created_at, sp.updated_at,
  p.name AS product_name, p.status AS product_status,
  pv.sku AS variant_sku, pv.status AS variant_status,
  pv.option_values, pv.price AS variant_price,
  pv.shipping_required
FROM subscription_plans sp
JOIN products p ON p.id = sp.product_id
JOIN product_variants pv ON pv.id = sp.variant_id AND pv.product_id = sp.product_id`;

const ADMIN_PLAN_SELECT = `SELECT
  sp.id, sp.product_id, sp.variant_id, sp.currency_code,
  sp.unit_amount_minor, sp.stripe_price_id, sp.cadence_unit,
  sp.cadence_count, sp.is_active, sp.created_at, sp.updated_at,
  p.name AS product_name, p.status AS product_status,
  pv.sku AS variant_sku, pv.status AS variant_status,
  pv.option_values, pv.price AS variant_price,
  pv.shipping_required
FROM subscription_plans sp
LEFT JOIN products p ON p.id = sp.product_id
LEFT JOIN product_variants pv ON pv.id = sp.variant_id AND pv.product_id = sp.product_id`;

const STORED_PLAN_SELECT = `SELECT
  id, product_id, variant_id, currency_code, unit_amount_minor,
  stripe_price_id, cadence_unit, cadence_count, is_active,
  created_at, updated_at
FROM subscription_plans`;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const STRIPE_PRICE_PATTERN = /^price_[A-Za-z0-9]{1,249}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const utf8 = new TextEncoder();

function validation(message: string): never {
  throw new SubscriptionPlanValidationError(message);
}

export function assertSubscriptionPlanId(value: unknown, label = "Plan id"): asserts value is string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    validation(`${label} must be 1-128 safe identifier characters`);
  }
}

function assertCurrency(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) {
    validation("Currency must be an uppercase three-letter code");
  }
}

function assertCadence(value: unknown): asserts value is SubscriptionPlanCadence {
  if (!isPlainObject(value) || Object.keys(value).some((key) => key !== "unit" && key !== "count")) {
    validation("Cadence must contain only unit and count");
  }
  if (!SUBSCRIPTION_CADENCE_UNITS.includes(value.unit as SubscriptionPlanCadenceUnit)) {
    validation("Cadence unit is invalid");
  }
  if (!Number.isSafeInteger(value.count) || (value.count as number) < 1 || (value.count as number) > 365) {
    validation("Cadence count must be an integer from 1 to 365");
  }
}

function assertWrite(value: unknown): asserts value is SubscriptionPlanWrite {
  if (!isPlainObject(value)) validation("Plan must be an object");
  const allowed = new Set([
    "id", "productId", "variantId", "currency", "unitAmountMinor",
    "stripePriceId", "cadence", "active",
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key)) || Object.keys(value).length !== allowed.size) {
    validation("Plan contains missing or unknown fields");
  }
  assertSubscriptionPlanId(value.id);
  assertSubscriptionPlanId(value.productId, "Product id");
  assertSubscriptionPlanId(value.variantId, "Variant id");
  assertCurrency(value.currency);
  if (!Number.isSafeInteger(value.unitAmountMinor) || (value.unitAmountMinor as number) < 0) {
    validation("Unit amount must be a non-negative safe integer in minor units");
  }
  if (typeof value.stripePriceId !== "string" || value.stripePriceId.length > 255 ||
      !STRIPE_PRICE_PATTERN.test(value.stripePriceId)) {
    validation("Stripe price id is invalid");
  }
  assertCadence(value.cadence);
  if (typeof value.active !== "boolean") validation("Active must be a boolean");
  if (value.active && value.unitAmountMinor === 0) {
    validation("Active plans require a positive unit amount");
  }
}

function assertPatch(value: unknown): asserts value is SubscriptionPlanPatch {
  if (!isPlainObject(value)) validation("Plan patch must be an object");
  const allowed = new Set([
    "productId", "variantId", "currency", "unitAmountMinor",
    "stripePriceId", "cadence", "active",
  ]);
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.some((key) => !allowed.has(key))) {
    validation("Plan patch contains no fields or unknown fields");
  }
}

function assertVersion(value: unknown): asserts value is string {
  if (typeof value !== "string" || !ISO_TIMESTAMP_PATTERN.test(value) ||
      !Number.isFinite(Date.parse(value))) {
    validation("expectedUpdatedAt must be a canonical UTC timestamp");
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function parseJsonObject(value: string, label: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isPlainObject(parsed)) throw new TypeError();
    return parsed;
  } catch {
    throw new Error(`Stored catalog ${label} is invalid`);
  }
}

function boundedLabel(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`Stored catalog ${label} is invalid`);
  const normalized = value.trim();
  if (!normalized || utf8.encode(normalized).byteLength > 512 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`Stored catalog ${label} is invalid`);
  }
  return normalized;
}

function productLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return boundedLabel(trimmed, "product label");
  const localized = parseJsonObject(trimmed, "product label");
  const candidates = [localized["en-US"], localized.en,
    ...Object.keys(localized).sort().map((key) => localized[key])];
  const label = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return boundedLabel(label, "product label");
}

function variantLabel(sku: string, rawOptions: string): string {
  let parsed: unknown;
  try { parsed = JSON.parse(rawOptions); } catch { parsed = undefined; }
  if (!Array.isArray(parsed)) throw new Error("Stored catalog variant options are invalid");
  const values = parsed.map((entry) => {
    if (!isPlainObject(entry) || typeof entry.value !== "string") {
      throw new Error("Stored catalog variant options are invalid");
    }
    return boundedLabel(entry.value, "variant option");
  });
  return boundedLabel(values.length > 0 ? values.join(" / ") : sku, "variant label");
}

function parseVariantCurrency(raw: string): string {
  const price = parseJsonObject(raw, "variant price");
  assertCurrency(price.currency);
  Money.fromStored(price, price.currency);
  return price.currency;
}

function mapPublic(row: PlanRow): PublicSubscriptionPlan {
  assertSubscriptionPlanId(row.id);
  assertSubscriptionPlanId(row.product_id, "Stored product id");
  assertSubscriptionPlanId(row.variant_id, "Stored variant id");
  assertCurrency(row.currency_code);
  if (!Number.isSafeInteger(row.unit_amount_minor) || row.unit_amount_minor <= 0) {
    throw new Error("Stored active subscription amount is invalid");
  }
  assertCadence({ unit: row.cadence_unit, count: row.cadence_count });
  if (parseVariantCurrency(row.variant_price) !== row.currency_code) {
    throw new Error("Stored catalog variant currency does not match the subscription plan");
  }
  return {
    id: row.id,
    product: { id: row.product_id, label: productLabel(row.product_name) },
    variant: { id: row.variant_id, label: variantLabel(row.variant_sku, row.option_values) },
    price: Money.fromMinor(row.unit_amount_minor, row.currency_code).toMach(),
    cadence: { unit: row.cadence_unit as SubscriptionPlanCadenceUnit, count: row.cadence_count },
    shippingRequired: row.shipping_required !== 0,
  };
}

function safeAdminProductLabel(row: AdminPlanRow): string {
  if (row.product_name === null) return row.product_id;
  try {
    return productLabel(row.product_name);
  } catch {
    return row.product_id;
  }
}

function safeAdminVariantLabel(row: AdminPlanRow): string {
  if (row.variant_sku === null || row.option_values === null) return row.variant_id;
  try {
    return variantLabel(row.variant_sku, row.option_values);
  } catch {
    return row.variant_id;
  }
}

function mapAdmin(row: AdminPlanRow): AdminSubscriptionPlan {
  const value: SubscriptionPlanWrite = {
    id: row.id, productId: row.product_id, variantId: row.variant_id,
    currency: row.currency_code, unitAmountMinor: row.unit_amount_minor,
    stripePriceId: row.stripe_price_id,
    cadence: { unit: row.cadence_unit as SubscriptionPlanCadenceUnit, count: row.cadence_count },
    active: row.is_active === 1,
  };
  assertWrite(value);
  assertVersion(row.created_at);
  assertVersion(row.updated_at);
  return {
    id: value.id,
    product: { id: value.productId, label: safeAdminProductLabel(row) },
    variant: { id: value.variantId, label: safeAdminVariantLabel(row) },
    price: Money.fromMinor(value.unitAmountMinor, value.currency).toMach(),
    cadence: value.cadence,
    // Missing or malformed catalog evidence is never treated as shippable.
    // This projection exists to keep the exact deactivation control reachable.
    shippingRequired: row.shipping_required === 1,
    unitAmountMinor: value.unitAmountMinor,
    stripePriceId: value.stripePriceId,
    active: value.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Catalog-independent response for the exact rollback operation. Stable binding
 * ids are used as labels because missing or corrupt catalog display data must
 * never prevent an active plan from being shut off.
 */
function mapDeactivatedAdmin(row: StoredPlanRow): AdminSubscriptionPlan {
  const value: SubscriptionPlanWrite = {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    currency: row.currency_code,
    unitAmountMinor: row.unit_amount_minor,
    stripePriceId: row.stripe_price_id,
    cadence: {
      unit: row.cadence_unit as SubscriptionPlanCadenceUnit,
      count: row.cadence_count,
    },
    active: false,
  };
  assertWrite(value);
  assertVersion(row.created_at);
  assertVersion(row.updated_at);
  return {
    id: value.id,
    product: { id: value.productId, label: value.productId },
    variant: { id: value.variantId, label: value.variantId },
    price: Money.fromMinor(value.unitAmountMinor, value.currency).toMach(),
    cadence: value.cadence,
    shippingRequired: false,
    unitAmountMinor: value.unitAmountMinor,
    stripePriceId: value.stripePriceId,
    active: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validatePagination(options: SubscriptionPlanListOptions): void {
  if (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > MAX_SUBSCRIPTION_PLAN_LIMIT ||
      !Number.isSafeInteger(options.offset) || options.offset < 0 || options.offset > MAX_SUBSCRIPTION_PLAN_OFFSET) {
    validation("Pagination is out of bounds");
  }
}

function validateCatalog(row: CatalogRow | null, plan: SubscriptionPlanWrite): void {
  if (!row || row.product_id !== plan.productId || row.variant_id !== plan.variantId) {
    validation("Product and variant binding does not exist");
  }
  if (parseVariantCurrency(row.variant_price) !== plan.currency) {
    validation("Plan currency must exactly match the variant currency");
  }
  if (plan.active && (row.product_status !== "active" || row.variant_status !== "active")) {
    validation("Active plans require an active product and variant");
  }
  productLabel(row.product_name);
  variantLabel(row.variant_sku, row.option_values);
}

function isConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /constraint failed|SQLITE_CONSTRAINT/i.test(message);
}

function nextTimestamp(previous: string, now: Date): string {
  const prior = Date.parse(previous);
  const current = now.getTime();
  return new Date(Math.max(current, prior + 1)).toISOString();
}

function isExactDeactivation(patch: SubscriptionPlanPatch): patch is { active: false } {
  return patch.active === false && Object.keys(patch).length === 1;
}

export function createSubscriptionPlanService(
  database: D1Database,
  options: { now?: () => Date; priceVerifier: SubscriptionPlanPriceVerifier },
) {
  const now = options.now ?? (() => new Date());

  async function verifyProviderPrice(plan: SubscriptionPlanWrite): Promise<void> {
    await options.priceVerifier.verify({
      stripePriceId: plan.stripePriceId,
      currency: plan.currency,
      unitAmountMinor: plan.unitAmountMinor,
      cadence: plan.cadence,
      requireActive: plan.active,
    });
  }

  async function findRow(id: string): Promise<PlanRow | null> {
    return await database.prepare(`${PLAN_SELECT} WHERE sp.id = ? LIMIT 1`).bind(id).first<PlanRow>();
  }

  async function findAdminRow(id: string): Promise<AdminPlanRow | null> {
    return await database.prepare(`${ADMIN_PLAN_SELECT} WHERE sp.id = ? LIMIT 1`)
      .bind(id).first<AdminPlanRow>();
  }

  async function findStoredRow(id: string): Promise<StoredPlanRow | null> {
    return await database.prepare(`${STORED_PLAN_SELECT} WHERE id = ? LIMIT 1`)
      .bind(id).first<StoredPlanRow>();
  }

  async function findCatalog(productId: string, variantId: string): Promise<CatalogRow | null> {
    return await database.prepare(`SELECT
      p.id AS product_id, p.name AS product_name, p.status AS product_status,
      pv.id AS variant_id, pv.sku AS variant_sku, pv.status AS variant_status,
      pv.option_values, pv.price AS variant_price, pv.shipping_required
      FROM products p JOIN product_variants pv ON pv.product_id = p.id
      WHERE p.id = ? AND pv.id = ? LIMIT 1`)
      .bind(productId, variantId).first<CatalogRow>();
  }

  return {
    async listPublic(options: PublicSubscriptionPlanListOptions): Promise<SubscriptionPlanPage<PublicSubscriptionPlan>> {
      validatePagination(options);
      if (options.productId !== undefined) assertSubscriptionPlanId(options.productId, "Product id");
      if (options.variantId !== undefined) assertSubscriptionPlanId(options.variantId, "Variant id");
      const predicates = ["sp.is_active = 1", "p.status = 'active'", "pv.status = 'active'"];
      const bindings: string[] = [];
      if (options.productId !== undefined) {
        predicates.push("sp.product_id = ?");
        bindings.push(options.productId);
      }
      if (options.variantId !== undefined) {
        predicates.push("sp.variant_id = ?");
        bindings.push(options.variantId);
      }
      const where = predicates.join(" AND ");
      const [page, count] = await database.batch([
        database.prepare(`${PLAN_SELECT} WHERE ${where} ORDER BY sp.id ASC LIMIT ? OFFSET ?`)
          .bind(...bindings, options.limit, options.offset),
        database.prepare(`SELECT COUNT(*) AS count FROM subscription_plans sp
          JOIN products p ON p.id = sp.product_id
          JOIN product_variants pv ON pv.id = sp.variant_id AND pv.product_id = sp.product_id
          WHERE ${where}`).bind(...bindings),
      ]);
      const total = (count.results[0] as unknown as CountRow | undefined)?.count;
      if (!Number.isSafeInteger(total) || (total as number) < 0) throw new Error("Invalid plan count");
      return {
        plans: (page.results as unknown as PlanRow[]).map(mapPublic),
        total: total as number,
        limit: options.limit,
        offset: options.offset,
      };
    },

    async listAdmin(options: AdminSubscriptionPlanListOptions): Promise<SubscriptionPlanPage<AdminSubscriptionPlan>> {
      validatePagination(options);
      if (options.active !== undefined && typeof options.active !== "boolean") validation("Active filter is invalid");
      const where = options.active === undefined ? "" : " WHERE sp.is_active = ?";
      const bindings = options.active === undefined ? [] : [options.active ? 1 : 0];
      const pageStatement = database.prepare(`${ADMIN_PLAN_SELECT}${where} ORDER BY sp.id ASC LIMIT ? OFFSET ?`)
        .bind(...bindings, options.limit, options.offset);
      const countStatement = database.prepare(`SELECT COUNT(*) AS count FROM subscription_plans sp${where}`)
        .bind(...bindings);
      const [page, count] = await database.batch([pageStatement, countStatement]);
      const total = (count.results[0] as unknown as CountRow | undefined)?.count;
      if (!Number.isSafeInteger(total) || (total as number) < 0) throw new Error("Invalid plan count");
      return {
        plans: (page.results as unknown as AdminPlanRow[]).map(mapAdmin),
        total: total as number,
        limit: options.limit,
        offset: options.offset,
      };
    },

    async getAdmin(id: string): Promise<AdminSubscriptionPlan> {
      assertSubscriptionPlanId(id);
      const row = await findAdminRow(id);
      if (!row) throw new SubscriptionPlanNotFoundError();
      return mapAdmin(row);
    },

    async create(value: SubscriptionPlanWrite): Promise<AdminSubscriptionPlan> {
      assertWrite(value);
      validateCatalog(await findCatalog(value.productId, value.variantId), value);
      await verifyProviderPrice(value);
      const timestamp = now().toISOString();
      assertVersion(timestamp);
      try {
        await database.prepare(`INSERT INTO subscription_plans (
          id, product_id, variant_id, currency_code, unit_amount_minor,
          stripe_price_id, cadence_unit, cadence_count, is_active,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            value.id, value.productId, value.variantId, value.currency,
            value.unitAmountMinor, value.stripePriceId, value.cadence.unit,
            value.cadence.count, value.active ? 1 : 0, timestamp, timestamp,
          ).run();
      } catch (error) {
        if (isConstraintError(error)) throw new SubscriptionPlanConflictError();
        throw error;
      }
      const created = await findRow(value.id);
      if (!created) throw new Error("Created subscription plan could not be read");
      return mapAdmin(created);
    },

    async update(
      id: string,
      patch: SubscriptionPlanPatch,
      expectedUpdatedAt: string,
    ): Promise<AdminSubscriptionPlan> {
      assertSubscriptionPlanId(id);
      assertPatch(patch);
      assertVersion(expectedUpdatedAt);
      if (isExactDeactivation(patch)) {
        const stored = await findStoredRow(id);
        if (!stored) throw new SubscriptionPlanNotFoundError();
        if (stored.updated_at !== expectedUpdatedAt) {
          throw new SubscriptionPlanConflictError("Subscription plan version is stale");
        }
        const updatedAt = nextTimestamp(stored.updated_at, now());
        const result = await database.prepare(`UPDATE subscription_plans
          SET is_active = 0, updated_at = ?
          WHERE id = ? AND product_id = ? AND variant_id = ? AND currency_code = ?
            AND unit_amount_minor = ? AND stripe_price_id = ? AND cadence_unit = ?
            AND cadence_count = ? AND is_active = ? AND created_at = ? AND updated_at = ?`)
          .bind(
            updatedAt, id, stored.product_id, stored.variant_id, stored.currency_code,
            stored.unit_amount_minor, stored.stripe_price_id, stored.cadence_unit,
            stored.cadence_count, stored.is_active, stored.created_at, stored.updated_at,
          ).run();
        if (result.meta.changes !== 1) {
          throw new SubscriptionPlanConflictError("Subscription plan changed concurrently");
        }
        return mapDeactivatedAdmin({ ...stored, is_active: 0, updated_at: updatedAt });
      }
      const row = await findRow(id);
      if (!row) throw new SubscriptionPlanNotFoundError();
      if (row.updated_at !== expectedUpdatedAt) throw new SubscriptionPlanConflictError("Subscription plan version is stale");

      const next: SubscriptionPlanWrite = {
        id,
        productId: patch.productId ?? row.product_id,
        variantId: patch.variantId ?? row.variant_id,
        currency: patch.currency ?? row.currency_code,
        unitAmountMinor: patch.unitAmountMinor ?? row.unit_amount_minor,
        stripePriceId: patch.stripePriceId ?? row.stripe_price_id,
        cadence: patch.cadence ?? {
          unit: row.cadence_unit as SubscriptionPlanCadenceUnit,
          count: row.cadence_count,
        },
        active: patch.active ?? row.is_active === 1,
      };
      assertWrite(next);
      validateCatalog(await findCatalog(next.productId, next.variantId), next);
      const bindingChanged = next.productId !== row.product_id
        || next.variantId !== row.variant_id
        || next.currency !== row.currency_code
        || next.unitAmountMinor !== row.unit_amount_minor
        || next.stripePriceId !== row.stripe_price_id
        || next.cadence.unit !== row.cadence_unit
        || next.cadence.count !== row.cadence_count;
      const activating = next.active && row.is_active !== 1;
      if (bindingChanged || activating) await verifyProviderPrice(next);
      const updatedAt = nextTimestamp(row.updated_at, now());

      try {
        const result = await database.prepare(`UPDATE subscription_plans SET
          product_id = ?, variant_id = ?, currency_code = ?, unit_amount_minor = ?,
          stripe_price_id = ?, cadence_unit = ?, cadence_count = ?, is_active = ?,
          updated_at = ?
          WHERE id = ? AND product_id = ? AND variant_id = ? AND currency_code = ?
            AND unit_amount_minor = ? AND stripe_price_id = ? AND cadence_unit = ?
            AND cadence_count = ? AND is_active = ? AND updated_at = ?`)
          .bind(
            next.productId, next.variantId, next.currency, next.unitAmountMinor,
            next.stripePriceId, next.cadence.unit, next.cadence.count,
            next.active ? 1 : 0, updatedAt,
            id, row.product_id, row.variant_id, row.currency_code,
            row.unit_amount_minor, row.stripe_price_id, row.cadence_unit,
            row.cadence_count, row.is_active, row.updated_at,
          ).run();
        if (result.meta.changes !== 1) throw new SubscriptionPlanConflictError("Subscription plan changed concurrently");
      } catch (error) {
        if (error instanceof SubscriptionPlanConflictError) throw error;
        if (isConstraintError(error)) throw new SubscriptionPlanConflictError();
        throw error;
      }
      const updated = await findRow(id);
      if (!updated || updated.updated_at !== updatedAt) {
        throw new SubscriptionPlanConflictError("Subscription plan changed concurrently");
      }
      return mapAdmin(updated);
    },
  };
}

export type SubscriptionPlanService = ReturnType<typeof createSubscriptionPlanService>;

export async function getSubscriptionPlanService(): Promise<SubscriptionPlanService> {
  const { env } = await getCloudflareContext({ async: true });
  return createSubscriptionPlanService(env.DB, {
    priceVerifier: createLazyStripePlanPriceVerifier(async () => {
      const { getStripeClient } = await import("@/lib/stripe");
      return getStripeClient();
    }),
  });
}
