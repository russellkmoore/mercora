export type ReviewStatus = 'pending' | 'needs_review' | 'published' | 'suppressed' | 'auto_rejected';
export type ReviewFlagStatus = 'open' | 'resolved' | 'dismissed';

export interface ReviewFlag {
  id: string;
  review_id: string;
  flagged_by?: string | null;
  reason: string;
  notes?: string | null;
  status: ReviewFlagStatus;
  created_at?: string | null;
  resolved_at?: string | null;
}

export interface ReviewModerationSummary {
  flagged: boolean;
  blocked: boolean;
  reasons: string[];
  warnings?: string[];
  detectedPhrases?: string[];
}

export interface ReviewMedia {
  id?: string;
  review_id?: string;
  type: 'image' | 'video';
  url: string;
  alt_text?: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface Review {
  id: string;
  product_id: string;
  order_id: string;
  order_item_id?: string | null;
  customer_id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  status: ReviewStatus;
  is_verified: boolean;
  automated_moderation?: ReviewModerationSummary | null;
  moderation_notes?: string | null;
  admin_response?: string | null;
  response_author_id?: string | null;
  responded_at?: string | null;
  submitted_at?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, any> | null;
  media?: ReviewMedia[];
  flags?: ReviewFlag[];
  open_flag_count?: number;
  product_name?: string | null;
  product_slug?: string | null;
}

export interface ReviewSubmissionPayload {
  orderId: string;
  orderItemId?: string;
  productId: string;
  rating: number;
  title?: string;
  body: string;
  media?: Array<{
    url: string;
    type?: 'image' | 'video';
    alt_text?: string;
  }>;
  metadata?: Record<string, any>;
}

export interface ReviewListOptions {
  productId?: string;
  status?: ReviewStatus[];
  minRating?: number;
  maxRating?: number;
  limit?: number;
  offset?: number;
}

export interface ReviewQueueResult {
  items: Review[];
  total: number;
}

export interface ReviewModerationMetrics {
  total: number;
  pending: number;
  needs_review: number;
  published: number;
  suppressed: number;
  auto_rejected: number;
  flagged: number;
  last_published_at?: string | null;
}

export interface ReviewReminderCandidate {
  orderId: string;
  productId: string;
  productName: string | null;
  deliveredAt: string;
  customerId: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  orderItemId?: string | null;
}
