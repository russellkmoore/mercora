/**
 * Store configuration is deliberately resolved at the edge of the runtime.
 *
 * Do not read `process.env` into exported constants here.  A module-scope
 * value is captured while Next builds the bundle and can accidentally leak a
 * development URL or a preview configuration into a production deployment.
 * Call `getStoreConfig()` from a request/render instead.
 */

export type Environment = Record<string, string | undefined>;

export type StoreConfig = {
  identity: {
    name: string;
    tagline: string;
    description: string;
    assistantName: string;
  };
  contact: {
    supportEmail: string;
    senderEmail: string;
    postalAddress: string;
    supportHours: string;
  };
  urls: {
    site: string;
    imageCdn?: string;
    clerkHost?: string;
    privacy: string;
    terms: string;
    returns: string;
  };
  persistence: {
    namespace: string;
    cartKey: string;
    chatKey: string;
  };
  theme: {
    mode: "dark" | "light";
    primary: string;
    surface: string;
    surfaceElevated: string;
    foreground: string;
    mutedForeground: string;
    logoPath: string;
  };
  social: Record<"instagram" | "facebook" | "x" | "youtube" | "linkedin", string>;
  mcp: {
    capabilities: string;
    description: string;
  };
  commerce: {
    currency: string;
    freeShippingThresholdCents?: number;
    features: {
      recommendations: boolean;
      giftCards: boolean;
      subscriptions: boolean;
    };
  };
  deployment: {
    indexable: boolean;
    imageTransformsEnabled: boolean;
  };
};

/** Neutral demo defaults. Store operators override only the public values they need. */
export const storeDefaults: StoreConfig = {
  identity: {
    name: "Mercora",
    tagline: "Commerce on the edge",
    description: "An extensible commerce storefront powered by open knowledge.",
    assistantName: "Volt",
  },
  contact: {
    supportEmail: "support@mercora.example.com",
    senderEmail: "Mercora <support@mercora.example.com>",
    postalAddress: "Replace with your business postal address before launch.",
    supportHours: "Monday–Friday, 9:00–17:00 local time",
  },
  urls: {
    site: "https://mercora.example.com",
    privacy: "/privacy",
    terms: "/terms",
    returns: "/returns",
  },
  persistence: {
    namespace: "mercora",
    cartKey: "mercora.cart",
    chatKey: "mercora.chat",
  },
  theme: {
    mode: "dark",
    primary: "#f97316",
    surface: "#000000",
    surfaceElevated: "#171717",
    foreground: "#ffffff",
    mutedForeground: "#a3a3a3",
    logoPath: "/volt.svg",
  },
  social: { instagram: "", facebook: "", x: "", youtube: "", linkedin: "" },
  mcp: {
    capabilities: "commerce,multi-agent,e-commerce",
    description: "Mercora MCP Server for commerce workflows.",
  },
  commerce: {
    currency: "USD",
    features: { recommendations: true, giftCards: false, subscriptions: false },
  },
  deployment: {
    // A host must opt in explicitly. Preview deployments must never be indexed
    // merely because NODE_ENV is "production".
    indexable: false,
    imageTransformsEnabled: true,
  },
};

function text(env: Environment, key: string, fallback: string) {
  const value = env[key]?.trim();
  return value ? value : fallback;
}

function bool(env: Environment, key: string, fallback: boolean) {
  const value = env[key]?.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function optionalHttpsUrl(env: Environment, key: string) {
  const value = env[key]?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function siteUrl(env: Environment) {
  return optionalHttpsUrl(env, "NEXT_PUBLIC_SITE_URL") ?? storeDefaults.urls.site;
}

/**
 * Resolve a request/build configuration without throwing for absent optional
 * configuration. Validation of launch-only placeholders belongs in the
 * deployment script, not in import-time application code.
 */
export function resolveStoreConfig(env: Environment = {}): StoreConfig {
  const name = text(env, "NEXT_PUBLIC_STORE_NAME", storeDefaults.identity.name);
  const supportEmail = text(env, "STORE_SUPPORT_EMAIL", storeDefaults.contact.supportEmail);

  return {
    ...storeDefaults,
    identity: {
      ...storeDefaults.identity,
      name,
      tagline: text(env, "NEXT_PUBLIC_STORE_TAGLINE", storeDefaults.identity.tagline),
      description: text(env, "NEXT_PUBLIC_STORE_DESCRIPTION", storeDefaults.identity.description),
      assistantName: text(env, "NEXT_PUBLIC_ASSISTANT_NAME", storeDefaults.identity.assistantName),
    },
    contact: {
      ...storeDefaults.contact,
      supportEmail,
      senderEmail: text(env, "STORE_SENDER_EMAIL", `${name} <${supportEmail}>`),
      postalAddress: text(env, "STORE_POSTAL_ADDRESS", storeDefaults.contact.postalAddress),
      supportHours: text(env, "STORE_SUPPORT_HOURS", storeDefaults.contact.supportHours),
    },
    urls: {
      ...storeDefaults.urls,
      site: siteUrl(env),
      imageCdn: optionalHttpsUrl(env, "NEXT_PUBLIC_IMAGE_CDN"),
      clerkHost: optionalHttpsUrl(env, "NEXT_PUBLIC_CLERK_HOST"),
      privacy: text(env, "NEXT_PUBLIC_PRIVACY_URL", storeDefaults.urls.privacy),
      terms: text(env, "NEXT_PUBLIC_TERMS_URL", storeDefaults.urls.terms),
      returns: text(env, "NEXT_PUBLIC_RETURNS_URL", storeDefaults.urls.returns),
    },
    persistence: {
      ...storeDefaults.persistence,
      namespace: text(env, "NEXT_PUBLIC_STORAGE_NAMESPACE", storeDefaults.persistence.namespace),
      cartKey: text(env, "NEXT_PUBLIC_CART_STORAGE_KEY", storeDefaults.persistence.cartKey),
      chatKey: text(env, "NEXT_PUBLIC_CHAT_STORAGE_KEY", storeDefaults.persistence.chatKey),
    },
    theme: {
      ...storeDefaults.theme,
      primary: text(env, "NEXT_PUBLIC_THEME_PRIMARY", storeDefaults.theme.primary),
      logoPath: text(env, "NEXT_PUBLIC_STORE_LOGO_PATH", storeDefaults.theme.logoPath),
    },
    mcp: {
      ...storeDefaults.mcp,
      capabilities: text(env, "MCP_CAPABILITIES", storeDefaults.mcp.capabilities),
      description: text(env, "MCP_DESCRIPTION", `${name} MCP Server for commerce workflows.`),
    },
    commerce: {
      ...storeDefaults.commerce,
      currency: text(env, "STORE_CURRENCY", storeDefaults.commerce.currency),
      freeShippingThresholdCents: parseOptionalCents(env["STORE_FREE_SHIPPING_THRESHOLD_CENTS"]),
    },
    deployment: {
      indexable: bool(env, "NEXT_PUBLIC_ROBOTS_INDEX", storeDefaults.deployment.indexable),
      imageTransformsEnabled: bool(
        env,
        "NEXT_PUBLIC_IMAGE_TRANSFORMS",
        storeDefaults.deployment.imageTransformsEnabled,
      ),
    },
  };
}

function parseOptionalCents(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

/** Runtime entry point; safe when Cloudflare lazily populates process.env. */
export function getStoreConfig() {
  return resolveStoreConfig(process.env);
}
