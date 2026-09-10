import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function occurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

/**
 * Recursively collect every `.tsx` file under `dir` (relative to the repo root).
 */
function listTsxFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsxFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      files.push(entryPath);
    }
  }
  return files;
}

const managerSource = readFileSync("components/account/AddressManager.tsx", "utf8");
const formSource = readFileSync("components/account/AddressForm.tsx", "utf8");
const clientSource = readFileSync("lib/account/address-client.ts", "utf8");

const ADDRESS_FORM_STATE_KEYS = [
  "label",
  "type",
  "line1",
  "line2",
  "city",
  "region",
  "postal_code",
  "country",
  "is_default",
];

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

describe("SUB-02 source contract: one shared address form, one save path", () => {
  it("renders each address field exactly once in AddressForm.tsx and never in AddressManager.tsx", () => {
    for (const key of ADDRESS_FORM_STATE_KEYS) {
      const needle = `name="${key}"`;
      expect(occurrences(formSource, needle)).toBe(1);
      expect(occurrences(managerSource, needle)).toBe(0);
    }
  });

  it("has no second copy of the field list across the saved-address surface", () => {
    // Scoped deliberately to the account and subscriptions surfaces (D-07
    // correction): components/checkout/ShippingForm.tsx is a separate,
    // props-driven guest checkout form outside this phase's boundary.
    const candidates = [
      ...listTsxFiles("components/account"),
      ...listTsxFiles("components/subscriptions"),
    ];
    const filesWithLine1 = candidates.filter((file) =>
      readFileSync(file, "utf8").includes('name="line1"'),
    );
    expect(filesWithLine1).toEqual(["components/account/AddressForm.tsx"]);
  });

  it("has exactly one save path: AddressForm calls saveAddress, AddressManager imports AddressForm", () => {
    expect(formSource).toContain("saveAddress(");
    expect(formSource).toContain("@/lib/account/address-client");
    expect(formSource).not.toMatch(/\bfetch\s*\(/);
    expect(managerSource).toContain("@/components/account/AddressForm");
    expect(occurrences(managerSource, "api/account/addresses")).toBe(1);
  });

  it("saves same-origin to the existing account-addresses API", () => {
    expect(clientSource).toContain('credentials: "same-origin"');
    expect(clientSource).toContain('"POST"');
    expect(clientSource).toContain('"PUT"');
  });

  it("uses the correct ARIA role for error vs success messages", () => {
    expect(formSource).toContain('role="alert"');
    expect(formSource).toContain('role="status"');
  });

  it("never persists or logs address field values", () => {
    for (const source of [formSource, clientSource]) {
      expect(source).not.toMatch(/localStorage|sessionStorage|console\.(?:log|error)/);
    }
  });
});
