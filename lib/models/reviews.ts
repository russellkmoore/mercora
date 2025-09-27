import { and, eq, inArray, gte, lte, desc, sql } from 'drizzle-orm';
import { getDbAsync } from '@/lib/db';
import { orders } from '@/lib/db/schema/order';
import { customers } from '@/lib/db/schema/customer';
import {
  product_reviews,
  review_media,
  review_flags,
  review_reminders,
  type ProductReviewRow,
  type ReviewMediaRow,
  type ReviewFlagRow,
  type ReviewReminderRow
} from '@/lib/db/schema/reviews';
import { products } from '@/lib/db/schema/products';
import { analyzeReviewContent } from '@/lib/ai/moderation';
import type {
  OrderItem,
  Review,
  ReviewMedia,
  ReviewModerationSummary,
  ReviewSubmissionPayload,
  ReviewStatus,
  ReviewFlagStatus,
  ReviewQueueResult,
  ReviewModerationMetrics,
  ReviewReminderCandidate,
  ReviewListOptions,
  ProductReviewEligibility,
} from '@/lib/types';
import { sendReviewReminderEmail, sendReviewStatusNotification } from '@/lib/utils/review-notifications';

interface SubmitReviewInput extends ReviewSubmissionPayload {
  customerId: string;
}

interface ReviewQueueOptions {
  statuses?: ReviewStatus[];
  flaggedOnly?: boolean;
  productId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

interface ReviewStatusUpdateInput {
  reviewId: string;
  status: ReviewStatus;
  moderatorId: string;
  moderationNotes?: string | null;
  notifyCustomer?: boolean;
}

interface ReviewResponseInput {
  reviewId: string;
  response: string;
  adminId: string;
  notifyCustomer?: boolean;
}

interface ReviewFlagInput {
  reviewId: string;
  reason: string;
  notes?: string;
  flaggedBy?: string | null;
}

interface ReminderQueryOptions {
  minDaysSinceDelivery?: number;
  maxDaysSinceDelivery?: number;
  limit?: number;
}

const BLOCKED_TERMS = ['porn', 'xxx', 'nazi', 'terror'];
const PROFANITY = ['fuck', 'shit', 'bitch', 'asshole'];

function parseJsonField<T>(value: any): T | undefined {
  if (!value) return undefined;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return undefined;
  }
}

function parseProductName(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'string') return parsed;
      if (parsed && typeof parsed === 'object') {
        const first = Object.values(parsed as Record<string, unknown>).find((entry) => typeof entry === 'string');
        if (typeof first === 'string') {
          return first;
        }
      }
    } catch {
      return value;
    }
    return value;
  }

  if (typeof value === 'object') {
    const first = Object.values(value as Record<string, unknown>).find((entry) => typeof entry === 'string');
    if (typeof first === 'string') {
      return first;
    }
  }

  return String(value);
}

function extractCustomerContact(customer?: CustomerRow | null, order?: OrderRow | null) {
  let email: string | null = null;
  let name: string | null = null;

  if (customer?.person) {
    const person = parseJsonField<{ email?: string; first_name?: string; last_name?: string; full_name?: string }>(
      customer.person
    );
    if (person) {
      email = person.email ?? email;
      const fallbackName = [person.first_name, person.last_name].filter(Boolean).join(' ');
      name = person.full_name ?? (fallbackName || name);
    }
  }

  if (!email && customer?.company) {
    const company = parseJsonField<{ email?: string; name?: string }>(customer.company);
    if (company?.email) {
      email = company.email;
    }
    if (company?.name && !name) {
      name = company.name;
    }
  }

  if (!email && order?.extensions) {
    const extensions = parseJsonField<Record<string, any>>(order.extensions);
    const extEmail = typeof extensions?.email === 'string' ? extensions.email : undefined;
    if (extEmail) {
      email = extEmail;
    }
  }

  if (!name && order?.shipping_address) {
    const shipping = parseJsonField<Record<string, any>>(order.shipping_address);
    const shippingName =
      (typeof shipping?.recipient === 'string' && shipping.recipient) ||
      (typeof shipping?.name === 'string' && shipping.name) ||
      null;
    if (shippingName) {
      name = shippingName;
    }
  }

  return { email, name };
}

