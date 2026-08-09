// Shared fulfillment vocabulary. This module is intentionally runtime-neutral.

/**
 * Carrier codes are registry driven. The default registry supplies the common
 * built-ins, while a store may provide additional lowercase codes.
 */
export type Carrier = string;

export interface CarrierDefinition {
  /** Stable, lowercase value persisted with the order. */
  code: Carrier;
  /** Customer- and admin-facing name. */
  label: string;
  /** Compact legacy prefixes, used only when reading historical carrier text. */
  legacyAliases?: readonly string[];
  /** Return the carrier-owned tracking destination for a sanitized number. */
  trackingUrl?: (trackingNumber: string) => URL | string | null;
}

export interface CarrierRegistry {
  readonly definitions: readonly CarrierDefinition[];
}

export const DEFAULT_CARRIER_DEFINITIONS = [
  {
    code: "ups",
    label: "UPS",
    legacyAliases: ["ups", "unitedparcel"],
    trackingUrl: (trackingNumber: string) =>
      `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(trackingNumber)}`,
  },
  {
    code: "fedex",
    label: "FedEx",
    legacyAliases: ["fedex", "federalexpress"],
    trackingUrl: (trackingNumber: string) =>
      `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`,
  },
  {
    code: "usps",
    label: "USPS",
    legacyAliases: ["usps", "unitedstatespostalservice", "uspostalservice"],
    trackingUrl: (trackingNumber: string) =>
      `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`,
  },
  { code: "other", label: "Other", legacyAliases: [] },
] as const satisfies readonly CarrierDefinition[];

export const DEFAULT_CARRIER_REGISTRY: CarrierRegistry = {
  definitions: DEFAULT_CARRIER_DEFINITIONS,
};

/** Backwards-compatible exports for existing fulfillment consumers. */
export const CARRIERS = Object.freeze(DEFAULT_CARRIER_DEFINITIONS.map(({ code }) => code));
export const CARRIER_LABELS: Readonly<Record<Carrier, string>> = Object.freeze(
  Object.fromEntries(DEFAULT_CARRIER_DEFINITIONS.map(({ code, label }) => [code, label])),
);

export const ORDER_EVENT_TYPES = [
  "shipment_created",
  "tracking_updated",
  "shipping_email_sent",
  "shipping_email_failed",
  "shipping_email_resent",
] as const;
export type OrderEventType = (typeof ORDER_EVENT_TYPES)[number];

export type ActorType = "admin" | "service" | "system";

export interface Actor {
  type: ActorType;
  /** Clerk user ID, "api-token" for service authentication, null for system. */
  id: string | null;
}

/** Normalized, already-validated shipment payload. */
export interface ShipmentInput {
  carrier: Carrier | null;
  /** Sanitized tracking number; null means an untracked shipment. */
  trackingNumber: string | null;
}
