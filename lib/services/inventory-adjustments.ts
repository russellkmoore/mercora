import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Order, OrderItem } from '@/lib/types/order';
import type { ProductInventory } from '@/lib/types';
import { canFulfillInventory } from '@/lib/inventory/availability';
import { recordTelemetry } from '@/lib/observability/telemetry';
import { isGiftCardOrderLine } from '@/lib/gift-cards/checkout';

const ADJUSTMENT_LEASE_MS = 5 * 60 * 1000;
const MAX_ADJUSTMENT_ERROR = 2_000;

export type InventoryAdjustmentKind = 'paid_decrement' | 'refund_restock';
export type InventoryAdjustmentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'skipped'
  | 'needs_review'
  | 'failed';

export interface InventoryAdjustmentInput {
  adjustmentKey: string;
  orderId: string;
  lineId?: string;
  variantId: string;
  kind: InventoryAdjustmentKind;
  quantity: number;
}

export interface ClaimedInventoryAdjustment {
  adjustment_key: string;
  order_id: string;
  line_id: string | null;
  variant_id: string;
  kind: InventoryAdjustmentKind;
  quantity: number;
  attempt_count: number;
  claim_token: string;
}

export interface InventoryAdjustmentDrainResult {
  claimed: number;
  succeeded: number;
  skipped: number;
  needsReview: number;
  failed: number;
  ownershipLost: number;
}

export class InventoryUnavailableError extends Error {
  constructor(public readonly variantIds: string[]) {
    super('One or more requested variants do not have enough inventory');
    this.name = 'InventoryUnavailableError';
  }
}

async function resolveDatabase(database?: D1Database): Promise<D1Database> {
  if (database) return database;
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

function validateAdjustment(input: InventoryAdjustmentInput): void {
  if (!input.adjustmentKey || input.adjustmentKey.length > 512) {
    throw new Error('Inventory adjustment key is invalid');
  }
  if (!input.orderId || input.orderId.length > 256) {
    throw new Error('Inventory adjustment order id is invalid');
  }
  if (!input.variantId || input.variantId.length > 256) {
    throw new Error('Inventory adjustment variant id is invalid');
  }
  if (input.lineId && input.lineId.length > 256) {
    throw new Error('Inventory adjustment line id is invalid');
  }
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw new Error('Inventory adjustment quantity must be a positive integer');
  }
  if (input.kind === 'paid_decrement') {
    if (input.lineId != null || input.adjustmentKey !==
      `paid:${input.orderId}:inventory:${input.variantId}:v1`) {
      throw new Error('Paid inventory adjustment identity is invalid');
    }
    return;
  }
  if (input.kind === 'refund_restock') {
    if (!input.lineId || input.adjustmentKey !==
      `restock:${input.orderId}:${input.lineId}:v1`) {
      throw new Error('Refund restock adjustment identity is invalid');
    }
    return;
  }
  throw new Error('Inventory adjustment kind is invalid');
}

function aggregateOrderDemand(items: OrderItem[]): Map<string, number> {
  const demand = new Map<string, number>();
  for (const item of items) {
    // Gift cards are stored value, not catalog stock. Their face value is
    // issued by the paid-order effect and must never mutate variant inventory.
    if (isGiftCardOrderLine(item)) continue;
    if (!item.variant_id || item.variant_id.length > 256) {
      throw new Error('Paid order item has no valid variant id');
    }
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new Error('Paid order item has an invalid quantity');
    }
    const quantity = (demand.get(item.variant_id) ?? 0) + item.quantity;
    if (!Number.isSafeInteger(quantity)) {
      throw new Error('Paid order variant quantity is too large');
    }
    demand.set(item.variant_id, quantity);
  }
  return demand;
}

export async function stageInventoryAdjustments(
  inputs: InventoryAdjustmentInput[],
  options: { database?: D1Database; now?: Date } = {}
): Promise<void> {
  if (inputs.length === 0) return;
  if (inputs.length > 100) throw new Error('Too many inventory adjustments');
  inputs.forEach(validateAdjustment);
  const database = await resolveDatabase(options.database);
  const now = (options.now ?? new Date()).toISOString();
  await database.batch(inputs.map((input) => database.prepare(`
INSERT INTO inventory_adjustments (
  adjustment_key, order_id, line_id, variant_id, kind, quantity,
  status, attempt_count, claim_token, lease_expires_at, next_attempt_at,
  result, last_error, created_at, updated_at, completed_at
) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, NULL, NULL, NULL, ?, ?, NULL)
ON CONFLICT(adjustment_key) DO NOTHING
`).bind(
    input.adjustmentKey,
    input.orderId,
    input.lineId ?? null,
    input.variantId,
    input.kind,
    input.quantity,
    now,
    now
  )));
}

