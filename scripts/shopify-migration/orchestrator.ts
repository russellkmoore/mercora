import type { MigrationConfig } from "./lib/config.js";
import { providerFingerprint } from "./lib/ids.js";
import type {
  JudgeMeFileRow,
  ShopifyArticle,
  ShopifyBlog,
  ShopifyCollect,
  ShopifyCollection,
  ShopifyCustomer,
  ShopifyOrder,
  ShopifyPage,
  ShopifyProduct,
  ShopifyRedirect,
} from "./lib/types.js";
import {
  parseWranglerJsonc,
  resolveDatabaseTarget,
  resolveMediaTarget,
} from "./lib/wrangler-target.js";
import {
  D1_DEPENDENCIES,
  buildD1ImportPlan,
  type CommandRunner,
  type D1ApplyResult,
  type D1DryRunResult,
  type MaterializedD1Input,
} from "./adapters/d1/index.js";
import type { ClerkMigrationClient, ClerkProvisioningResult } from "./adapters/clerk/index.js";
import type {
  AppliedMediaImportResult,
  MediaImportResult,
  MediaObjectStore,
  PlannedMediaImportResult,
} from "./adapters/media/index.js";
import type { MediaRewrite } from "./transformers/_shared.js";
import { validateMediaPlan } from "./adapters/media/index.js";
import { collectionMembershipByProduct, transformProducts } from "./transformers/products.js";
import { transformCollections } from "./transformers/categories.js";
import { transformPages } from "./transformers/pages.js";
import { transformBlogContent } from "./transformers/blog.js";
import {
  collectionRedirects,
  pageRedirects,
  productRedirects,
  transformRedirects,
} from "./transformers/redirects.js";
import {
  materializeCustomers,
  normalizeJudgeMeFileRows,
  transformCustomers,
  transformHistoricalOrders,
  transformJudgeMeReviews,
  type CustomerProvisioningPlan,
  type ImportedReviewAttribution,
  type VerifiedReviewProvenance,
} from "./transformers/sensitive/index.js";

export interface MigrationSourceBundle {
  collections: readonly ShopifyCollection[];
  collects: readonly ShopifyCollect[];
  products: readonly ShopifyProduct[];
  pages: readonly ShopifyPage[];
  blogs: readonly ShopifyBlog[];
  articles: readonly ShopifyArticle[];
  redirects: readonly ShopifyRedirect[];
  customers: readonly ShopifyCustomer[];
  orders: readonly ShopifyOrder[];
  judgeMeRows: readonly JudgeMeFileRow[];
}

export interface MigrationSource {
  extract(includeSensitive: boolean): Promise<MigrationSourceBundle>;
}

export interface MigrationDomainOptions {
  currency: string;
  inventoryLocationId: string;
  fulfillmentType: "physical" | "digital" | "service";
  actorId: string;
  fallbackAuthor: string;
  allowedMediaHosts: readonly string[];
  unresolvedCustomer: "reject" | "guest";
  reviewAttributions: ReadonlyMap<string, ImportedReviewAttribution>;
  verifiedPurchases?: ReadonlyMap<string, VerifiedReviewProvenance>;
}

export interface MigrationApplyFactories {
  createMediaStore(bucketName: string): MediaObjectStore;
  createClerkClient(): Promise<ClerkMigrationClient>;
  createCommandRunner(): CommandRunner;
}

export interface MigrationAdapterRunners {
  importMedia(
    plans: readonly MediaRewrite[],
    options: {
      execution: MigrationConfig["execution"];
      wranglerConfigText: string;
      wranglerEnvironment?: string;
      allowedHosts: readonly string[];
      store: MediaObjectStore;
    },
  ): Promise<MediaImportResult[]>;
  provisionClerk(
    plans: readonly CustomerProvisioningPlan[],
    execution: MigrationConfig["execution"],
    client: ClerkMigrationClient,
  ): Promise<ClerkProvisioningResult>;
  runD1(options: {
    input: MaterializedD1Input;
    execution: MigrationConfig["execution"];
    projectRoot: string;
    wranglerEnvironment?: string;
    expectedDatabaseName?: string;
    mediaEvidence?: readonly AppliedMediaImportResult[];
    commandRunner: CommandRunner;
  }): Promise<D1DryRunResult | D1ApplyResult>;
}

