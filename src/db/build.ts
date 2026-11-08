import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { DISHES, SCHEMA, STALLS, USERS, generateMealLogs } from './seed';

/** Create a fresh in-memory canteen database. */
export function buildDatabase(SQL: SqlJsStatic): Database {
  const db = new SQL.Database();
  db.exec(SCHEMA);
  db.exec('BEGIN');
  const insert = (sql: string, rows: (string | number)[][]) => {
    const st = db.prepare(sql);
    rows.forEach((r) => st.run(r));
    st.free();
  };
  insert('INSERT INTO stalls VALUES (?,?,?,?)', STALLS.map((s, i) => [i + 1, ...s]));
  insert(
    'INSERT INTO dishes VALUES (?,?,?,?,?,?)',
    DISHES.map(([stall, name, price, slot, veg], i) => [i + 1, stall, name, price, slot, veg]),
  );
  insert(
    'INSERT INTO nutrition VALUES (?,?,?,?,?,?)',
    DISHES.map(([, , , , , kcal, pro, carb, fat, sugar], i) => [i + 1, kcal, pro, carb, fat, sugar]),
  );
  insert('INSERT INTO users VALUES (?,?,?,?)', USERS.map((u, i) => [i + 1, ...u]));
  insert(
    'INSERT INTO meal_logs VALUES (?,?,?,?)',
    generateMealLogs().map((l) => [l.id, l.user_id, l.dish_id, l.eaten_at]),
  );
  db.exec('COMMIT');
  return db;
}

export interface QueryResult {
  columns: string[];
  rows: SqlValue[][];
}

/** Run SQL and return the last result set (empty if the statement returns nothing). */
export function runQuery(db: Database, sql: string): QueryResult {
  const res = db.exec(sql);
  if (res.length === 0) return { columns: [], rows: [] };
  const last = res[res.length - 1];
  return { columns: last.columns, rows: last.values };
}

export interface ColumnInfo { name: string; type: string; pk: boolean; fk?: string }
export interface TableInfo { name: string; columns: ColumnInfo[]; rowCount: number }

export function getSchema(db: Database): TableInfo[] {
  const tables = runQuery(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid").rows.map((r) => String(r[0]));
  return tables.map((t) => {
    const cols = runQuery(db, `PRAGMA table_info("${t}")`).rows;
    const fks = runQuery(db, `PRAGMA foreign_key_list("${t}")`).rows;
    const count = Number(runQuery(db, `SELECT COUNT(*) FROM "${t}"`).rows[0][0]);
    return {
      name: t,
      rowCount: count,
      columns: cols.map((c) => {
        const fk = fks.find((f) => f[3] === c[1]);
        return {
          name: String(c[1]),
          type: String(c[2]),
          pk: Number(c[5]) > 0,
          fk: fk ? `${fk[2]}.${fk[4]}` : undefined,
        };
      }),
    };
  });
}
