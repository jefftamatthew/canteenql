// Node-only helper for Vitest.
import initSqlJs from 'sql.js';
import { buildDatabase } from './build';

export async function makeTestDb() {
  const SQL = await initSqlJs();
  return buildDatabase(SQL);
}
