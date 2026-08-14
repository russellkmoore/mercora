import type { ExecutionPlan } from "../../lib/config.js";
import type { BlogCategoryPlan, BlogPostPlan } from "../../transformers/blog.js";
import type { CategoryTransformRecord } from "../../transformers/categories.js";
import type { PageTransformRecord } from "../../transformers/pages.js";
import type { ProductTransformRecord } from "../../transformers/products.js";
import type { RedirectCandidate } from "../../transformers/redirects.js";
import {
  DEFAULT_D1_CHUNK_BYTES,
  DEFAULT_D1_CHUNK_STATEMENTS,
  MAX_D1_STATEMENT_BYTES,
  buildInsertStatement,
  sqlLiteral,
  type SqlRecord,
  type SqlScalar,
} from "./sql.js";

export const D1_DEPENDENCIES = [
  "categories",
  "products",
  "variants",
  "inventory",
  "pages",
  "page-versions",
  "blog-categories",
  "blog-posts",
  "customers",
  "orders",
  "reviews",
  "redirects",
] as const;

export type D1Dependency = (typeof D1_DEPENDENCIES)[number];

export interface MaterializedD1Input {
  categories?: readonly CategoryTransformRecord[];
  products?: readonly ProductTransformRecord[];
  pages?: readonly PageTransformRecord[];
  blog?: {
    categories: readonly BlogCategoryPlan[];
    records: readonly BlogPostPlan[];
  };
  /** Rows must already contain final Clerk user IDs, never provisioning IDs. */
  customers?: readonly object[];
  orders?: readonly { order: object }[];
  reviews?: readonly { review: object }[];
  redirects?: readonly RedirectCandidate[];
}

export interface D1PlanOptions {
  overwrite?: boolean;
  maxChunkBytes?: number;
  maxChunkStatements?: number;
}

export interface D1StatementUnit {
  dependency: D1Dependency;
  statements: readonly string[];
}

export interface D1ValidationUnit {
  dependency: D1Dependency | "references";
  sql: string;
}

export interface D1ImportPlan {
  overwrite: boolean;
  containsSensitiveRows: boolean;
  counts: Readonly<Record<D1Dependency, number>>;
  chunks: readonly string[];
  validation: readonly D1ValidationUnit[];
  requiredMediaPaths: readonly string[];
}

const TABLE_COLUMNS = {
  categories: new Set([
    "id", "name", "description", "slug", "status", "parent_id", "position", "path",
    "external_references", "created_at", "updated_at", "children", "product_count", "attributes",
    "tags", "primary_image", "media", "seo", "extensions",
  ]),
  products: new Set([
    "id", "name", "type", "status", "external_references", "created_at", "updated_at", "description",
    "slug", "brand", "categories", "tags", "options", "default_variant_id", "fulfillment_type",
    "tax_category", "primary_image", "media", "seo", "rating", "related_products", "extensions",
  ]),
  product_variants: new Set([
    "id", "product_id", "sku", "option_values", "price", "status", "position", "compare_at_price",
    "cost", "weight", "dimensions", "barcode", "inventory", "tax_category", "shipping_required", "media",
    "attributes", "created_at", "updated_at",
  ]),
  inventory: new Set([
    "id", "sku_id", "location_id", "quantities", "status", "stock_status", "external_references",
    "created_at", "updated_at", "policy_id", "backorderable", "backorder_eta", "safety_stock", "version",
    "extensions",
  ]),
  pages: new Set([
    "title", "slug", "content", "excerpt", "meta_title", "meta_description", "meta_keywords", "status",
    "published_at", "template", "parent_id", "sort_order", "created_at", "updated_at", "created_by",
    "updated_by", "version", "show_in_nav", "nav_title", "custom_css", "custom_js", "is_protected",
    "required_roles",
  ]),
  page_versions: new Set([
    "title", "content", "excerpt", "meta_title", "meta_description", "meta_keywords", "version",
    "change_summary", "created_at", "created_by",
  ]),
  blog_categories: new Set(["name", "slug", "description", "created_at", "updated_at"]),
  blog_posts: new Set([
    "title", "slug", "author", "excerpt", "tags", "cover_image_url", "cover_image_alt", "status",
    "editor_json", "html", "reading_time", "meta_title", "meta_description", "published_at", "created_at",
    "updated_at", "created_by", "updated_by",
  ]),
  customers: new Set([
    "id", "type", "status", "external_references", "created_at", "updated_at", "person", "company",
    "contacts", "addresses", "communication_preferences", "segments", "tags", "loyalty", "authentication",
    "extensions",
  ]),
  orders: new Set([
    "id", "customer_id", "status", "total_amount", "currency_code", "shipping_address", "billing_address",
    "items", "shipping_method", "shipping_carrier", "payment_method", "payment_status", "notes", "created_at",
    "updated_at", "shipped_at", "delivered_at", "tracking_number", "external_references", "extensions",
  ]),
  product_reviews: new Set([
    "id", "product_id", "order_id", "order_item_id", "customer_id", "rating", "title", "body", "status",
    "is_verified", "automated_moderation", "moderation_notes", "admin_response", "response_author_id",
    "responded_at", "submitted_at", "published_at", "created_at", "updated_at", "metadata",
  ]),
  redirect_map: new Set(["source_path", "target_path", "status_code", "entity_type", "created_at"]),
} as const;