function deserializeReview(
  row: ProductReviewRow,
  mediaRows: ReviewMediaRow[],
  flagRows: ReviewFlagRow[] = []
): Review {
  return {
    id: row.id!,
    product_id: row.product_id,
    order_id: row.order_id,
    order_item_id: row.order_item_id ?? undefined,
    customer_id: row.customer_id,
    rating: row.rating,
    title: row.title ?? undefined,
    body: row.body ?? undefined,
    status: row.status as ReviewStatus,
    is_verified: Boolean(row.is_verified),
    automated_moderation: parseJsonField<ReviewModerationSummary>(row.automated_moderation) ?? null,
    moderation_notes: row.moderation_notes ?? null,
    admin_response: row.admin_response ?? null,
    response_author_id: row.response_author_id ?? null,
    responded_at: row.responded_at ?? null,
    submitted_at: row.submitted_at ?? null,
    published_at: row.published_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    metadata: parseJsonField<Record<string, any>>(row.metadata) ?? null,
    media: mediaRows.map((media) => ({
      id: media.id ?? undefined,
      review_id: media.review_id ?? undefined,
      type: (media.type as ReviewMedia['type']) ?? 'image',
      url: media.url,
      alt_text: media.alt_text ?? undefined,
      metadata: parseJsonField<Record<string, any>>(media.metadata) ?? undefined,
      created_at: media.created_at ?? undefined,
    })),
    flags: flagRows.map((flag) => ({
      id: flag.id!,
      review_id: flag.review_id,
      flagged_by: flag.flagged_by ?? null,
      reason: flag.reason,
      notes: flag.notes ?? null,
      status: (flag.status as ReviewFlagStatus) ?? 'open',
      created_at: flag.created_at ?? null,
      resolved_at: flag.resolved_at ?? null,
    })),
    open_flag_count: flagRows.filter((flag) => flag.status === 'open').length || undefined,
  };
}

function dedupe(values: string[] = []): string[] | undefined {
  if (!values.length) return undefined;
  return Array.from(new Set(values.filter(Boolean)));
}

function buildQueueWhereClause(options: ReviewQueueOptions) {
  const conditions: any[] = [];

  if (options.productId) {
    conditions.push(eq(product_reviews.product_id, options.productId));
  }

  if (options.statuses?.length) {
    conditions.push(inArray(product_reviews.status, options.statuses));
  }

  if (options.flaggedOnly) {
    conditions.push(
      sql`(${product_reviews.status} IN ('needs_review','auto_rejected') OR EXISTS (
        SELECT 1 FROM ${review_flags} rf
        WHERE rf.review_id = ${product_reviews.id}
          AND rf.status = 'open'
      ))`
    );
  }

  const search = options.search?.trim().toLowerCase();
  if (search) {
    const likeTerm = `%${search}%`;
    conditions.push(
      sql`(
        LOWER(${product_reviews.body}) LIKE ${likeTerm}
        OR LOWER(${product_reviews.title}) LIKE ${likeTerm}
        OR LOWER(${products.name}) LIKE ${likeTerm}
      )`
    );
  }

  if (!conditions.length) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return and(...conditions);
}