export async function stagePaidInventoryAdjustments(
  order: Order,
  options: { database?: D1Database; now?: Date } = {}
): Promise<void> {
  if (!order.id) throw new Error('Cannot stage inventory for an order without an id');
  const inputs = [...aggregateOrderDemand(order.items)].map(([variantId, quantity]) => ({
    adjustmentKey: `paid:${order.id}:inventory:${variantId}:v1`,
    orderId: order.id!,
    variantId,
    kind: 'paid_decrement' as const,
    quantity,
  }));
  await stageInventoryAdjustments(inputs, options);
}

export async function assertCheckoutInventoryAvailable(
  items: OrderItem[],
  options: { database?: D1Database } = {}
): Promise<void> {
  const demand = aggregateOrderDemand(items);
  if (demand.size === 0) return;
  const database = await resolveDatabase(options.database);
  const rows = await database.batch([...demand].map(([variantId]) =>
    database.prepare('SELECT status, inventory FROM product_variants WHERE id = ?')
      .bind(variantId)
  ));
  const unavailable: string[] = [];
  [...demand].forEach(([variantId, quantity], index) => {
    const row = rows[index]?.results?.[0] as { status?: string; inventory?: string | ProductInventory } | undefined;
    if (!row || (row.status != null && row.status !== 'active')) {
      unavailable.push(variantId);
      return;
    }
    let inventory: ProductInventory | undefined;
    try {
      inventory = typeof row.inventory === 'string'
        ? JSON.parse(row.inventory) as ProductInventory
        : row.inventory;
    } catch {
      unavailable.push(variantId);
      return;
    }
    if (!canFulfillInventory(inventory, quantity)) unavailable.push(variantId);
  });
  if (unavailable.length > 0) throw new InventoryUnavailableError(unavailable.sort());
}

const CLAIM_SQL = `
UPDATE inventory_adjustments
SET status = 'processing',
    attempt_count = attempt_count + 1,
    claim_token = ?,
    lease_expires_at = ?,
    next_attempt_at = NULL,
    last_error = NULL,
    updated_at = ?
WHERE adjustment_key = (
  SELECT ia.adjustment_key
  FROM inventory_adjustments ia
  JOIN orders o ON o.id = ia.order_id
  WHERE (? IS NULL OR ia.order_id = ?)
    AND (? IS NULL OR ia.kind = ?)
    AND (
      (ia.kind = 'paid_decrement' AND o.payment_status = 'paid')
      OR (ia.kind = 'refund_restock' AND o.payment_status IN ('paid', 'refunded'))
    )
    AND (
      ia.status = 'pending'
      OR (ia.status = 'failed' AND (ia.next_attempt_at IS NULL OR ia.next_attempt_at <= ?))
      OR (ia.status = 'processing' AND ia.lease_expires_at <= ?)
    )
  ORDER BY ia.created_at, ia.adjustment_key
  LIMIT 1
)
RETURNING adjustment_key, order_id, line_id, variant_id, kind, quantity,
          attempt_count, claim_token
`;

export async function claimNextInventoryAdjustment(
  database: D1Database,
  options: {
    orderId?: string;
    kind?: InventoryAdjustmentKind;
    now?: Date;
    claimToken?: string;
    leaseDurationMs?: number;
  } = {}
): Promise<ClaimedInventoryAdjustment | null> {
  const now = options.now ?? new Date();
  const leaseDurationMs = options.leaseDurationMs ?? ADJUSTMENT_LEASE_MS;
  if (!Number.isSafeInteger(leaseDurationMs) || leaseDurationMs <= 0) {
    throw new Error('Inventory adjustment lease duration must be a positive integer');
  }
  const nowIso = now.toISOString();
  return database.prepare(CLAIM_SQL).bind(
    options.claimToken ?? crypto.randomUUID(),
    new Date(now.getTime() + leaseDurationMs).toISOString(),
    nowIso,
    options.orderId ?? null,
    options.orderId ?? null,
    options.kind ?? null,
    options.kind ?? null,
    nowIso,
    nowIso
  ).first<ClaimedInventoryAdjustment>();
}