type TableName = keyof typeof TABLE_COLUMNS;

const REQUIRED_COLUMNS: Readonly<Record<TableName, readonly string[]>> = {
  categories: ["id", "name"],
  products: ["id", "name", "default_variant_id"],
  product_variants: ["id", "product_id", "sku", "option_values", "price"],
  inventory: ["id", "sku_id", "location_id", "quantities"],
  pages: ["title", "slug", "content", "template", "created_by", "updated_by", "version"],
  page_versions: ["title", "content", "version", "created_by"],
  blog_categories: ["name", "slug"],
  blog_posts: ["title", "slug", "author", "tags", "html", "reading_time"],
  customers: ["id", "type"],
  orders: ["id", "total_amount", "currency_code", "items"],
  product_reviews: ["id", "product_id", "order_id", "customer_id", "rating", "body", "status"],
  redirect_map: ["source_path", "target_path", "status_code"],
};

function isSqlScalar(value: unknown): value is SqlScalar {
  return value === null || typeof value === "string" || typeof value === "boolean" ||
    (typeof value === "number" && Number.isSafeInteger(value));
}

function rowFor(table: TableName, value: object): SqlRecord {
  if (!value || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${table} row must be a plain object`);
  }
  const entries = Object.entries(value);
  if (entries.length < 1 || entries.length > 64) throw new TypeError(`${table} row has an invalid column count`);
  const allowed = TABLE_COLUMNS[table] as ReadonlySet<string>;
  for (const [column, scalar] of entries) {
    if (!allowed.has(column)) throw new TypeError(`${table} row contains an unknown column`);
    if (!isSqlScalar(scalar)) throw new TypeError(`${table} row contains a non-scalar value`);
  }
  for (const column of REQUIRED_COLUMNS[table]) {
    if (!Object.hasOwn(value, column) || value[column as keyof typeof value] === null) {
      throw new TypeError(`${table} row is missing a required column`);
    }
  }
  return Object.fromEntries(entries) as SqlRecord;
}

function requiredText(row: SqlRecord, column: string): string {
  const value = row[column];
  if (typeof value !== "string" || !value) throw new TypeError(`Required ${column} reference is invalid`);
  return value;
}

function unique(values: readonly string[], description: string): void {
  if (new Set(values).size !== values.length) throw new TypeError(`Duplicate ${description} in D1 plan`);
}

function mode(overwrite: boolean): "overwrite" | "compare" {
  return overwrite ? "overwrite" : "compare";
}

function boundedStatement(statement: string): string {
  if (!statement.endsWith(";") || Buffer.byteLength(statement, "utf8") > MAX_D1_STATEMENT_BYTES) {
    throw new RangeError("Generated D1 statement exceeds the statement safety limit");
  }
  return statement;
}

/** Compare an insert-only row without changing merchant content. A mismatch
 * assigns NULL to a NOT NULL guard so the enclosing Wrangler SQL batch aborts. */
function compareExistingStatement(
  table: TableName,
  row: SqlRecord,
  key: string,
  guard: string,
  ignored: readonly string[] = [],
  extraComparison?: string,
): string {
  const comparisons = [
    ...Object.entries(row)
    .filter(([column]) => !ignored.includes(column))
    .map(([column, value]) => `"${column}" IS ${sqlLiteral(value)}`),
    ...(extraComparison ? [extraComparison] : []),
  ].join(" AND ");
  if (!comparisons || row[guard] === null || row[guard] === undefined || row[key] === undefined) {
    throw new TypeError("Insert-only comparison requires a non-null guard and semantic fields");
  }
  return boundedStatement(
    `UPDATE "${table}" SET "${guard}" = CASE WHEN ${comparisons} THEN "${guard}" ELSE NULL END ` +
    `WHERE "${key}" = ${sqlLiteral(row[key])};`,
  );
}

function pageVersionStatement(slug: string, record: SqlRecord): string {
  const entries = Object.entries(record);
  const columns = ["page_id", ...entries.map(([column]) => column)];
  const values = entries.map(([, value]) => sqlLiteral(value));
  return boundedStatement(
    `INSERT INTO "page_versions" (${columns.map((column) => `"${column}"`).join(", ")}) ` +
    `SELECT "id", ${values.join(", ")} FROM "pages" WHERE "slug" = ${sqlLiteral(slug)} AND changes() = 1;`,
  );
}

function blogPostStatement(categorySlug: string, record: SqlRecord): string {
  const entries = Object.entries(record);
  const columns = [...entries.map(([column]) => column), "category_id"];
  const values = entries.map(([, value]) => sqlLiteral(value));
  return boundedStatement(
    `INSERT INTO "blog_posts" (${columns.map((column) => `"${column}"`).join(", ")}) ` +
    `SELECT ${values.join(", ")}, "id" FROM "blog_categories" WHERE "slug" = ${sqlLiteral(categorySlug)} ` +
    `ON CONFLICT ("slug") DO NOTHING;`,
  );
}

function chunkUnits(units: readonly D1StatementUnit[], options: D1PlanOptions): string[] {
  const maxBytes = options.maxChunkBytes ?? DEFAULT_D1_CHUNK_BYTES;
  const maxStatements = options.maxChunkStatements ?? DEFAULT_D1_CHUNK_STATEMENTS;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 256 || maxBytes > 16 * 1024 * 1024) {
    throw new RangeError("maxChunkBytes is outside the safe range");
  }
  if (!Number.isSafeInteger(maxStatements) || maxStatements < 3 || maxStatements > 10_000) {
    throw new RangeError("maxChunkStatements is outside the safe range");
  }
  const header = "PRAGMA foreign_keys = ON;\n";
  const chunks: string[] = [];
  let statements: string[] = [];
  let bytes = Buffer.byteLength(header, "utf8");
  for (const unit of units) {
    const unitText = `${unit.statements.join("\n")}\n`;
    const unitBytes = Buffer.byteLength(unitText, "utf8");
    if (unit.statements.length + 1 > maxStatements || unitBytes + Buffer.byteLength(header, "utf8") > maxBytes) {
      throw new RangeError("Atomic D1 statement unit exceeds the configured chunk limit");
    }
    if (statements.length && (statements.length + unit.statements.length + 1 > maxStatements || bytes + unitBytes > maxBytes)) {
      chunks.push(`${header}${statements.join("\n")}\n`);
      statements = [];
      bytes = Buffer.byteLength(header, "utf8");
    }
    statements.push(...unit.statements);
    bytes += unitBytes;
  }
  if (statements.length) chunks.push(`${header}${statements.join("\n")}\n`);
  return chunks;
}

function jsonStringArray(value: SqlScalar, field: string): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value !== "string") throw new TypeError(`${field} must be a JSON array`);
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new TypeError(`${field} must be valid JSON`); }
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string" && item.length > 0)) {
    throw new TypeError(`${field} must be a JSON string array`);
  }
  return parsed;
}

function orderItemReferences(value: SqlScalar): Array<{ id: string; productId: string; variantId?: string }> {
  if (typeof value !== "string") throw new TypeError("Order items must be JSON");
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new TypeError("Order items must be valid JSON"); }
  if (!Array.isArray(parsed) || !parsed.length || !parsed.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
    throw new TypeError("Order items must be a non-empty object array");
  }
  return parsed.map((item) => {
    const source = item as Record<string, unknown>;
    if (typeof source.id !== "string" || !source.id || typeof source.product_id !== "string" || !source.product_id) {
      throw new TypeError("Order item references are invalid");
    }
    if (source.variant_id !== undefined && (typeof source.variant_id !== "string" || !source.variant_id)) {
      throw new TypeError("Order variant reference is invalid");
    }
    return {
      id: source.id,
      productId: source.product_id,
      ...(typeof source.variant_id === "string" ? { variantId: source.variant_id } : {}),
    };
  });
}

const MEDIA_PATH = /\/media\/(?:products|categories|blog|pages)\/[A-Za-z0-9._/-]+/gu;

function mediaPaths(rows: readonly SqlRecord[]): string[] {
  const paths = new Set<string>();
  for (const row of rows) {
    for (const value of Object.values(row)) {
      if (typeof value !== "string") continue;
      for (const match of value.matchAll(MEDIA_PATH)) paths.add(match[0]);
    }
  }
  return [...paths].sort();
}

function validationQuery(table: string, key: string, values: readonly string[], joinSql = ""): D1ValidationUnit[] {
  const units: D1ValidationUnit[] = [];
  for (let offset = 0; offset < values.length; offset += 100) {
    const batch = values.slice(offset, offset + 100);
    const expected = batch.map((value) => `(${sqlLiteral(value)})`).join(", ");
    const exists = joinSql || `SELECT 1 FROM "${table}" AS row WHERE row."${key}" = expected.value`;
    units.push({
      dependency: D1_DEPENDENCIES.find((dependency) => dependency === table) ?? "references",
      sql: boundedStatement(
        `WITH expected(value) AS (VALUES ${expected}) ` +
        `SELECT COUNT(*) AS expected_count, COALESCE(SUM(EXISTS(${exists})), 0) AS actual_count FROM expected;`,
      ),
    });
  }
  return units;
}

function pageVersionValidation(pages: readonly { slug: string; actor: string }[]): D1ValidationUnit[] {
  const units: D1ValidationUnit[] = [];
  for (let offset = 0; offset < pages.length; offset += 100) {
    const batch = pages.slice(offset, offset + 100);
    const expected = batch.map(({ slug, actor }) => `(${sqlLiteral(slug)}, ${sqlLiteral(actor)})`).join(", ");
    units.push({
      dependency: "page-versions",
      sql: boundedStatement(
        `WITH expected(slug, actor) AS (VALUES ${expected}) ` +
        `SELECT COUNT(*) AS expected_count, COALESCE(SUM(EXISTS(` +
        `SELECT 1 FROM "pages" AS page WHERE page."slug" = expected.slug AND (` +
        `page."created_by" IS NOT expected.actor OR EXISTS(` +
        `SELECT 1 FROM "page_versions" AS version WHERE version."page_id" = page."id" ` +
        `AND version."version" = 1 AND version."created_by" = expected.actor` +
        `))` +
        `)), 0) AS actual_count FROM expected;`,
      ),
    });
  }
  return units;
}

export function assertExecutionGates(execution: ExecutionPlan, containsSensitiveRows: boolean): void {
  if (!(["local", "preview", "production"] as const).includes(execution.target)) {
    throw new Error("D1 execution target is invalid");
  }
  if (execution.apply === execution.dryRun) throw new Error("Exactly one of apply or dry-run must be selected");
  if (execution.target === "preview" && execution.apply && !execution.confirmedPreview) {
    throw new Error("Preview apply requires explicit confirmation");
  }
  if (execution.target === "production" && execution.apply && !execution.confirmedProduction) {
    throw new Error("Production apply requires explicit confirmation");
  }
  if (execution.overwrite && execution.apply && !execution.confirmedOverwrite) {
    throw new Error("Overwrite apply requires explicit confirmation");
  }
  if (!execution.overwrite && execution.confirmedOverwrite) {
    throw new Error("Overwrite confirmation requires overwrite mode");
  }
  if (containsSensitiveRows && (!execution.includeSensitive || !execution.confirmedSensitiveData)) {
    throw new Error("Sensitive rows require both inclusion and confirmation");
  }
}

export function buildD1ImportPlan(input: MaterializedD1Input, options: D1PlanOptions = {}): D1ImportPlan {
  const overwrite = options.overwrite === true;
  const units: D1StatementUnit[] = [];
  const allRows: SqlRecord[] = [];
  const counts = Object.fromEntries(D1_DEPENDENCIES.map((dependency) => [dependency, 0])) as Record<D1Dependency, number>;
  const ids: Record<"categories" | "products" | "variants" | "inventory" | "customers" | "orders" | "reviews", string[]> = {
    categories: [], products: [], variants: [], inventory: [], customers: [], orders: [], reviews: [],
  };
  const pageSlugs: string[] = [];
  const pageVersionReferences: Array<{ slug: string; actor: string }> = [];
  const blogCategorySlugs: string[] = [];
  const blogPostSlugs: string[] = [];
  const redirectPaths: string[] = [];

  for (const item of input.categories ?? []) {
    const row = rowFor("categories", item.category);
    const id = requiredText(row, "id");
    if (row.parent_id !== undefined && row.parent_id !== null &&
        (typeof row.parent_id !== "string" || !ids.categories.includes(row.parent_id))) {
      throw new TypeError("Category parent reference is unresolved or not dependency ordered");
    }
    ids.categories.push(id);
    allRows.push(row);
    units.push({ dependency: "categories", statements: [buildInsertStatement({
      table: "categories", row, conflictColumns: ["id"], mode: mode(overwrite), guardColumn: "name",
    })] });
    counts.categories += 1;
  }
  unique(ids.categories, "category ID");

  const variantRows: SqlRecord[] = [];
  const inventoryRows: SqlRecord[] = [];
  for (const item of input.products ?? []) {
    const product = rowFor("products", item.product);
    const productId = requiredText(product, "id");
    const ownVariants = item.variants.map((value) => rowFor("product_variants", value));
    const ownVariantIds = ownVariants.map((row) => requiredText(row, "id"));
    if (!ownVariants.length || !ownVariantIds.includes(requiredText(product, "default_variant_id"))) {
      throw new TypeError("Product default variant reference is unresolved");
    }
    if (ownVariants.some((row) => requiredText(row, "product_id") !== productId)) {
      throw new TypeError("Variant product reference is unresolved");
    }
    for (const categoryId of jsonStringArray(product.categories, "Product categories")) {
      if (!ids.categories.includes(categoryId)) throw new TypeError("Product category reference is unresolved");
    }
    const ownInventory = item.inventory.map((value) => rowFor("inventory", value));
    if (ownInventory.some((row) => !ownVariantIds.includes(requiredText(row, "sku_id")))) {
      throw new TypeError("Inventory variant reference is unresolved");
    }
    ids.products.push(productId);
    ids.variants.push(...ownVariantIds);
    ids.inventory.push(...ownInventory.map((row) => requiredText(row, "id")));
    allRows.push(product, ...ownVariants, ...ownInventory);
    units.push({ dependency: "products", statements: [buildInsertStatement({
      table: "products", row: product, conflictColumns: ["id"], mode: mode(overwrite), guardColumn: "name",
    })] });
    variantRows.push(...ownVariants);
    inventoryRows.push(...ownInventory);
    counts.products += 1;
    counts.variants += ownVariants.length;
    counts.inventory += ownInventory.length;
  }
  unique(ids.products, "product ID");
  unique(ids.variants, "variant ID");
  unique(ids.inventory, "inventory ID");
  for (const row of variantRows) units.push({ dependency: "variants", statements: [buildInsertStatement({
    table: "product_variants", row, conflictColumns: ["id"], mode: mode(overwrite), guardColumn: "product_id",
  })] });
  for (const row of inventoryRows) units.push({ dependency: "inventory", statements: [buildInsertStatement({
    table: "inventory", row, conflictColumns: ["id"], mode: mode(overwrite), guardColumn: "sku_id",
  })] });

  for (const item of input.pages ?? []) {
    const page = rowFor("pages", item.page);
    const version = rowFor("page_versions", item.initialVersion.record);
    const slug = requiredText(page, "slug");
    if (item.initialVersion.pageReference.provider !== "shopify" ||
        item.initialVersion.pageReference.sourceFingerprint !== item.sourceFingerprint ||
        item.initialVersion.pageReference.slug !== slug || item.conflict.strategy !== "insert-only") {
      throw new TypeError("Page version reference or conflict policy is invalid");
    }
    if (page.parent_id !== null) throw new TypeError("Imported pages cannot use unresolved auto-ID parents");
    const pageSnapshotColumns = ["excerpt", "meta_title", "meta_description", "meta_keywords", "custom_css", "custom_js"];
    const versionSnapshotColumns = ["excerpt", "meta_title", "meta_description", "meta_keywords"];
    if (!pageSnapshotColumns.every((column) => Object.hasOwn(page, column)) ||
        !versionSnapshotColumns.every((column) => Object.hasOwn(version, column)) ||
        page.version !== 1 || version.version !== 1 ||
        page.created_by !== version.created_by || page.updated_by !== version.created_by ||
        page.title !== version.title || page.content !== version.content ||
        page.excerpt !== version.excerpt || page.meta_title !== version.meta_title ||
        page.meta_description !== version.meta_description || page.meta_keywords !== version.meta_keywords ||
        typeof page.template !== "string" || !page.template.trim() || page.template.length > 100 ||
        page.custom_css !== null || page.custom_js !== null) {
      throw new TypeError("Initial page version must exactly match the supported page snapshot contract");
    }
    pageSlugs.push(slug);
    pageVersionReferences.push({ slug, actor: requiredText(page, "created_by") });
    allRows.push(page, version);
    units.push({ dependency: "page-versions", statements: [
      buildInsertStatement({ table: "pages", row: page, conflictColumns: ["slug"], mode: "insert-only" }),
      pageVersionStatement(slug, version),
      compareExistingStatement("pages", page, "slug", "title", ["created_at", "updated_at"]),
    ] });
    counts.pages += 1;
    counts["page-versions"] += 1;
  }
  unique(pageSlugs, "page slug");

  const categoriesByFingerprint = new Map<string, string>();
  for (const item of input.blog?.categories ?? []) {
    const row = rowFor("blog_categories", item.record);
    const slug = requiredText(row, "slug");
    if (item.conflict.strategy !== "insert-only") throw new TypeError("Blog category conflict policy is invalid");
    if (categoriesByFingerprint.has(item.sourceFingerprint)) throw new TypeError("Duplicate blog category fingerprint");
    categoriesByFingerprint.set(item.sourceFingerprint, slug);
    blogCategorySlugs.push(slug);
    allRows.push(row);
    units.push({ dependency: "blog-categories", statements: [
      buildInsertStatement({ table: "blog_categories", row, conflictColumns: ["slug"], mode: "insert-only" }),
      compareExistingStatement("blog_categories", row, "slug", "name", ["created_at", "updated_at"]),
    ] });
    counts["blog-categories"] += 1;
  }
  unique(blogCategorySlugs, "blog category slug");

  for (const item of input.blog?.records ?? []) {
    const row = rowFor("blog_posts", item.record);
    const slug = requiredText(row, "slug");
    const categorySlug = categoriesByFingerprint.get(item.categoryReference.sourceFingerprint);
    if (item.categoryReference.provider !== "shopify" || !categorySlug ||
        categorySlug !== item.categoryReference.slug || item.conflict.strategy !== "insert-only") {
      throw new TypeError("Blog post category reference or conflict policy is unresolved");
    }
    blogPostSlugs.push(slug);
    allRows.push(row);
    units.push({ dependency: "blog-posts", statements: [
      blogPostStatement(categorySlug, row),
      compareExistingStatement(
        "blog_posts",
        row,
        "slug",
        "title",
        ["created_at", "updated_at"],
        `"category_id" IS (SELECT "id" FROM "blog_categories" WHERE "slug" = ${sqlLiteral(categorySlug)})`,
      ),
    ] });
    counts["blog-posts"] += 1;
  }
  unique(blogPostSlugs, "blog post slug");

  const customerRows = (input.customers ?? []).map((value) => rowFor("customers", value));
  for (const row of customerRows) {
    const id = requiredText(row, "id");
    if (!/^user_[A-Za-z0-9]{8,250}$/.test(id)) throw new TypeError("Customer row lacks a final Clerk user ID");
    ids.customers.push(id);
    allRows.push(row);
    units.push({ dependency: "customers", statements: [buildInsertStatement({
      table: "customers", row, conflictColumns: ["id"], mode: mode(overwrite), guardColumn: "type",
    })] });
    counts.customers += 1;
  }
  unique(ids.customers, "customer ID");

  const orderReferences = new Map<string, {
    customerId: string | null;
    items: ReturnType<typeof orderItemReferences>;
  }>();
  for (const item of input.orders ?? []) {
    const row = rowFor("orders", item.order);
    const id = requiredText(row, "id");
    const customer = row.customer_id;
    if (customer !== null && (typeof customer !== "string" || !ids.customers.includes(customer))) {
      throw new TypeError("Order customer reference is unresolved");
    }
    const items = orderItemReferences(row.items);
    for (const reference of items) {
      if (!ids.products.includes(reference.productId) || (reference.variantId && !ids.variants.includes(reference.variantId))) {
        throw new TypeError("Order product or variant reference is unresolved");
      }
    }
    ids.orders.push(id);
    orderReferences.set(id, {
      customerId: typeof customer === "string" ? customer : null,
      items,
    });
    allRows.push(row);
    units.push({ dependency: "orders", statements: [buildInsertStatement({
      table: "orders", row, conflictColumns: ["id"], mode: mode(overwrite), guardColumn: "total_amount",
    })] });
    counts.orders += 1;
  }
  unique(ids.orders, "order ID");

  for (const item of input.reviews ?? []) {
    const row = rowFor("product_reviews", item.review);
    const id = requiredText(row, "id");
    const productId = requiredText(row, "product_id");
    const orderId = requiredText(row, "order_id");
    const customerId = requiredText(row, "customer_id");
    const purchase = orderReferences.get(orderId);
    if (!ids.products.includes(productId) || !purchase || !ids.customers.includes(customerId) ||
        purchase.customerId !== customerId) {
      throw new TypeError("Review product, order, or customer reference is unresolved");
    }
    const orderItemId = row.order_item_id;
    const matchingItems = purchase.items.filter((entry) => entry.productId === productId);
    if (!matchingItems.length || (orderItemId !== null && (
      typeof orderItemId !== "string" || !matchingItems.some((entry) => entry.id === orderItemId)
    ))) throw new TypeError("Review order-item and product provenance is unresolved");
    if (row.is_verified === true && orderItemId === null) {
      throw new TypeError("Verified review provenance requires an exact order-item reference");
    }
    ids.reviews.push(id);
    allRows.push(row);
    units.push({ dependency: "reviews", statements: [buildInsertStatement({
      table: "product_reviews", row, conflictColumns: ["id"], mode: mode(overwrite), guardColumn: "product_id",
    })] });
    counts.reviews += 1;
  }
  unique(ids.reviews, "review ID");

  for (const item of input.redirects ?? []) {
    const row = rowFor("redirect_map", {
      source_path: item.sourcePath,
      target_path: item.targetPath,
      status_code: item.statusCode,
      entity_type: item.entityType,
      created_at: 0,
    });
    redirectPaths.push(item.sourcePath);
    allRows.push(row);
    units.push({ dependency: "redirects", statements: [buildInsertStatement({
      table: "redirect_map", row, conflictColumns: ["source_path"], mode: mode(overwrite), guardColumn: "target_path",
    })] });
    counts.redirects += 1;
  }
  unique(redirectPaths, "redirect source path");

  const actualOrder = units.map((unit) => D1_DEPENDENCIES.indexOf(unit.dependency));
  if (actualOrder.some((value, index) => index > 0 && value < actualOrder[index - 1])) {
    throw new Error("Internal D1 dependency order is invalid");
  }

  const validation: D1ValidationUnit[] = [
    ...validationQuery("categories", "id", ids.categories),
    ...validationQuery("products", "id", ids.products),
    ...validationQuery("product_variants", "id", ids.variants,
      'SELECT 1 FROM "product_variants" AS row JOIN "products" AS parent ON parent."id" = row."product_id" WHERE row."id" = expected.value'),
    ...validationQuery("inventory", "id", ids.inventory,
      'SELECT 1 FROM "inventory" AS row JOIN "product_variants" AS parent ON parent."id" = row."sku_id" WHERE row."id" = expected.value'),
    ...validationQuery("pages", "slug", pageSlugs),
    ...pageVersionValidation(pageVersionReferences),
    ...validationQuery("blog_categories", "slug", blogCategorySlugs),
    ...validationQuery("blog_posts", "slug", blogPostSlugs,
      'SELECT 1 FROM "blog_posts" AS row JOIN "blog_categories" AS parent ON parent."id" = row."category_id" WHERE row."slug" = expected.value'),
    ...validationQuery("customers", "id", ids.customers),
    ...validationQuery("orders", "id", ids.orders,
      'SELECT 1 FROM "orders" AS row LEFT JOIN "customers" AS parent ON parent."id" = row."customer_id" WHERE row."id" = expected.value AND (row."customer_id" IS NULL OR parent."id" IS NOT NULL)'),
    ...validationQuery("product_reviews", "id", ids.reviews,
      'SELECT 1 FROM "product_reviews" AS row JOIN "products" AS product ON product."id" = row."product_id" JOIN "orders" AS purchase ON purchase."id" = row."order_id" JOIN "customers" AS customer ON customer."id" = row."customer_id" WHERE row."id" = expected.value'),
    ...validationQuery("redirect_map", "source_path", redirectPaths),
  ];

  return {
    overwrite,
    containsSensitiveRows: counts.customers + counts.orders + counts.reviews > 0,
    counts,
    chunks: chunkUnits(units, options),
    validation,
    requiredMediaPaths: mediaPaths(allRows),
  };
}
