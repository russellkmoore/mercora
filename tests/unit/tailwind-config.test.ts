import { describe, expect, it } from "vitest";
import config from "@/tailwind.config";

describe("Tailwind runtime theme tokens", () => {
  it("maps shared component colors to request-time store variables", () => {
    const colors = config.theme?.extend?.colors as unknown as Record<string, string>;

    expect(colors.primary).toBe("rgb(from var(--store-primary) r g b / <alpha-value>)");
    expect(colors.background).toBe("rgb(from var(--store-surface) r g b / <alpha-value>)");
    expect(colors.foreground).toBe("rgb(from var(--store-foreground) r g b / <alpha-value>)");
  });
});
