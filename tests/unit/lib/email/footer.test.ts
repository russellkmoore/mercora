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

describe("footer follows its caller's theme, not a fixed one", () => {
  const luxeTokens = getThemeTokens("luxe");

  it("postalFooterHtml renders the muted-on-inverse value of whichever preset it is handed", () => {
    expect(defaultTokens.mutedOnInverse).not.toBe(luxeTokens.mutedOnInverse);
    expect(postalFooterHtml(defaultTokens)).toContain(`color:${defaultTokens.mutedOnInverse};`);
    expect(postalFooterHtml(luxeTokens)).toContain(`color:${luxeTokens.mutedOnInverse};`);
  });

  it("unsubscribeFooterHtml renders the muted-on-inverse value of whichever preset it is handed", () => {
    const url = "https://example.test/unsubscribe";
    expect(unsubscribeFooterHtml(url, defaultTokens)).toContain(`color:${defaultTokens.mutedOnInverse};`);
    expect(unsubscribeFooterHtml(url, luxeTokens)).toContain(`color:${luxeTokens.mutedOnInverse};`);
  });
});
