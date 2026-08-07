import { describe, expect, it } from "vitest";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core";
import type { SQL } from "drizzle-orm";
import {
  MAX_ADMIN_SEARCH_PATTERN_BYTES,
  MAX_ADMIN_SEARCH_TERM_BYTES,
  isAdminSearchWithinLimit,
  normalizeSearchTerm,
  orderByForView,
  searchPredicate,
  viewPredicate,
  whereForView,
} from "@/lib/fulfillment/queries";

const dialect = new SQLiteAsyncDialect();
function compile(fragment: SQL) {
  const query = dialect.sqlToQuery(fragment);
  return { sql: query.sql.replace(/\s+/g, " ").trim(), params: query.params };
}

describe("fulfillment queue SQL", () => {
  it("keeps unpaid drafts out of awaiting and all views", () => {
    expect(compile(viewPredicate("awaiting")).sql).toBe(
      "status = 'processing' AND payment_status = 'paid'",
    );
    expect(compile(viewPredicate("all")).sql).toBe(
      "NOT (status = 'pending' AND COALESCE(payment_status, 'pending') <> 'paid')",
    );
  });

  it("normalizes and bounds LIKE input", () => {
    expect(normalizeSearchTerm(" Ac%me_Co\\ ")).toBe("acmeco");
    expect(normalizeSearchTerm("x".repeat(200))).toHaveLength(MAX_ADMIN_SEARCH_TERM_BYTES);
    expect(MAX_ADMIN_SEARCH_TERM_BYTES + 2).toBe(MAX_ADMIN_SEARCH_PATTERN_BYTES);

    const multibyte = "é".repeat(25);
    expect(normalizeSearchTerm(multibyte)).toBe("é".repeat(24));
    expect(new TextEncoder().encode(`%${normalizeSearchTerm(multibyte)}%`)).toHaveLength(
      MAX_ADMIN_SEARCH_PATTERN_BYTES,
    );
    expect(isAdminSearchWithinLimit("é".repeat(24))).toBe(true);
    expect(isAdminSearchWithinLimit(multibyte)).toBe(false);
  });

  it("searches only the allowlisted order/customer fields", () => {
    const query = compile(searchPredicate("acme"));
    expect(query.sql).toContain("lower(id) LIKE ?");
    expect(query.sql).toContain("json_valid(\"orders\".\"shipping_address\")");
    expect(query.sql).toContain("json_valid(\"orders\".\"extensions\")");
    expect(query.sql).toContain("json_type(\"orders\".\"shipping_address\") = 'text'");
    expect(query.sql).toContain("json_extract(\"orders\".\"shipping_address\", '$')");
    expect(query.params.filter((param) => param === "%acme%")).toHaveLength(5);
    expect(compile(whereForView("shipped", "acme")).sql).toContain(") AND (");
  });

  it("uses stable ISO timestamp ordering", () => {
    expect(compile(orderByForView("awaiting")).sql).toBe("created_at ASC, id ASC");
    expect(compile(orderByForView("shipped")).sql).toBe("created_at DESC, id DESC");
  });
});
