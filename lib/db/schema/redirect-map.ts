import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Exact legacy URL mappings populated by migration tooling. */
export const redirectMap = sqliteTable("redirect_map", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  sourcePath: text("source_path").notNull().unique(),
  targetPath: text("target_path").notNull(),
  statusCode: integer("status_code", { mode: "number" }).notNull().default(301),
  entityType: text("entity_type"),
  createdAt: integer("created_at", { mode: "number" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index("redirect_map_source_path_idx").on(table.sourcePath),
  check("redirect_map_source_path_check", sql`
    length(${table.sourcePath}) BETWEEN 3 AND 2048
    AND substr(${table.sourcePath}, 1, 1) = '/'
    AND substr(${table.sourcePath}, 1, 2) != '//'
    AND instr(${table.sourcePath}, '?') = 0
    AND instr(${table.sourcePath}, '#') = 0
    AND instr(${table.sourcePath}, char(92)) = 0
    AND instr(${table.sourcePath}, char(0)) = 0
    AND instr(${table.sourcePath}, char(9)) = 0
    AND instr(${table.sourcePath}, char(10)) = 0
    AND instr(${table.sourcePath}, char(13)) = 0
  `),
  check("redirect_map_target_path_check", sql`
    length(${table.targetPath}) BETWEEN 1 AND 2048
    AND substr(${table.targetPath}, 1, 1) = '/'
    AND substr(${table.targetPath}, 1, 2) != '//'
    AND instr(${table.targetPath}, '?') = 0
    AND instr(${table.targetPath}, '#') = 0
    AND instr(${table.targetPath}, char(92)) = 0
    AND instr(${table.targetPath}, char(0)) = 0
    AND instr(${table.targetPath}, char(9)) = 0
    AND instr(${table.targetPath}, char(10)) = 0
    AND instr(${table.targetPath}, char(13)) = 0
  `),
  check("redirect_map_no_direct_loop_check", sql`${table.sourcePath} != ${table.targetPath}`),
  check("redirect_map_no_legacy_target_check", sql`
    ${table.targetPath} NOT LIKE '/products/%'
    AND ${table.targetPath} NOT LIKE '/collections/%'
    AND ${table.targetPath} NOT LIKE '/pages/%'
    AND ${table.targetPath} NOT LIKE '/blogs/%'
    AND ${table.targetPath} NOT LIKE '/policies/%'
  `),
  check("redirect_map_status_code_check", sql`${table.statusCode} IN (301, 308)`),
  check("redirect_map_entity_type_check", sql`
    ${table.entityType} IS NULL OR length(trim(${table.entityType})) BETWEEN 1 AND 64
  `),
  check("redirect_map_created_at_check", sql`${table.createdAt} >= 0`),
]);

export type RedirectMapRow = typeof redirectMap.$inferSelect;
export type RedirectMapInsert = typeof redirectMap.$inferInsert;
