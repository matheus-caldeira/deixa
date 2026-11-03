import { getTableName, sql, type AnyColumn, type SQL } from "drizzle-orm";

export function qualified(column: AnyColumn): SQL {
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
}