async function runAutomatedModeration(body: string, title?: string): Promise<ReviewModerationSummary> {
  const text = `${title ?? ''} ${body}`.toLowerCase();
  const detectedPhrases: string[] = [];
  const reasons: string[] = [];
  const warnings: string[] = [];

  let flagged = false;
  let blocked = false;

  for (const term of BLOCKED_TERMS) {
    if (text.includes(term)) {
      blocked = true;
      detectedPhrases.push(term);
    }
  }

  for (const term of PROFANITY) {
    if (text.includes(term)) {
      flagged = true;
      detectedPhrases.push(term);
    }
  }

  const urlPattern = /(https?:\/\/|www\.)/i;
  if (urlPattern.test(text)) {
    flagged = true;
    reasons.push('contains_external_link');
  }

  if (body.length < 30) {
    warnings.push('body_too_short');
  }

  if (blocked) {
    reasons.push('blocked_term_detected');
  } else if (flagged && !reasons.length) {
    reasons.push('potential_profanity');
  }

  const summary: ReviewModerationSummary = {
    flagged: flagged || blocked,
    blocked,
    reasons,
    warnings: warnings.length ? warnings : undefined,
    detectedPhrases: detectedPhrases.length ? detectedPhrases : undefined,
  };

  try {
    const aiSummary = await analyzeReviewContent({ body, title });
    if (aiSummary) {
      summary.flagged = summary.flagged || aiSummary.flagged || aiSummary.blocked;
      summary.blocked = summary.blocked || aiSummary.blocked;
      summary.reasons = dedupe([...summary.reasons, ...(aiSummary.reasons ?? [])]) ?? [];
      const mergedWarnings = dedupe([...(summary.warnings ?? []), ...(aiSummary.warnings ?? [])]);
      summary.warnings = mergedWarnings;
      if (aiSummary.detectedPhrases?.length) {
        summary.detectedPhrases = dedupe([...(summary.detectedPhrases ?? []), ...aiSummary.detectedPhrases]);
      }
    }
  } catch (error) {
    console.error('AI moderation failed, falling back to heuristics', error);
  }

  summary.flagged = summary.flagged || summary.blocked || summary.reasons.length > 0;

  return summary;
}

type DbClient = Awaited<ReturnType<typeof getDbAsync>>;
type OrderRow = typeof orders.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;
type ProductReviewInsert = typeof product_reviews.$inferInsert;

async function recalcProductRating(productId: string, db?: DbClient) {
  const database = db ?? (await getDbAsync());
  const published = await database
    .select({
      id: product_reviews.id,
      rating: product_reviews.rating,
      publishedAt: product_reviews.published_at,
    })
    .from(product_reviews)
    .where(and(eq(product_reviews.product_id, productId), eq(product_reviews.status, 'published')));

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let lastPublishedAt: string | null = null;

  for (const row of published) {
    const rating = Math.min(Math.max(row.rating ?? 0, 1), 5);
    distribution[rating] = (distribution[rating] ?? 0) + 1;
    sum += rating;
    if (row.publishedAt) {
      const current = new Date(row.publishedAt).getTime();
      const previous = lastPublishedAt ? new Date(lastPublishedAt).getTime() : 0;
      if (!Number.isNaN(current) && (lastPublishedAt === null || current > previous)) {
        lastPublishedAt = row.publishedAt;
      }
    }
  }

  const count = published.length;
  const average = count > 0 ? Number((sum / count).toFixed(2)) : 0;

  const ratingPayload: Record<string, unknown> = {
    average,
    count,
    distribution,
  };

  if (lastPublishedAt) {
    ratingPayload.lastPublishedAt = lastPublishedAt;
  }

  await database
    .update(products)
    .set({ rating: JSON.stringify(ratingPayload) })
    .where(eq(products.id, productId));
}

async function getReviewById(id: string, db?: DbClient): Promise<Review | null> {
  const database = db ?? (await getDbAsync());
  const rows = await database.select().from(product_reviews).where(eq(product_reviews.id, id)).limit(1);
  if (!rows.length) {
    return null;
  }

  const mediaRows = await database
    .select()
    .from(review_media)
    .where(eq(review_media.review_id, id));

  const flagRows = await database
    .select()
    .from(review_flags)
    .where(eq(review_flags.review_id, id));

  return deserializeReview(rows[0], mediaRows, flagRows);
}

async function loadReviewContext(reviewId: string, db?: DbClient) {
  const database = db ?? (await getDbAsync());
  const rows = await database
    .select({
      review: product_reviews,
      order: orders,
      productName: products.name,
      productSlug: products.slug,
      customer: customers,
    })
    .from(product_reviews)
    .leftJoin(orders, eq(orders.id, product_reviews.order_id))
    .leftJoin(products, eq(products.id, product_reviews.product_id))
    .leftJoin(customers, eq(customers.id, product_reviews.customer_id))
    .where(eq(product_reviews.id, reviewId))
    .limit(1);

  if (!rows.length) {
    return null;
  }

  const row = rows[0];
  const { email, name } = extractCustomerContact(row.customer, row.order);
  const orderItems = row.order?.items ? parseJsonField<OrderItem[]>(row.order.items) ?? [] : [];
  const matchingItem = orderItems.find((item) => {
    if (!item) return false;
    if (row.review.order_item_id && item.id) {
      return item.id === row.review.order_item_id;
    }
    return item.product_id === row.review.product_id;
  });

  return {
    review: row.review,
    order: row.order,
    productName: parseProductName(row.productName),
    productSlug:
      typeof row.productSlug === 'string'
        ? row.productSlug
        : parseProductName(row.productSlug),
    customerEmail: email,
    customerName: name,
    orderItem: matchingItem,
  } as const;
}