const TERMINAL_SQL = `
UPDATE inventory_adjustments
SET status = CASE
      WHEN changes() = 1 THEN 'succeeded'
      WHEN EXISTS (SELECT 1 FROM product_variants WHERE id = ?) AND
           (SELECT json_valid(COALESCE(inventory, '{}'))
            FROM product_variants WHERE id = ?) = 1 AND
           COALESCE((SELECT CASE WHEN json_valid(COALESCE(inventory, '{}')) = 1
                                THEN json_extract(inventory, '$.track_inventory') END
                     FROM product_variants WHERE id = ?), 0) <> 1 THEN 'skipped'
      ELSE 'needs_review'
    END,
    claim_token = NULL,
    lease_expires_at = NULL,
    next_attempt_at = NULL,
    last_error = NULL,
    result = json_object(
      'outcome', CASE
        WHEN changes() = 1 THEN 'applied'
        WHEN EXISTS (SELECT 1 FROM product_variants WHERE id = ?) AND
             (SELECT json_valid(COALESCE(inventory, '{}'))
              FROM product_variants WHERE id = ?) = 1 AND
             COALESCE((SELECT CASE WHEN json_valid(COALESCE(inventory, '{}')) = 1
                                  THEN json_extract(inventory, '$.track_inventory') END
                       FROM product_variants WHERE id = ?), 0) <> 1 THEN 'untracked'
        ELSE 'needs_review'
      END,
      'variantId', ?,
      'quantity', ?
    ),
    completed_at = ?,
    updated_at = ?
WHERE adjustment_key = ?
  AND status = 'processing'
  AND claim_token = ?
`;

export async function applyClaimedInventoryAdjustment(
  database: D1Database,
  adjustment: ClaimedInventoryAdjustment,
  now: Date = new Date()
): Promise<InventoryAdjustmentStatus | null> {
  const validInventory = "json_valid(COALESCE(inventory, '{}')) = 1";
  const quantityValue = `CASE WHEN ${validInventory}
    THEN COALESCE(json_extract(inventory, '$.quantity'), 0) END`;
  const quantityType = `CASE WHEN ${validInventory}
    THEN json_type(inventory, '$.quantity') END`;
  const tracked = `CASE WHEN ${validInventory}
    THEN json_extract(inventory, '$.track_inventory') END`;
  const allowsBackorder = `CASE WHEN ${validInventory}
    THEN json_extract(inventory, '$.allow_backorder') END`;
  const quantityExpression = adjustment.kind === 'paid_decrement'
    ? `${quantityValue} - ?`
    : `${quantityValue} + ?`;
  const stockGuard = adjustment.kind === 'paid_decrement'
    ? `AND (${allowsBackorder} = 1 OR ${quantityValue} >= ?)`
    : '';
  const mutation = database.prepare(`
UPDATE product_variants
SET inventory = json_set(COALESCE(inventory, '{}'), '$.quantity', ${quantityExpression}),
    updated_at = ?
WHERE id = ?
  AND ${validInventory}
  AND ${tracked} = 1
  AND (${quantityType} IS NULL OR ${quantityType} = 'integer')
  AND ${quantityValue} BETWEEN -9007199254740991 AND 9007199254740991
  AND (${quantityExpression}) BETWEEN -9007199254740991 AND 9007199254740991
  ${stockGuard}
  AND EXISTS (
    SELECT 1 FROM inventory_adjustments ia
    WHERE ia.adjustment_key = ?
      AND ia.status = 'processing'
      AND ia.claim_token = ?
  )
`).bind(
    adjustment.quantity,
    now.toISOString(),
    adjustment.variant_id,
    adjustment.quantity,
    ...(adjustment.kind === 'paid_decrement' ? [adjustment.quantity] : []),
    adjustment.adjustment_key,
    adjustment.claim_token
  );
  const terminal = database.prepare(TERMINAL_SQL).bind(
    adjustment.variant_id,
    adjustment.variant_id,
    adjustment.variant_id,
    adjustment.variant_id,
    adjustment.variant_id,
    adjustment.variant_id,
    adjustment.variant_id,
    adjustment.quantity,
    now.toISOString(),
    now.toISOString(),
    adjustment.adjustment_key,
    adjustment.claim_token
  );
  const results = await database.batch([mutation, terminal]);
  if (results[1]?.meta.changes !== 1) return null;
  const row = await database.prepare(
    'SELECT status FROM inventory_adjustments WHERE adjustment_key = ?'
  ).bind(adjustment.adjustment_key).first<{ status: InventoryAdjustmentStatus }>();
  return row?.status ?? null;
}

