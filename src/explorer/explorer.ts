import type { Database } from 'sql.js';
import { runQuery, type QueryResult } from '../db/build';

export type SortKey = 'protein' | 'price' | 'kcal';
export type StepKind = 'from' | 'join' | 'where' | 'select' | 'order' | 'limit';

export interface Filters {
  maxPrice: number;
  minProtein: number;
  buildings: string[];
  halal: boolean;
  vegetarian: boolean;
  lowSugar: boolean;
  sort: SortKey;
  limit: number | null;
}

export const PRICE = { min: 30, max: 150, step: 5 }; // max = no price rule
export const PROTEIN = { min: 0, max: 45, step: 1 }; // 0 = no protein rule
export const LOW_SUGAR_G = 10;
export const BUILDINGS = ['A', 'B', 'C'];

export const DEFAULT_FILTERS: Filters = {
  maxPrice: 100,
  minProtein: 25,
  buildings: ['B'],
  halal: false,
  vegetarian: false,
  lowSugar: false,
  sort: 'protein',
  limit: 3,
};

export const SORTS: Record<SortKey, { label: string; sql: string; adj: string; phrase: string; column: string; unit: string }> = {
  protein: { label: 'Most protein', sql: 'n.protein_g DESC', adj: 'highest-protein', phrase: 'most protein first', column: 'protein_g', unit: 'g' },
  price: { label: 'Cheapest', sql: 'd.price ASC', adj: 'cheapest', phrase: 'cheapest first', column: 'price', unit: 'NT$' },
  kcal: { label: 'Fewest calories', sql: 'n.kcal ASC', adj: 'lowest-calorie', phrase: 'fewest calories first', column: 'kcal', unit: 'kcal' },
};

export type FilterKey = 'price' | 'protein' | 'building' | 'halal' | 'vegetarian' | 'sugar';

export interface Rule {
  key: FilterKey;
  /** SQL condition, e.g. d.price <= 100 */
  sql: string;
  /** Stamp text for a row that fails it. */
  fail: string;
}

export function rules(f: Filters): Rule[] {
  const out: Rule[] = [];
  if (f.maxPrice < PRICE.max) out.push({ key: 'price', sql: `d.price <= ${f.maxPrice}`, fail: `Out: price > ${f.maxPrice}` });
  if (f.minProtein > PROTEIN.min) out.push({ key: 'protein', sql: `n.protein_g >= ${f.minProtein}`, fail: `Out: protein < ${f.minProtein}` });
  if (f.buildings.length === 1) {
    out.push({ key: 'building', sql: `s.building = '${f.buildings[0]}'`, fail: `Out: not building ${f.buildings[0]}` });
  } else if (f.buildings.length > 1 && f.buildings.length < BUILDINGS.length) {
    out.push({ key: 'building', sql: `s.building IN (${f.buildings.map((b) => `'${b}'`).join(', ')})`, fail: `Out: not building ${f.buildings.join('/')}` });
  }
  if (f.halal) out.push({ key: 'halal', sql: 's.is_halal = 1', fail: 'Out: not halal' });
  if (f.vegetarian) out.push({ key: 'vegetarian', sql: 'd.is_vegetarian = 1', fail: 'Out: not vegetarian' });
  if (f.lowSugar) out.push({ key: 'sugar', sql: `n.sugar_g <= ${LOW_SUGAR_G}`, fail: `Out: sugar > ${LOW_SUGAR_G} g` });
  return out;
}

export interface SqlLine {
  kw: string;
  rest: string;
  step: StepKind;
}

const JOINS = 'JOIN stalls s ON d.stall_id = s.id JOIN nutrition n ON d.id = n.dish_id';

export function selectColumns(f: Filters): string[] {
  const cols = ['d.name', 's.stall_name', 'd.price', 'n.protein_g'];
  if (f.sort === 'kcal') cols.push('n.kcal');
  return cols;
}

/** The query the filters write, one clause per line. */
export function sqlLines(f: Filters): SqlLine[] {
  const lines: SqlLine[] = [
    { kw: 'SELECT', rest: ` ${selectColumns(f).join(', ')}`, step: 'select' },
    { kw: 'FROM', rest: ' dishes d', step: 'from' },
    { kw: 'JOIN', rest: ' stalls s ON d.stall_id = s.id', step: 'join' },
    { kw: 'JOIN', rest: ' nutrition n ON d.id = n.dish_id', step: 'join' },
  ];
  rules(f).forEach((r, i) => lines.push({ kw: i === 0 ? 'WHERE' : '  AND', rest: ` ${r.sql}`, step: 'where' }));
  lines.push({ kw: 'ORDER BY', rest: ` ${SORTS[f.sort].sql}`, step: 'order' });
  if (f.limit) lines.push({ kw: 'LIMIT', rest: ` ${f.limit}`, step: 'limit' });
  const last = lines[lines.length - 1];
  last.rest += ';';
  return lines;
}

