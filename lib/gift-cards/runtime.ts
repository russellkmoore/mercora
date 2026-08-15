import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { GiftCardCheckoutCapability } from "@/lib/commerce/capabilities";
import { createRepositoryBackedGiftCardCapability } from "./capability";
import {
  GiftCardRuntimeConfigurationError,
  parseGiftCardCodeKeyRing,
  type GiftCardSecretEnvironment,
} from "./config";
import { createGiftCardRepository } from "./repository";

interface GiftCardWorkerEnvironment extends GiftCardSecretEnvironment {
  DB?: D1Database;
}

export interface GiftCardRuntimeDependencies {
  getEnvironment?: () => Promise<GiftCardWorkerEnvironment>;
  repositoryFactory?: typeof createGiftCardRepository;
  now?: () => number;
}

async function defaultEnvironment(): Promise<GiftCardWorkerEnvironment> {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as GiftCardWorkerEnvironment;
}

function repository(
  environment: GiftCardWorkerEnvironment,
  factory: typeof createGiftCardRepository,
) {
  if (!environment.DB) throw new GiftCardRuntimeConfigurationError();
  return factory(environment.DB);
}

/**
 * Build a capability whose methods resolve request-scoped bindings lazily.
 * Reconciliation-only operation needs D1 but intentionally does not require
 * bearer-code HMAC keys after acquisition has been disabled.
 */
export function createRuntimeGiftCardCapability(
  dependencies: GiftCardRuntimeDependencies = {},
): Required<GiftCardCheckoutCapability> {
  const getEnvironment = dependencies.getEnvironment ?? defaultEnvironment;
  const repositoryFactory = dependencies.repositoryFactory ?? createGiftCardRepository;
  return createRepositoryBackedGiftCardCapability({
    async resolveLookupRuntime() {
      const environment = await getEnvironment();
      const keyRing = parseGiftCardCodeKeyRing(environment);
      return {
        repository: repository(environment, repositoryFactory),
        keyRing,
      };
    },
    async resolveRepository() {
      return repository(await getEnvironment(), repositoryFactory);
    },
    now: dependencies.now,
  });
}

/** Pass this factory to resolveCommerceCapabilities; disabled flags never call it. */
export function createRuntimeGiftCardCapabilityFactory(
  dependencies: GiftCardRuntimeDependencies = {},
): () => Required<GiftCardCheckoutCapability> {
  return () => createRuntimeGiftCardCapability(dependencies);
}
