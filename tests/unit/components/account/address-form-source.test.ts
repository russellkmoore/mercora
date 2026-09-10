import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function occurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

const managerSource = readFileSync("components/account/AddressManager.tsx", "utf8");

describe("AddressManager edit-mode wiring", () => {
  it("drives AddressForm's edit mode from the editing id, keyed to force a fresh instance", () => {
    expect(managerSource).toContain('key={editing ?? "create"}');
    expect(managerSource).toContain('mode={editing ? "edit" : "create"}');
    expect(managerSource).toContain("addressId={editing ?? undefined}");
    expect(managerSource).toContain('submitLabel={editing ? "Save changes" : "Save"}');
    expect(managerSource).toContain("onCancel={editing ? () => setEditing(null) : undefined}");
    expect(occurrences(managerSource, "addressFormFrom(")).toBe(1);
  });
});