export function toSql(f: Filters): string {
  return sqlLines(f)
    .map((l) => l.kw + l.rest)
    .join('\n');
}

/** The filters as a plain-English question. */
export function describe(f: Filters): string {
  const diet = [f.halal && 'halal', f.vegetarian && 'vegetarian', f.lowSugar && 'low-sugar'].filter(Boolean).join(' ');
  const head = f.limit ? `The ${f.limit} ${SORTS[f.sort].adj}` : 'All';
  const parts: string[] = [];
  if (f.maxPrice < PRICE.max) parts.push(`at NT$${f.maxPrice} or less`);
  if (f.minProtein > PROTEIN.min) parts.push(`with ${f.minProtein} g of protein or more`);
  if (f.buildings.length > 0 && f.buildings.length < BUILDINGS.length) {
    parts.push(f.buildings.length === 1 ? `in Building ${f.buildings[0]}` : `in Buildings ${f.buildings.slice(0, -1).join(', ')} and ${f.buildings[f.buildings.length - 1]}`);
  }
  const tail = f.limit ? '' : `, ${SORTS[f.sort].phrase}`;
  return `${head} ${diet ? `${diet} ` : ''}dishes${parts.length ? ` ${parts.join(', ')}` : ''}${tail}.`;
}

export interface Ticket {
  id: number;
  name: string;
  stallLine: string;
  detailLine: string;
  price: number;
  /** Red stamp text when this row is removed at this step. */
  stamp?: string;
  /** Shown on rows that pass WHERE. */
  passes?: string;
  rank?: number;
}

export interface Step {
  kind: StepKind;
  label: string;
  /** e.g. "8 rows" for the step button */
  rowsLabel: string;
  /** The big number, e.g. "4 of 8" */
  rowCount: string;
  text: string;
  tickets: Ticket[];
}

export interface DishPoint {
  id: number;
  name: string;
  price: number;
  protein: number;
  kcal: number;
  inResult: boolean;
}

export interface ExplorerRun {
  sql: string;
  lines: SqlLine[];
  question: string;
  steps: Step[];
  result: QueryResult;
  points: DishPoint[];
}