export async function getReviewsForOrder(orderId: string, customerId: string): Promise<Review[]> {
  const db = await getDbAsync();
  const rows = await db
    .select()
    .from(product_reviews)
    .where(and(eq(product_reviews.order_id, orderId), eq(product_reviews.customer_id, customerId)));

  if (!rows.length) {
    return [];
  }

  const ids = rows.map((row) => row.id!).filter(Boolean);
  const mediaRows = ids.length
    ? await db
        .select()
        .from(review_media)
        .where(inArray(review_media.review_id, ids))
    : [];
  const flagRows = ids.length
    ? await db
        .select()
        .from(review_flags)
        .where(inArray(review_flags.review_id, ids))
    : [];

  return rows.map((row) =>
    deserializeReview(
      row,
      mediaRows.filter((media) => media.review_id === row.id),
      flagRows.filter((flag) => flag.review_id === row.id)
    )
  );
}

export async function getProductReviews(options: ReviewListOptions = {}): Promise<Review[]> {
  const db = await getDbAsync();
  const opts = options ?? {};
  const conditions = [] as any[];

  if (opts.productId) {
    conditions.push(eq(product_reviews.product_id, opts.productId));
  }

  if (opts.status?.length) {
    conditions.push(inArray(product_reviews.status, opts.status));
  }

  if (typeof opts.minRating === 'number') {
    conditions.push(gte(product_reviews.rating, Math.max(1, Math.min(5, Math.floor(opts.minRating)))));
  }

  if (typeof opts.maxRating === 'number') {
    conditions.push(lte(product_reviews.rating, Math.max(1, Math.min(5, Math.ceil(opts.maxRating)))));
  }

  const query = db
    .select()
    .from(product_reviews);

  if (conditions.length === 1) {
    query.where(conditions[0]);
  } else if (conditions.length > 1) {
    query.where(and(...conditions));
  }

  const limit = opts.limit && opts.limit > 0 ? Math.min(opts.limit, 200) : 50;
  query.limit(limit);

  if (opts.offset && opts.offset > 0) {
    query.offset(opts.offset);
  }

  query.orderBy(desc(product_reviews.published_at), desc(product_reviews.created_at));

  const rows = await query;

  if (!rows.length) {
    return [];
  }

  const ids = rows.map((row) => row.id!).filter(Boolean);
  const mediaRows = ids.length
    ? await db
        .select()
        .from(review_media)
        .where(inArray(review_media.review_id, ids))
    : [];
  const flagRows = ids.length
    ? await db
        .select()
        .from(review_flags)
        .where(inArray(review_flags.review_id, ids))
    : [];

  return rows.map((row) =>
    deserializeReview(
      row,
      mediaRows.filter((media) => media.review_id === row.id),
      flagRows.filter((flag) => flag.review_id === row.id)
    )
  );
}

