import { describe, expect, it } from "vitest";
import { SQLiteAsyncDialect, getTableConfig } from "drizzle-orm/sqlite-core";
import type { SQL } from "drizzle-orm";
import { orderEvents } from "@/lib/db/schema/order-events";
import { orderEvents as reExportedOrderEvents } from "@/lib/db/schema";
import { orders } from "@/lib/db/schema/order";

describe("fulfillment database schema", () => {
  it("exposes shipping_carrier as nullable text on orders", () => {
    const carrier = getTableConfig(orders).columns.find(
      (column) => column.name === "shipping_carrier",
    );

    expect(carrier).toBeDefined();
    expect(carrier?.notNull).toBe(false);
  });

  it("declares canonical ISO UTC defaults for order timestamps", () => {
    const columns = getTableConfig(orders).columns;
    const dialect = new SQLiteAsyncDialect();
    for (const name of ["created_at", "updated_at"]) {
      const column = columns.find((candidate) => candidate.name === name);
      const compiled = dialect.sqlToQuery(column?.default as SQL).sql;
      expect(compiled).toContain("strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
    }
  });

  it("maps every order_events migration column", () => {
    const columns = getTableConfig(orderEvents).columns;

    expect(getTableConfig(orderEvents).name).toBe("order_events");
    expect(columns.map((column) => column.name).sort()).toEqual(
      [
        "actor_id",
        "actor_type",
        "created_at",
        "details",
        "event_type",
        "from_status",
        "id",
        "order_id",
        "to_status",
      ].sort(),
    );
    expect(columns.filter((column) => column.notNull).map((column) => column.name).sort())
      .toEqual(["actor_type", "created_at", "event_type", "id", "order_id"].sort());
  });

  it("uses JSON mode for event details and re-exports the table", () => {
    const details = getTableConfig(orderEvents).columns.find(
      (column) => column.name === "details",
    );

    expect(details?.mapToDriverValue({ carrier: "ups" })).toBe('{"carrier":"ups"}');
    expect(reExportedOrderEvents).toBe(orderEvents);
  });

  it("declares the order foreign key with ON DELETE CASCADE", () => {
    const [foreignKey] = getTableConfig(orderEvents).foreignKeys;
    const reference = foreignKey.reference();

    expect(reference.columns.map((column) => column.name)).toEqual(["order_id"]);
    expect(reference.foreignColumns.map((column) => column.name)).toEqual(["id"]);
    expect(foreignKey.onDelete).toBe("cascade");
  });
});