export interface OrchestrateMigrationOptions {
  config: MigrationConfig;
  domain: MigrationDomainOptions;
  source: MigrationSource;
  projectRoot: string;
  wranglerConfigText: string;
  expectedDatabaseName?: string;
  applyFactories?: MigrationApplyFactories;
  runners?: MigrationAdapterRunners;
  now?: () => Date;
}

export interface MigrationEntitySummary {
  source: number;
  transformed: number;
  written: number;
  skipped: number;
  errors: number;
}

export interface MigrationRunReport {
  version: 1;
  authoritative: false;
  generatedAt: string;
  dryRun: boolean;
  target: MigrationConfig["execution"]["target"];
  entities: Record<string, MigrationEntitySummary>;
  media: { planned: number; persisted: number };
  clerk: { created: number; existing: number; reconciliation: number };
  d1: D1DryRunResult | D1ApplyResult;
  warnings: number;
}

function fingerprintPlaceholder(fingerprint: string): string {
  if (!/^[a-f0-9]{64}$/u.test(fingerprint)) throw new Error("Customer source fingerprint is invalid");
  return `user_migration_preflight_${fingerprint.slice(0, 48)}`;
}

function uniqueMedia(plans: readonly MediaRewrite[], allowedHosts: readonly string[]): MediaRewrite[] {
  const byKey = new Map<string, MediaRewrite>();
  for (const plan of plans) {
    validateMediaPlan(plan, allowedHosts);
    const prior = byKey.get(plan.objectKey);
    if (prior && JSON.stringify(prior) !== JSON.stringify(plan)) {
      throw new Error("Migration media plan contains a conflicting object key");
    }
    byKey.set(plan.objectKey, plan);
  }
  return [...byKey.values()].sort((left, right) => left.objectKey.localeCompare(right.objectKey));
}

function plannedMedia(plans: readonly MediaRewrite[]): PlannedMediaImportResult[] {
  return plans.map((plan) => ({
    objectKey: plan.objectKey,
    publicPath: plan.publicPath,
    contentType: plan.contentType,
    status: "planned",
    byteLength: null,
    sha256: null,
  }));
}

function variantIdsByFingerprint(
  products: ReturnType<typeof transformProducts>["records"],
): Map<string, string> {
  const mappings = new Map<string, string>();
  for (const product of products) {
    for (const inventory of product.inventory) {
      const external = JSON.parse(inventory.external_references) as { shopify_fingerprint?: unknown };
      if (typeof external.shopify_fingerprint !== "string" || !/^[a-f0-9]{64}$/u.test(external.shopify_fingerprint)) {
        throw new Error("Transformed inventory is missing its source fingerprint");
      }
      mappings.set(external.shopify_fingerprint, inventory.sku_id);
    }
  }
  return mappings;
}

function productMappings(
  products: ReturnType<typeof transformProducts>,
  source: readonly ShopifyProduct[],
): Map<string, string> {
  const mappings = new Map(products.idMap);
  const accepted = new Map(products.records.map((record) => [record.sourceFingerprint, record.product.id]));
  for (const product of source) {
    const fingerprint = providerFingerprint("shopify", "product", product.id);
    const id = accepted.get(fingerprint);
    if (id) mappings.set(providerFingerprint("shopify", "product_handle", product.handle), id);
  }
  return mappings;
}

function dryRunD1(plan: ReturnType<typeof buildD1ImportPlan>): D1DryRunResult {
  const dependencies = D1_DEPENDENCIES.map((dependency) => ({ dependency, count: plan.counts[dependency] }));
  return {
    dryRun: true,
    dependencies,
    totalRows: dependencies.reduce((total, item) => total + item.count, 0),
    chunkCount: plan.chunks.length,
    requiredMediaCount: plan.requiredMediaPaths.length,
  };
}