export async function getProductReviewEligibility(input: {
  productId: string;
  customerId?: string | null;
}): Promise<ProductReviewEligibility> {
  const { productId, customerId } = input;

  if (!productId) {
    throw new Error('Product ID is required to determine review eligibility.');
  }

  if (!customerId) {
    return {
      requiresAuth: true,
      hasEligibleOrder: false,
      hasSubmittedReview: false,
      canReview: false,
    };
  }

  const db = await getDbAsync();

  const [existingReview] = await db
    .select({ id: product_reviews.id })
    .from(product_reviews)
    .where(
      and(
        eq(product_reviews.product_id, productId),
        eq(product_reviews.customer_id, customerId)
      )
    )
    .limit(1);

  const hasSubmittedReview = Boolean(existingReview?.id);

  const orderRows = await db
    .select({ order: orders })
    .from(orders)
    .where(
      and(
        eq(orders.customer_id, customerId),
        sql`(${orders.status} IN ('delivered','refunded') OR ${orders.delivered_at} IS NOT NULL)`
      )
    );

  let hasEligibleOrder = false;

  for (const row of orderRows) {
    const order = row.order;
    if (!order) continue;

    const items: OrderItem[] = Array.isArray(order.items)
      ? (order.items as OrderItem[])
      : parseJsonField<OrderItem[]>(order.items) ?? [];

    const matchesProduct = items.some((item) => item?.product_id === productId);
    if (matchesProduct) {
      hasEligibleOrder = true;
      break;
    }
  }

  return {
    requiresAuth: false,
    hasEligibleOrder,
    hasSubmittedReview,
    canReview: hasEligibleOrder && !hasSubmittedReview,
  };
}

export async function submitReviewForOrderItem(input: SubmitReviewInput): Promise<Review> {
  if (!input.orderId) {
    throw new Error('Order ID is required.');
  }
  if (!input.productId) {
    throw new Error('Product ID is required.');
  }
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error('Rating must be an integer between 1 and 5.');
  }

  const body = input.body?.trim() ?? '';
  if (body.length < 30) {
    throw new Error('Review body must be at least 30 characters long.');
  }

  const title = input.title?.trim();

  const db = await getDbAsync();
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, input.orderId))
    .limit(1);

  if (!orderRows.length) {
    throw new Error('Order not found.');
  }

  const order = orderRows[0];

  if (!order.customer_id || order.customer_id !== input.customerId) {
    throw new Error('You can only review products from your own orders.');
  }

  const isDelivered =
    order.status === 'delivered' ||
    order.status === 'refunded' ||
    Boolean(order.delivered_at);
  if (!isDelivered) {
    throw new Error('You can only review items after the order has been delivered or returned.');
  }

  const orderItems: OrderItem[] = Array.isArray(order.items)
    ? (order.items as OrderItem[])
    : parseJsonField<OrderItem[]>(order.items) ?? [];

  const matchingItem = orderItems.find((item) => {
    if (input.orderItemId && item.id && item.id === input.orderItemId) {
      return true;
    }
    return item.product_id === input.productId;
  });

  if (!matchingItem) {
    throw new Error('Order item could not be found for review.');
  }

  const existing = await db
    .select({ id: product_reviews.id })
    .from(product_reviews)
    .where(
      and(
        eq(product_reviews.order_id, input.orderId),
        eq(product_reviews.customer_id, input.customerId),
        eq(product_reviews.product_id, input.productId)
      )
    )
    .limit(1);

  if (existing.length) {
    throw new Error('You have already submitted a review for this item.');
  }

  const moderation = await runAutomatedModeration(body, title);
  if (moderation.blocked) {
    throw new Error('Review contains prohibited content.');
  }

  const status: ReviewStatus = moderation.flagged ? 'needs_review' : 'pending';
  const timestamp = new Date().toISOString();

  const [created] = await db
    .insert(product_reviews)
    .values({
      product_id: input.productId,
      order_id: input.orderId,
      order_item_id: input.orderItemId ?? matchingItem.id ?? null,
      customer_id: input.customerId,
      rating: input.rating,
      title: title ?? null,
      body,
      status,
      is_verified: true,
      automated_moderation: JSON.stringify(moderation),
      submitted_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    })
    .returning();

  if (!created) {
    throw new Error('Failed to create review.');
  }

  if (input.media?.length) {
    const mediaInserts = input.media.map((media) => ({
      review_id: created.id!,
      type: media.type ?? 'image',
      url: media.url,
      alt_text: media.alt_text,
      metadata: media.alt_text ? JSON.stringify({ alt_text: media.alt_text }) : null,
    }));

    await db.insert(review_media).values(mediaInserts);
  }

  await recalcProductRating(input.productId, db);

  const review = await getReviewById(created.id!, db);
  if (!review) {
    throw new Error('Review was created but could not be retrieved.');
  }

  return review;
}

