import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ config: {
  identity: { name: "Example <Store>" },
  contact: { postalAddress: "1 Main & Market" },
} }));
vi.mock("@/lib/store-config", () => ({ getStoreConfig: () => mocks.config }));

import { postalFooterHtml, unsubscribeFooterHtml } from "@/lib/email/footer";

describe("configured email footer", () => {
  it("escapes merchant identity and postal address", () => {
    expect(postalFooterHtml()).toContain("Example &lt;Store&gt; · 1 Main &amp; Market");
  });

  it("escapes unsubscribe URL attributes", () => {
    expect(unsubscribeFooterHtml('https://example.test/?x="bad"')).toContain("&quot;bad&quot;");
  });
});
