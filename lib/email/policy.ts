export type EmailCategory = "review_reminders";

/** Explicit product policy: only review reminders are non-transactional. */
export const emailDeliveryPolicy = {
  review_reminders: "non_transactional",
  review_status: "transactional",
  order_confirmation: "transactional",
  shipping_confirmation: "transactional",
  refund_confirmation: "transactional",
  merchant_notification: "transactional",
} as const;