export async function getReviewQueue(options: ReviewQueueOptions = {}): Promise<ReviewQueueResult> {
  const db = await getDbAsync();
  const whereClause = buildQueueWhereClause(options);

  const query = db
    .select({
      review: product_reviews,
      productName: products.name,
      productSlug: products.slug,
    })
    .from(product_reviews)
    .leftJoin(products, eq(products.id, product_reviews.product_id));

  if (whereClause) {
    query.where(whereClause);
  }

  query.orderBy(desc(product_reviews.submitted_at), desc(product_reviews.created_at));

  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
  query.limit(limit);
  if (options.offset) {
    query.offset(Math.max(0, options.offset));
  }

  const rows = await query;
  const ids = rows.map((row) => row.review.id!).filter(Boolean);

  if (!ids.length) {
    const countQuery = db
      .select({ value: sql<number>`COUNT(*)` })
      .from(product_reviews)
      .leftJoin(products, eq(products.id, product_reviews.product_id));

    if (whereClause) {
      countQuery.where(whereClause);
    }

    const [countRow] = await countQuery;
    return { items: [], total: countRow?.value ?? 0 };
  }

  const mediaRows = await db
    .select()
    .from(review_media)
    .where(inArray(review_media.review_id, ids));

  const flagRows = await db
    .select()
    .from(review_flags)
    .where(inArray(review_flags.review_id, ids));

  const items = rows.map((row) => {
    const review = deserializeReview(
      row.review,
      mediaRows.filter((media) => media.review_id === row.review.id),
      flagRows.filter((flag) => flag.review_id === row.review.id)
    );
    review.product_name = parseProductName(row.productName);
    review.product_slug =
      typeof row.productSlug === 'string' ? row.productSlug : parseProductName(row.productSlug);
    review.open_flag_count = review.flags?.filter((flag) => flag.status === 'open').length ?? 0;
    return review;
  });

  const countQuery = db
    .select({ value: sql<number>`COUNT(*)` })
    .from(product_reviews)
    .leftJoin(products, eq(products.id, product_reviews.product_id));

  if (whereClause) {
    countQuery.where(whereClause);
  }

  const [countRow] = await countQuery;

  return {
    items,
    total: countRow?.value ?? items.length,
  };
}

export async function getReviewModerationMetrics(): Promise<ReviewModerationMetrics> {
  const db = await getDbAsync();
  const metrics: ReviewModerationMetrics = {
    total: 0,
    pending: 0,
    needs_review: 0,
    published: 0,
    suppressed: 0,
    auto_rejected: 0,
    flagged: 0,
    last_published_at: null,
  };

  const statusRows = await db
    .select({ status: product_reviews.status, count: sql<number>`COUNT(*)` })
    .from(product_reviews)
    .groupBy(product_reviews.status);

  for (const row of statusRows) {
    metrics.total += row.count ?? 0;
    switch (row.status) {
      case 'pending':
        metrics.pending = row.count ?? 0;
        break;
      case 'needs_review':
        metrics.needs_review = row.count ?? 0;
        break;
      case 'published':
        metrics.published = row.count ?? 0;
        break;
      case 'suppressed':
        metrics.suppressed = row.count ?? 0;
        break;
      case 'auto_rejected':
        metrics.auto_rejected = row.count ?? 0;
        break;
      default:
        break;
    }
  }

  const [flaggedRow] = await db
    .select({
      value: sql<number>`COUNT(*)`,
    })
    .from(product_reviews)
    .where(
      sql`(${product_reviews.status} IN ('needs_review','auto_rejected') OR EXISTS (
        SELECT 1 FROM ${review_flags} rf
        WHERE rf.review_id = ${product_reviews.id}
          AND rf.status = 'open'
      ))`
    );

  metrics.flagged = flaggedRow?.value ?? 0;

  const [lastPublished] = await db
    .select({
      value: sql<string | null>`MAX(${product_reviews.published_at})`,
    })
    .from(product_reviews)
    .where(eq(product_reviews.status, 'published'));

  metrics.last_published_at = lastPublished?.value ?? null;

  return metrics;
}