interface Row {
  id: number;
  name: string;
  price: number;
  stallId: number;
  stall: string;
  building: string;
  protein: number;
  kcal: number;
  failed: number; // index of the first rule this row fails, -1 if none
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function runExplorer(db: Database, f: Filters): ExplorerRun {
  const rs = rules(f);
  const flags = rs.map((r, i) => `, CASE WHEN ${r.sql} THEN 1 ELSE 0 END AS r${i}`).join('');
  const base = runQuery(
    db,
    `SELECT d.id, d.name, d.price, d.stall_id, s.stall_name, s.building, n.protein_g, n.kcal${flags} FROM dishes d ${JOINS} ORDER BY d.id`,
  );
  const rows: Row[] = base.rows.map((r) => {
    const failed = rs.findIndex((_, i) => Number(r[8 + i]) !== 1);
    return {
      id: Number(r[0]),
      name: String(r[1]),
      price: Number(r[2]),
      stallId: Number(r[3]),
      stall: String(r[4]),
      building: String(r[5]),
      protein: Number(r[6]),
      kcal: Number(r[7]),
      failed,
    };
  });
  const where = rs.length ? ` WHERE ${rs.map((r) => r.sql).join(' AND ')}` : '';
  const orderedIds = runQuery(db, `SELECT d.id FROM dishes d ${JOINS}${where} ORDER BY ${SORTS[f.sort].sql}`).rows.map((r) => Number(r[0]));
  const sql = toSql(f);
  const result = runQuery(db, sql);

  const byId = new Map(rows.map((r) => [r.id, r]));
  const passing = rows.filter((r) => r.failed < 0);
  const ordered = orderedIds.map((id) => byId.get(id)!);
  const finalIds = new Set(ordered.slice(0, f.limit ?? ordered.length).map((r) => r.id));
  const detail = (r: Row) => (f.sort === 'kcal' ? `${r.kcal} kcal, ${r.protein} g protein` : `${r.protein} g protein`);
  const usesBuilding = rs.some((r) => r.sql.startsWith('s.building'));

  const steps: Step[] = [];
  steps.push({
    kind: 'from',
    label: 'FROM',
    rowsLabel: plural(rows.length, 'row'),
    rowCount: String(rows.length),
    text: 'starts with every row in the dishes table. It only knows each stall by its number so far.',
    tickets: rows.map((r) => ({
      id: r.id,
      name: r.name,
      price: r.price,
      stallLine: `stall_id ${r.stallId}`,
      detailLine: f.sort === 'kcal' ? 'calories not joined yet' : 'protein not joined yet',
    })),
  });
  steps.push({
    kind: 'join',
    label: 'JOIN',
    rowsLabel: plural(rows.length, 'row'),
    rowCount: String(rows.length),
    text: 'attaches each dish to its stall and its nutrition facts, matched by id. Now every ticket knows its building and protein.',
    tickets: rows.map((r) => ({ id: r.id, name: r.name, price: r.price, stallLine: `${r.stall}, Building ${r.building}`, detailLine: detail(r) })),
  });
  if (rs.length) {
    const fails = rows.length - passing.length;
    steps.push({
      kind: 'where',
      label: 'WHERE',
      rowsLabel: plural(passing.length, 'row'),
      rowCount: `${passing.length} of ${rows.length}`,
      text:
        rs.length === 1
          ? `checks the rule on every row. ${fails} of ${rows.length} dishes fail it and are stamped out.`
          : `checks all ${rs.length} rules on every row. ${fails} of ${rows.length} dishes fail at least one rule and are stamped out.`,
      tickets: rows.map((r) => ({
        id: r.id,
        name: r.name,
        price: r.price,
        stallLine: `${r.stall}, Building ${r.building}`,
        detailLine: detail(r),
        stamp: r.failed >= 0 ? rs[r.failed].fail : undefined,
        passes: r.failed < 0 ? (rs.length === 1 ? 'Passes the rule' : `Passes all ${rs.length} rules`) : undefined,
      })),
    });
  }
  steps.push({
    kind: 'select',
    label: 'SELECT',
    rowsLabel: plural(passing.length, 'row'),
    rowCount: String(passing.length),
    text: usesBuilding
      ? 'keeps only the columns you asked for. Building was only needed for filtering, so it is dropped.'
      : 'keeps only the columns you asked for: name, stall, price and protein.',
    tickets: passing.map((r) => ({ id: r.id, name: r.name, price: r.price, stallLine: r.stall, detailLine: detail(r) })),
  });
  steps.push({
    kind: 'order',
    label: 'ORDER BY',
    rowsLabel: plural(ordered.length, 'row'),
    rowCount: String(ordered.length),
    text: `sorts the dishes that are left, ${SORTS[f.sort].phrase}.`,
    tickets: ordered.map((r, i) => ({ id: r.id, name: r.name, price: r.price, stallLine: r.stall, detailLine: detail(r), rank: i + 1 })),
  });
  if (f.limit) {
    const cut = ordered.slice(f.limit);
    const kept = Math.min(f.limit, ordered.length);
    const ord = (n: number) =>
      `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
    steps.push({
      kind: 'limit',
      label: 'LIMIT',
      rowsLabel: plural(kept, 'row'),
      rowCount: String(kept),
      text:
        cut.length === 0
          ? `keeps the first ${f.limit} rows. Only ${plural(ordered.length, 'dish')} made it this far, so nothing is cut. This is the final answer.`
          : cut.length === 1
            ? `keeps the first ${f.limit} rows. ${cut[0].name} is ${ord(f.limit + 1)}, so it is cut. This is the final answer.`
            : `keeps the first ${f.limit} rows. The other ${cut.length} dishes are cut. This is the final answer.`,
      tickets: ordered.map((r, i) => ({
        id: r.id,
        name: r.name,
        price: r.price,
        stallLine: r.stall,
        detailLine: detail(r),
        rank: i + 1,
        stamp: i >= f.limit! ? 'Cut by LIMIT' : undefined,
      })),
    });
  }

  return {
    sql,
    lines: sqlLines(f),
    question: describe(f),
    steps,
    result,
    points: rows.map((r) => ({ id: r.id, name: r.name, price: r.price, protein: r.protein, kcal: r.kcal, inResult: finalIds.has(r.id) })),
  };
}

/** The SQL tag shown under a filter, e.g. "AND protein_g >= 25", or null when the filter adds no rule. */
export function tagFor(f: Filters, key: FilterKey): string | null {
  const rs = rules(f);
  const i = rs.findIndex((r) => r.key === key);
  if (i < 0) return null;
  return `${i === 0 ? 'WHERE' : 'AND'} ${rs[i].sql.replace(/\b[dns]\./g, '')}`;
}
