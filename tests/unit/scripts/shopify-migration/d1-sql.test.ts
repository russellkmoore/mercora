import { describe, expect, it } from "vitest";

import {
  MAX_D1_STATEMENT_BYTES,
  buildInsertStatement,
  chunkSqlStatements,
  sqlLiteral,
} from "@/scripts/shopify-migration/adapters/d1/sql";

describe("D1 migration SQL", () => {
  it("quotes values without accepting executable identifiers or unsafe numbers", () => {
    expect(sqlLiteral("Merchant's title\nnext line")).toBe("'Merchant''s title\nnext line'");
    expect(sqlLiteral(true)).toBe("1");
    expect(sqlLiteral(null)).toBe("NULL");
    expect(() => sqlLiteral(Number.NaN)).toThrow(/safe integers/);
    expect(() => buildInsertStatement({ table: "orders; DROP TABLE orders", row: { id: "one" } }))
      .toThrow(/identifier/);
  });

  it("builds insert-only and explicit overwrite statements", () => {
    expect(buildInsertStatement({
      table: "pages",
      row: { slug: "about", title: "About" },
      conflictColumns: ["slug"],
      mode: "insert-only",
    })).toContain('ON CONFLICT ("slug") DO NOTHING');
    expect(buildInsertStatement({
      table: "products",
      row: { id: "product_one", name: "One", status: "active" },
      conflictColumns: ["id"],
      mode: "overwrite",
    })).toContain('DO UPDATE SET "name" = excluded."name", "status" = excluded."status"');
  });

  it("makes an idempotent compare mismatch fail through a NOT NULL guard", () => {
    const statement = buildInsertStatement({
      table: "products",
      row: { id: "product_one", name: "One", status: "active" },
      conflictColumns: ["id"],
      mode: "compare",
      guardColumn: "name",
    });
    expect(statement).toContain('"products"."status" IS excluded."status"');
    expect(statement).toContain('ELSE NULL END');
    expect(() => buildInsertStatement({
      table: "products",
      row: { id: "product_one", name: null },
      conflictColumns: ["id"],
      mode: "compare",
      guardColumn: "name",
    })).toThrow(/non-null/);
  });

  it("rejects statements that could exceed D1's per-statement limit", () => {
    const hostile = "'".repeat(MAX_D1_STATEMENT_BYTES);
    expect(() => buildInsertStatement({ table: "pages", row: { slug: "one", content: hostile } }))
      .toThrow(/safety limit/);
  });

  it("chunks complete statements by count and UTF-8 bytes", () => {
    const statements = [
      buildInsertStatement({ table: "pages", row: { slug: "one" } }),
      buildInsertStatement({ table: "pages", row: { slug: "two" } }),
      buildInsertStatement({ table: "pages", row: { slug: "three" } }),
    ];
    const chunks = chunkSqlStatements(statements, { maxStatements: 2, maxBytes: 512 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].match(/INSERT/g)).toHaveLength(2);
    expect(chunks[1].match(/INSERT/g)).toHaveLength(1);
    expect(chunks.every((chunk) => chunk.endsWith(";\n"))).toBe(true);
  });
});
