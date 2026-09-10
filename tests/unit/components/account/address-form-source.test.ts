import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyAddressForm, saveAddress } from "@/lib/account/address-client";

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

  it("owns the save feedback so the confirmation survives the post-edit remount", () => {
    // Re-keying the form on setEditing(null) unmounts the instance that would
    // have shown its own success message, so the manager must say it.
    expect(managerSource).toContain('setMessage("Address saved.")');
    expect(managerSource).toContain("onError={setMessage}");
    expect(formSource).toContain("const inlineFeedback = props.onError === undefined");
  });

  it("locks Edit/Remove while a save is in flight, as the pre-extraction manager did", () => {
    expect(managerSource).toContain("onBusyChange={handleBusyChange}");
    expect(managerSource).toContain("const locked = busy || saving;");
    expect(occurrences(managerSource, "disabled={locked}")).toBe(2);
    expect(formSource).toContain("props.onBusyChange?.(true)");
    expect(formSource).toContain("props.onBusyChange?.(false)");
  });

  it("invokes onSaved after the save try/catch so a consumer error is never reported as a failed save", () => {
    expect(formSource).toContain("onSaved: (address: MACHCustomerAddress) => void | Promise<void>;");
    const tryEnd = formSource.indexOf("    } finally {");
    expect(tryEnd).toBeGreaterThan(-1);
    expect(formSource.indexOf("void props.onSaved(address);")).toBeGreaterThan(tryEnd);
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
    // Pairing, not presence: swapping the roles must fail.
    expect(formSource).toMatch(/message\.kind === "error" && \(\s*<p role="alert"/);
    expect(formSource).toMatch(/message\.kind === "success" && \(\s*<p role="status"/);
    expect(occurrences(formSource, '<p role="alert"')).toBe(1);
    expect(occurrences(formSource, '<p role="status"')).toBe(1);
  });

  it("never persists or logs address field values", () => {
    for (const source of [formSource, clientSource]) {
      expect(source).not.toMatch(/localStorage|sessionStorage|console\.(?:log|error)/);
    }
  });
});

describe("saveAddress response handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps a non-JSON failure body to the generic message instead of a parser error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Bad gateway</html>", { status: 502 })));
    await expect(saveAddress(emptyAddressForm)).rejects.toThrow("Address could not be saved");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    await expect(saveAddress(emptyAddressForm)).rejects.toThrow("Address could not be saved");
  });

  it("surfaces the API's own error text and returns the created address on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "city is invalid" }, { status: 400 })));
    await expect(saveAddress(emptyAddressForm)).rejects.toThrow("city is invalid");
    const address = { id: "addr_1", type: "shipping", address: { line1: "1 Main", city: "Denver", country: "US" } };
    const fetcher = vi.fn(async () => Response.json({ address }, { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(saveAddress(emptyAddressForm)).resolves.toEqual({ address });
    expect(fetcher).toHaveBeenCalledWith("/api/account/addresses", expect.objectContaining({
      method: "POST", credentials: "same-origin",
    }));
  });
});

describe("SUB-01/SUB-03 source contract: the subscription-PDP modal is the second AddressForm consumer", () => {
  const dialogSource = readFileSync("components/subscriptions/AddAddressDialog.tsx", "utf8");

  it("AddAddressDialog renders the shared account AddressForm locked to shipping, in create mode", () => {
    expect(dialogSource).toContain("@/components/account/AddressForm");
    expect(dialogSource).toContain('lockType="shipping"');
    expect(dialogSource).toContain('mode="create"');
  });

  it("AddAddressDialog carries no field markup of its own", () => {
    for (const key of ADDRESS_FORM_STATE_KEYS) {
      expect(occurrences(dialogSource, `name="${key}"`)).toBe(0);
    }
  });

  it("the directory walk still finds exactly one file with the field list now that components/subscriptions/ has gained a file", () => {
    const candidates = [
      ...listTsxFiles("components/account"),
      ...listTsxFiles("components/subscriptions"),
    ];
    const filesWithLine1 = candidates.filter((file) =>
      readFileSync(file, "utf8").includes('name="line1"'),
    );
    expect(filesWithLine1).toEqual(["components/account/AddressForm.tsx"]);
  });

  it("never persists or logs address field values", () => {
    expect(dialogSource).not.toMatch(/localStorage|sessionStorage|console\.(?:log|error)/);
  });
});