function summary(source: number, transformed: number, skipped: number, written: number): MigrationEntitySummary {
  return { source, transformed, written, skipped, errors: 0 };
}

function assertMode(config: MigrationConfig): void {
  if (config.execution.apply === config.execution.dryRun) {
    throw new Error("Migration must be exactly one of dry-run or apply");
  }
  if (config.execution.includeSensitive !== config.execution.confirmedSensitiveData) {
    throw new Error("Sensitive migration data requires matching explicit confirmation");
  }
}

export async function orchestrateMigration(options: OrchestrateMigrationOptions): Promise<MigrationRunReport> {
  assertMode(options.config);
  const generatedAt = (options.now ?? (() => new Date()))().toISOString();
  const wrangler = parseWranglerJsonc(options.wranglerConfigText);
  const targetOptions = {
    target: options.config.execution.target,
    ...(options.config.wranglerEnvironment ? { environment: options.config.wranglerEnvironment } : {}),
  } as const;
  const mediaTarget = resolveMediaTarget(wrangler, targetOptions);
  resolveDatabaseTarget(wrangler, {
    ...targetOptions,
    ...(options.expectedDatabaseName ? { expectedName: options.expectedDatabaseName } : {}),
  });

  const source = await options.source.extract(options.config.execution.includeSensitive);
  if (!options.config.execution.includeSensitive && (source.customers.length || source.orders.length || source.judgeMeRows.length)) {
    throw new Error("Source returned sensitive records without explicit sensitive-data inclusion");
  }

  const categories = transformCollections(source.collections, {
    generatedAt,
    allowedMediaHosts: options.domain.allowedMediaHosts,
  });
  const memberships = collectionMembershipByProduct(source.collects, categories.idMap);
  const products = transformProducts(source.products, {
    currency: options.domain.currency,
    generatedAt,
    inventoryLocationId: options.domain.inventoryLocationId,
    fulfillmentType: options.domain.fulfillmentType,
    allowedMediaHosts: options.domain.allowedMediaHosts,
    categoryIdsByProduct: memberships,
  });
  const pages = transformPages(source.pages, {
    generatedAt,
    actorId: options.domain.actorId,
    allowedMediaHosts: options.domain.allowedMediaHosts,
  });
  const blog = transformBlogContent(source.blogs, source.articles, {
    generatedAt,
    actorId: options.domain.actorId,
    fallbackAuthor: options.domain.fallbackAuthor,
    allowedMediaHosts: options.domain.allowedMediaHosts,
  });

  const acceptedProducts = new Map(products.records.map((record) => [record.sourceFingerprint, record.product.slug]));
  const acceptedCategories = new Map(categories.records.map((record) => [record.sourceFingerprint, record.category.slug]));
  const acceptedPages = new Map(pages.records.map((record) => [record.sourceFingerprint, record.page.slug]));
  const redirects = transformRedirects(source.redirects, {
    generated: [
      ...productRedirects(source.products.flatMap((record) => {
        const slug = acceptedProducts.get(providerFingerprint("shopify", "product", record.id));
        return slug ? [{ legacyHandle: record.handle, publicSlug: slug }] : [];
      })),
      ...collectionRedirects(source.collections.flatMap((record) => {
        const slug = acceptedCategories.get(providerFingerprint("shopify", "category", record.id));
        return slug ? [{ legacyHandle: record.handle, publicSlug: slug }] : [];
      })),
      ...pageRedirects(source.pages.flatMap((record) => {
        const slug = acceptedPages.get(providerFingerprint("shopify", "page", record.id));
        return slug ? [{ legacyHandle: record.handle, publicSlug: slug }] : [];
      })),
      ...blog.records.map((record) => record.redirect),
    ],
  });

  const mediaPlans = uniqueMedia([
    ...categories.records.flatMap((record) => record.media),
    ...products.records.flatMap((record) => record.media),
    ...pages.records.flatMap((record) => record.media),
    ...blog.records.flatMap((record) => record.media),
  ], options.domain.allowedMediaHosts);

  const customerPlans = options.config.execution.includeSensitive
    ? transformCustomers(source.customers, { generatedAt })
    : { records: [], skipped: [], warnings: [] };
  const normalizedReviews = options.config.execution.includeSensitive
    ? normalizeJudgeMeFileRows(source.judgeMeRows)
    : { records: [], skipped: [], warnings: [] };
  const preflightCustomerIds = new Map(
    customerPlans.records.map((plan) => [plan.sourceFingerprint, fingerprintPlaceholder(plan.sourceFingerprint)]),
  );
  const preflightCustomers = materializeCustomers(customerPlans.records, preflightCustomerIds);
  const productIds = productMappings(products, source.products);
  const variantIds = variantIdsByFingerprint(products.records);
  const preflightOrders = options.config.execution.includeSensitive
    ? transformHistoricalOrders(source.orders, {
      generatedAt,
      customerIds: preflightCustomers.idMap,
      productIds,
      variantIds,
      unresolvedCustomer: options.domain.unresolvedCustomer,
    })
    : { records: [], idMap: new Map<string, string>(), skipped: [], warnings: [] };
  const preflightReviews = options.config.execution.includeSensitive
    ? transformJudgeMeReviews(normalizedReviews.records, {
      generatedAt,
      productIds,
      reviewAttributions: options.domain.reviewAttributions,
      ...(options.domain.verifiedPurchases ? { verifiedPurchases: options.domain.verifiedPurchases } : {}),
    })
    : { records: [], idMap: new Map<string, string>(), skipped: [], warnings: [] };

  const publicInput: MaterializedD1Input = {
    categories: categories.records,
    products: products.records,
    pages: pages.records,
    blog,
    customers: preflightCustomers.records,
    orders: preflightOrders.records,
    redirects: redirects.records,
  };
  const preflightPlan = buildD1ImportPlan(publicInput, { overwrite: options.config.execution.overwrite });

  const baseWarningCount = categories.warnings.length + products.warnings.length + pages.warnings.length +
    blog.warnings.length + redirects.warnings.length + customerPlans.warnings.length +
    normalizedReviews.warnings.length;

  if (options.config.execution.dryRun) {
    return {
      version: 1,
      authoritative: false,
      generatedAt,
      dryRun: true,
      target: options.config.execution.target,
      entities: {
        categories: summary(source.collections.length, categories.records.length, categories.skipped.length, 0),
        products: summary(source.products.length, products.records.length, products.skipped.length, 0),
        pages: summary(source.pages.length, pages.records.length, pages.skipped.length, 0),
        blogs: summary(source.articles.length, blog.records.length, blog.skipped.length, 0),
        customers: summary(source.customers.length, customerPlans.records.length, customerPlans.skipped.length, 0),
        orders: summary(source.orders.length, preflightOrders.records.length, preflightOrders.skipped.length, 0),
        reviews: summary(
          source.judgeMeRows.length,
          preflightReviews.records.length,
          normalizedReviews.skipped.length + preflightReviews.skipped.length,
          0,
        ),
        redirects: summary(source.redirects.length, redirects.records.length, redirects.skipped.length, 0),
      },
      media: { planned: plannedMedia(mediaPlans).length, persisted: 0 },
      clerk: { created: 0, existing: 0, reconciliation: 0 },
      d1: dryRunD1(preflightPlan),
      warnings: baseWarningCount + preflightOrders.warnings.length + preflightReviews.warnings.length,
    };
  }

  if (!options.applyFactories || !options.runners) {
    throw new Error("Apply mode requires explicit adapter factories and runners");
  }
  const mediaStore = options.applyFactories.createMediaStore(mediaTarget.bucketName);
  const mediaResults = await options.runners.importMedia(mediaPlans, {
    execution: options.config.execution,
    wranglerConfigText: options.wranglerConfigText,
    ...(options.config.wranglerEnvironment ? { wranglerEnvironment: options.config.wranglerEnvironment } : {}),
    allowedHosts: options.domain.allowedMediaHosts,
    store: mediaStore,
  });
  if (mediaResults.some((result) => result.status === "planned")) {
    throw new Error("Apply media phase returned unpersisted plans");
  }
  const mediaEvidence = mediaResults as AppliedMediaImportResult[];

  let clerk: ClerkProvisioningResult = { idMap: new Map(), created: 0, existing: 0, reconciliation: [] };
  let customers = preflightCustomers;
  if (options.config.execution.includeSensitive && customerPlans.records.length > 0) {
    const clerkClient = await options.applyFactories.createClerkClient();
    clerk = await options.runners.provisionClerk(customerPlans.records, options.config.execution, clerkClient);
    customers = materializeCustomers(customerPlans.records, clerk.idMap);
  }
  const orders = options.config.execution.includeSensitive
    ? transformHistoricalOrders(source.orders, {
      generatedAt,
      customerIds: customers.idMap,
      productIds,
      variantIds,
      unresolvedCustomer: options.domain.unresolvedCustomer,
    })
    : preflightOrders;
  const reviews = options.config.execution.includeSensitive
    ? transformJudgeMeReviews(normalizedReviews.records, {
      generatedAt,
      productIds,
      customerIdsByEmailFingerprint: customers.emailIdMap,
      reviewAttributions: options.domain.reviewAttributions,
      ...(options.domain.verifiedPurchases ? { verifiedPurchases: options.domain.verifiedPurchases } : {}),
    })
    : { records: [], idMap: new Map<string, string>(), skipped: [], warnings: [] };

  const finalInput: MaterializedD1Input = {
    categories: categories.records,
    products: products.records,
    pages: pages.records,
    blog,
    customers: customers.records,
    orders: orders.records,
    reviews: reviews.records,
    redirects: redirects.records,
  };
  buildD1ImportPlan(finalInput, { overwrite: options.config.execution.overwrite });
  const commandRunner = options.applyFactories.createCommandRunner();
  const d1 = await options.runners.runD1({
    input: finalInput,
    execution: options.config.execution,
    projectRoot: options.projectRoot,
    ...(options.config.wranglerEnvironment ? { wranglerEnvironment: options.config.wranglerEnvironment } : {}),
    ...(options.expectedDatabaseName ? { expectedDatabaseName: options.expectedDatabaseName } : {}),
    mediaEvidence,
    commandRunner,
  });
  if (d1.dryRun) throw new Error("Apply D1 phase unexpectedly returned a dry-run result");

  return {
    version: 1,
    authoritative: false,
    generatedAt,
    dryRun: false,
    target: options.config.execution.target,
    entities: {
      categories: summary(source.collections.length, categories.records.length, categories.skipped.length, categories.records.length),
      products: summary(source.products.length, products.records.length, products.skipped.length, products.records.length),
      pages: summary(source.pages.length, pages.records.length, pages.skipped.length, pages.records.length),
      blogs: summary(source.articles.length, blog.records.length, blog.skipped.length, blog.records.length),
      customers: summary(source.customers.length, customers.records.length, customerPlans.skipped.length + customers.skipped.length, customers.records.length),
      orders: summary(source.orders.length, orders.records.length, orders.skipped.length, orders.records.length),
      reviews: summary(source.judgeMeRows.length, reviews.records.length, normalizedReviews.skipped.length + reviews.skipped.length, reviews.records.length),
      redirects: summary(source.redirects.length, redirects.records.length, redirects.skipped.length, redirects.records.length),
    },
    media: { planned: mediaPlans.length, persisted: mediaEvidence.length },
    clerk: { created: clerk.created, existing: clerk.existing, reconciliation: clerk.reconciliation.length },
    d1,
    warnings: baseWarningCount + orders.warnings.length + reviews.warnings.length,
  };
}