export async function updateReviewStatus(input: ReviewStatusUpdateInput): Promise<Review> {
  const db = await getDbAsync();
  const [current] = await db
    .select()
    .from(product_reviews)
    .where(eq(product_reviews.id, input.reviewId))
    .limit(1);

  if (!current) {
    throw new Error('Review not found.');
  }

  const timestamp = new Date().toISOString();
  const updates: Partial<ProductReviewInsert> = {
    status: input.status,
    updated_at: timestamp,
    moderation_notes: input.moderationNotes ?? current.moderation_notes ?? null,
  };

  if (input.status === 'published') {
    updates.published_at = current.published_at ?? timestamp;
  } else if (current.status === 'published') {
    updates.published_at = null;
  }

  await db.update(product_reviews).set(updates).where(eq(product_reviews.id, input.reviewId));

  if (current.status === 'published' || input.status === 'published') {
    await recalcProductRating(current.product_id, db);
  }

  if (input.status === 'published' || input.status === 'suppressed' || input.status === 'auto_rejected') {
    await db
      .update(review_flags)
      .set({ status: 'resolved', resolved_at: timestamp })
      .where(and(eq(review_flags.review_id, input.reviewId), eq(review_flags.status, 'open')));
  }

  const review = await getReviewById(input.reviewId, db);
  if (!review) {
    throw new Error('Review not found.');
  }

  if (input.notifyCustomer) {
    const context = await loadReviewContext(input.reviewId, db);
    if (context?.customerEmail) {
      try {
        await sendReviewStatusNotification({
          email: context.customerEmail,
          name: context.customerName ?? undefined,
          productName: context.productName ?? 'your purchase',
          status: review.status,
          reviewBody: review.body ?? undefined,
          rating: review.rating,
          event: 'status_change',
        });
      } catch (error) {
        console.error('Failed to send review status notification', error);
      }
    }
  }

  return review;
}

export async function respondToReview(input: ReviewResponseInput): Promise<Review> {
  const db = await getDbAsync();
  const [current] = await db
    .select()
    .from(product_reviews)
    .where(eq(product_reviews.id, input.reviewId))
    .limit(1);

  if (!current) {
    throw new Error('Review not found.');
  }

  const timestamp = new Date().toISOString();
  await db
    .update(product_reviews)
    .set({
      admin_response: input.response,
      response_author_id: input.adminId,
      responded_at: timestamp,
      updated_at: timestamp,
    })
    .where(eq(product_reviews.id, input.reviewId));

  const review = await getReviewById(input.reviewId, db);
  if (!review) {
    throw new Error('Review not found.');
  }

  if (input.notifyCustomer) {
    const context = await loadReviewContext(input.reviewId, db);
    if (context?.customerEmail) {
      try {
        await sendReviewStatusNotification({
          email: context.customerEmail,
          name: context.customerName ?? undefined,
          productName: context.productName ?? 'your purchase',
          status: review.status,
          adminResponse: input.response,
          reviewBody: review.body ?? undefined,
          rating: review.rating,
          event: 'response',
        });
      } catch (error) {
        console.error('Failed to send review response notification', error);
      }
    }
  }

  return review;
}

export async function recordReviewFlag(input: ReviewFlagInput): Promise<Review> {
  const db = await getDbAsync();
  const [existing] = await db
    .select()
    .from(product_reviews)
    .where(eq(product_reviews.id, input.reviewId))
    .limit(1);

  if (!existing) {
    throw new Error('Review not found.');
  }

  const timestamp = new Date().toISOString();
  await db.insert(review_flags).values({
    review_id: input.reviewId,
    reason: input.reason,
    notes: input.notes ?? null,
    flagged_by: input.flaggedBy ?? null,
    status: 'open',
    created_at: timestamp,
  });

  return (await getReviewById(input.reviewId, db))!;
}

