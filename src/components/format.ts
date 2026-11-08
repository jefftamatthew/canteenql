import type { SqlValue } from 'sql.js';

export function formatValue(v: SqlValue): string {
  if (v === null) return 'NULL';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  if (v instanceof Uint8Array) return `<${v.length} bytes>`;
  return String(v);
}

export const isNumber = (v: SqlValue) => typeof v === 'number';
