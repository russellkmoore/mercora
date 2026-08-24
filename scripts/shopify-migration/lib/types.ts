/** Transport and pipeline types shared by the operator-only migration tools. */

export type ShopifyId = number | string;

export interface ExtractResult<T> {
  records: T[];
  source: "api" | "file";
  extractedAt: string;
}

export interface TransformResult<TSource, TTarget> {
  records: TTarget[];
  idMap: Map<string, string>;
  skipped: Array<{ record: TSource; reason: string }>;
  warnings: string[];
}

export interface LoadResult {
  entity: string;
  inserted: number;
  skipped: number;
  errors: Array<{ id: string; error: string }>;
}

export interface ShopifyProductImage {
  id?: ShopifyId;
  src: string;
  position?: number;
  alt?: string | null;
  width?: number;
  height?: number;
  variant_ids?: ShopifyId[];
}

export interface ShopifyProductOption {
  id?: ShopifyId;
  name: string;
  position?: number;
  values: string[];
}

export interface ShopifyProductVariant {
  id?: ShopifyId;
  product_id?: ShopifyId;
  title?: string;
  sku?: string;
  price: string;
  compare_at_price?: string | null;
  grams?: number;
  weight?: number;
  weight_unit?: string;
  inventory_quantity?: number;
  inventory_policy?: "deny" | "continue" | string;
  inventory_management?: string | null;
  fulfillment_service?: string;
  requires_shipping?: boolean;
  taxable?: boolean;
  barcode?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  image_id?: ShopifyId | null;
  position?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ShopifyProduct {
  id: ShopifyId;
  title: string;
  body_html?: string;
  handle: string;
  vendor?: string;
  product_type?: string;
  tags?: string;
  status?: "active" | "draft" | "archived" | string;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  variants: ShopifyProductVariant[];
  images: ShopifyProductImage[];
  options?: ShopifyProductOption[];
  image?: ShopifyProductImage | null;
  seo_title?: string;
  seo_description?: string;
}

export interface ShopifyCollectionImage {
  src: string;
  alt?: string | null;
  width?: number;
  height?: number;
}

export interface ShopifyCollection {
  id: ShopifyId;
  title: string;
  handle: string;
  body_html?: string;
  image?: ShopifyCollectionImage | null;
  published_at?: string | null;
  sort_order?: string;
  collection_type?: "custom" | "smart";
  products_count?: number;
  updated_at?: string;
}

export interface ShopifyCollect {
  id: ShopifyId;
  collection_id: ShopifyId;
  product_id: ShopifyId;
  position?: number;
  sort_value?: string;
}

export interface ShopifyCustomerAddress {
  id?: ShopifyId;
  customer_id?: ShopifyId;
  first_name?: string;
  last_name?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  province_code?: string;
  country?: string;
  country_code?: string;
  zip?: string;
  phone?: string;
  default?: boolean;
}

export interface ShopifyCustomer {
  id: ShopifyId;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  verified_email?: boolean;
  total_spent?: string;
  orders_count?: number;
  accepts_marketing?: boolean;
  tags?: string;
  created_at?: string;
  updated_at?: string;
  default_address?: ShopifyCustomerAddress | null;
  addresses?: ShopifyCustomerAddress[];
}

export interface ShopifyOrderLineItem {
  id?: ShopifyId;
  product_id?: ShopifyId | null;
  variant_id?: ShopifyId | null;
  title: string;
  variant_title?: string | null;
  sku?: string;
  quantity: number;
  price: string;
  total_discount?: string;
  requires_shipping?: boolean;
}

export interface ShopifyOrder {
  id: ShopifyId;
  name?: string;
  order_number?: number;
  email?: string;
  customer?: { id: ShopifyId } | null;
  financial_status?: string;
  fulfillment_status?: string | null;
  total_price: string;
  subtotal_price?: string;
  total_tax?: string;
  total_discounts?: string;
  total_shipping_price_set?: { shop_money?: { amount: string; currency_code: string } };
  currency?: string;
  line_items: ShopifyOrderLineItem[];
  shipping_address?: ShopifyCustomerAddress | null;
  billing_address?: ShopifyCustomerAddress | null;
  created_at?: string;
  updated_at?: string;
  closed_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  tags?: string;
  note?: string | null;
}

export interface ShopifyPage {
  id: ShopifyId;
  title: string;
  handle: string;
  body_html?: string;
  author?: string;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  template_suffix?: string | null;
}

export interface ShopifyBlog {
  id: ShopifyId;
  title: string;
  handle: string;
  commentable?: "no" | "moderate" | "yes" | string;
  feedburner?: string | null;
  feedburner_location?: string | null;
  created_at?: string;
  updated_at?: string;
  tags?: string;
}

export interface ShopifyArticle {
  id: ShopifyId;
  blog_id: ShopifyId;
  title: string;
  handle: string;
  body_html?: string;
  summary_html?: string | null;
  author?: string;
  user_id?: ShopifyId;
  tags?: string;
  image?: ShopifyProductImage | null;
  published?: boolean;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ShopifyRedirect {
  id: ShopifyId;
  path: string;
  target: string;
}

/** Raw Judge.me CSV row. Unknown columns remain strings and are size bounded by the reader. */
export type JudgeMeFileRow = Record<string, string | undefined> & {
  title?: string;
  body?: string;
  rating?: string;
  review_date?: string;
  created_at?: string;
  reviewer_name?: string;
  reviewer_email?: string;
  product_id?: string;
  product_handle?: string;
  reply?: string;
  picture_urls?: string;
  source?: string;
  status?: string;
};

export interface JudgeMeReview {
  title?: string;
  body: string;
  rating: number;
  review_date?: string;
  reviewer_name?: string;
  reviewer_email?: string;
  product_id?: string;
  product_handle?: string;
  reply?: string;
  picture_urls?: string;
  source?: string;
  status?: string;
}