export async function failInventoryAdjustment(
  database: D1Database,
  adjustment: ClaimedInventoryAdjustment,
  error: unknown,
  now: Date = new Date()
): Promise<boolean> {
  const delayMs = Math.min(
    6 * 60 * 60 * 1000,
    5 * 60 * 1000 * 2 ** Math.min(adjustment.attempt_count - 1, 10)
  );
  const message = (error instanceof Error ? error.message : String(error))
    .slice(0, MAX_ADJUSTMENT_ERROR);
  const response = await database.prepare(`
UPDATE inventory_adjustments
SET status = 'failed', claim_token = NULL, lease_expires_at = NULL,
    next_attempt_at = ?, last_error = ?, updated_at = ?
WHERE adjustment_key = ? AND status = 'processing' AND claim_token = ?
`).bind(
    new Date(now.getTime() + delayMs).toISOString(),
    message,
    now.toISOString(),
    adjustment.adjustment_key,
    adjustment.claim_token
  ).run();
  return response.meta.changes === 1;
}

export async function drainInventoryAdjustments(
  options: {
    database?: D1Database;
    orderId?: string;
    kind?: InventoryAdjustmentKind;
    limit?: number;
    now?: () => Date;
  } = {}
): Promise<InventoryAdjustmentDrainResult> {
  const database = await resolveDatabase(options.database);
  const limit = options.limit ?? 25;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Inventory adjustment drain limit must be between 1 and 100');
  }
  const result: InventoryAdjustmentDrainResult = {
    claimed: 0, succeeded: 0, skipped: 0, needsReview: 0, failed: 0, ownershipLost: 0,
  };
  for (let index = 0; index < limit; index += 1) {
    const adjustment = await claimNextInventoryAdjustment(database, {
      orderId: options.orderId,
      kind: options.kind,
      now: options.now?.() ?? new Date(),
    });
    if (!adjustment) break;
    result.claimed += 1;
    try {
      const status = await applyClaimedInventoryAdjustment(
        database,
        adjustment,
        options.now?.() ?? new Date()
      );
      if (status === 'succeeded') result.succeeded += 1;
      else if (status === 'skipped') result.skipped += 1;
      else if (status === 'needs_review') {
        result.needsReview += 1;
        recordTelemetry('inventory.adjustment_needs_review', {
          operation: 'process', outcome: 'needs_review',
          effect_type: adjustment.kind, attempt: adjustment.attempt_count,
          retryable: false, trigger: options.orderId ? 'request' : 'recovery',
        });
      }
      else result.ownershipLost += 1;
    } catch (error) {
      await failInventoryAdjustment(
        database,
        adjustment,
        error,
        options.now?.() ?? new Date()
      );
      recordTelemetry(
        adjustment.attempt_count >= 3
          ? 'inventory.adjustment_repeated_failure'
          : 'inventory.adjustment_first_attempt_failed',
        {
          operation: 'process', outcome: 'retry_scheduled',
          effect_type: adjustment.kind, attempt: adjustment.attempt_count,
          retryable: true, trigger: options.orderId ? 'request' : 'recovery',
        },
        error,
      );
      result.failed += 1;
    }
  }
  return result;
}

export async function runPaidOrderInventoryEffect(
  order: Order,
  options: { database?: D1Database; now?: () => Date } = {}
): Promise<InventoryAdjustmentDrainResult> {
  if (!order.id || order.payment_status !== 'paid') {
    throw new Error('Inventory decrement requires an authoritatively paid order');
  }
  const database = await resolveDatabase(options.database);
  await stagePaidInventoryAdjustments(order, {
    database,
    now: options.now?.() ?? new Date(),
  });
  const result = await drainInventoryAdjustments({
    database,
    orderId: order.id,
    kind: 'paid_decrement',
    limit: 100,
    now: options.now,
  });
  const remaining = await database.prepare(`
SELECT COUNT(*) AS count
FROM inventory_adjustments
WHERE order_id = ? AND kind = 'paid_decrement'
  AND status NOT IN ('succeeded', 'skipped', 'needs_review')
`).bind(order.id).first<{ count: number }>();
  if ((remaining?.count ?? 0) > 0) {
    throw new Error('Paid inventory adjustments remain retryable');
  }
  return result;
}
