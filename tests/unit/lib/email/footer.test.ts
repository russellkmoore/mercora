import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ config: {
  identity: { name: "Example <Store>" },
  contact: { postalAddress: "1 Main & Market" },
} }));
vi.mock("@/lib/store-config", () => ({ getStoreConfig: () => mocks.config }));

import { postalFooterHtml, unsubscribeFooterHtml } from "@/lib/email/footer";
import { getThemeTokens } from "@/lib/themes/tokens";

const defaultTokens = getThemeTokens();

describe("configured email footer", () => {
  it("escapes merchant identity and postal address", () => {
    expect(postalFooterHtml(defaultTokens)).toContain("Example &lt;Store&gt; · 1 Main &amp; Market");
  });

  it("escapes unsubscribe URL attributes", () => {
    expect(unsubscribeFooterHtml('https://example.test/?x="bad"', defaultTokens)).toContain("&quot;bad&quot;");
  });
});
