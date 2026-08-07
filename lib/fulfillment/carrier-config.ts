import {
  getStoreConfig,
  type StoreCarrierDefinition,
  type StoreConfig,
} from "@/lib/store-config";
import type { CarrierDefinition, CarrierRegistry } from "./types";

const TRACKING_PLACEHOLDER = "{trackingNumber}";

function toRuntimeDefinition(definition: StoreCarrierDefinition): CarrierDefinition {
  const template = definition.trackingUrlTemplate;
  return {
    code: definition.code,
    label: definition.label,
    legacyAliases: definition.legacyAliases,
    ...(template
      ? {
          trackingUrl: (trackingNumber: string) =>
            template.replace(TRACKING_PLACEHOLDER, encodeURIComponent(trackingNumber)),
        }
      : {}),
  };
}

/** Convert validated store data into the pure fulfillment registry contract. */
export function carrierRegistryFromConfig(
  config: Pick<StoreConfig, "commerce">,
): CarrierRegistry {
  return {
    definitions: config.commerce.carriers.map(toRuntimeDefinition),
  };
}

/** Resolve at request time so preview/production runtime bindings never freeze at build time. */
export function getCarrierRegistry(): CarrierRegistry {
  return carrierRegistryFromConfig(getStoreConfig());
}