export async function findReviewReminderCandidates(
  options: ReminderQueryOptions = {}
): Promise<ReviewReminderCandidate[]> {
  const db = await getDbAsync();
  const minDays = Math.max(options.minDaysSinceDelivery ?? 3, 1);
  const maxDays = Math.max(options.maxDaysSinceDelivery ?? 30, minDays);
  const now = Date.now();
  const minTimestamp = new Date(now - maxDays * 24 * 60 * 60 * 1000).toISOString();
  const maxTimestamp = new Date(now - minDays * 24 * 60 * 60 * 1000).toISOString();

  const ordersQuery = db
    .select({ order: orders, customer: customers })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customer_id))
    .where(
      and(
        sql`${orders.delivered_at} IS NOT NULL`,
        gte(orders.delivered_at, minTimestamp),
        lte(orders.delivered_at, maxTimestamp)
      )
    )
    .orderBy(desc(orders.delivered_at))
    .limit(Math.min(options.limit ?? 100, 200));

  const orderRows = await ordersQuery;
  if (!orderRows.length) {
    return [];
  }

  const orderIds = orderRows.map((row) => row.order.id!).filter(Boolean);
  const existingReviews = orderIds.length
    ? await db
        .select({ order_id: product_reviews.order_id, product_id: product_reviews.product_id })
        .from(product_reviews)
        .where(inArray(product_reviews.order_id, orderIds))
    : [];

  const reviewSet = new Set<string>();
  for (const review of existingReviews) {
    if (review.order_id && review.product_id) {
      reviewSet.add(`${review.order_id}:${review.product_id}`);
    }
  }

  const reminderRows = orderIds.length
    ? await db
        .select()
        .from(review_reminders)
        .where(inArray(review_reminders.order_id, orderIds))
    : [];

  const remindedSet = new Set<string>();
  for (const reminder of reminderRows) {
    remindedSet.add(`${reminder.order_id}:${reminder.product_id}`);
  }

  const candidates: ReviewReminderCandidate[] = [];
  const productIds = new Set<string>();

  for (const row of orderRows) {
    const order = row.order;
    const { email, name } = extractCustomerContact(row.customer, order);
    const items = parseJsonField<OrderItem[]>(order.items) ?? [];

    for (const item of items) {
      if (!item?.product_id) continue;
      const key = `${order.id}:${item.product_id}`;
      if (reviewSet.has(key) || remindedSet.has(key)) {
        continue;
      }

      candidates.push({
        orderId: order.id!,
        productId: item.product_id,
        deliveredAt: order.delivered_at!,
        customerId: order.customer_id ?? null,
        customerEmail: email,
        customerName: name,
        orderItemId: item.id,
        productName: null,
      });
      productIds.add(item.product_id);
    }
  }

  if (!candidates.length) {
    return [];
  }

  const productIdList = Array.from(productIds);
  if (productIdList.length) {
    const productRows = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(inArray(products.id, productIdList));

    const nameMap = new Map<string, string | null>();
    for (const product of productRows) {
      if (product.id) {
        nameMap.set(product.id, parseProductName(product.name));
      }
    }

    for (const candidate of candidates) {
      candidate.productName = nameMap.get(candidate.productId) ?? null;
    }
  }

  return candidates;
}

export async function sendReviewReminders(options: ReminderQueryOptions = {}) {
  const db = await getDbAsync();
  const candidates = await findReviewReminderCandidates(options);
  if (!candidates.length) {
    return { sent: 0, failed: [] as Array<{ candidate: ReviewReminderCandidate; error: string }> };
  }

  let sent = 0;
  const failures: Array<{ candidate: ReviewReminderCandidate; error: string }> = [];

  for (const candidate of candidates) {
    if (!candidate.customerEmail) {
      failures.push({ candidate, error: 'Missing customer email' });
      continue;
    }

    try {
      await sendReviewReminderEmail({
        email: candidate.customerEmail,
        name: candidate.customerName ?? undefined,
        productName: candidate.productName ?? 'your purchase',
        orderId: candidate.orderId,
      });
      await db.insert(review_reminders).values({
        order_id: candidate.orderId,
        product_id: candidate.productId,
        customer_id: candidate.customerId ?? undefined,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
      sent += 1;
    } catch (error) {
      failures.push({
        candidate,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      await db.insert(review_reminders).values({
        order_id: candidate.orderId,
        product_id: candidate.productId,
        customer_id: candidate.customerId ?? undefined,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        sent_at: new Date().toISOString(),
      });
    }
  }

  return { sent, failed: failures };
}
