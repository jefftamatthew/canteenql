import type { Database, SqlValue } from 'sql.js';
import { runQuery, type QueryResult } from '../db/build';
import { buildStages, type StageKind, type StagePlan } from './buildStages';
import { parseForSteps, UNSUPPORTED_TEXT } from './parseQuery';
import { friendlyError } from './friendlyError';

export type RowStatus = 'kept' | 'dropped' | 'normal';

export interface StageRow {
  id: string;
  values: SqlValue[];
  status: RowStatus;
  /** Index of the group this row belongs to (GROUP BY stage). */
  group?: number;
  /** Label of the group (GROUP BY / HAVING stages). */
  groupLabel?: string;
}

export interface Stage {
  kind: StageKind;
  title: string;
  clause: string;
  sql: string;
  columns: string[];
  rows: StageRow[];
  note: string;
  /** Number of rows that move on to the next stage. */
  outCount: number;
}

export interface RunOutcome {
  /** The real result of the student's SQL (last result set). */
  result?: QueryResult;
  /** Friendly error message, if the SQL failed. */
  error?: string;
  rawError?: string;
  /** Step-by-step stages, when available. */
  stages?: Stage[];
  /** Why step-by-step is not shown, if it isn't. */
  unsupported?: string;
  /** Rows changed by INSERT / UPDATE / DELETE. */
  changes?: number;
  isSelect: boolean;
}

const HIDDEN = new Set(['_rid', '_keep', '_gk']);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function toRows(res: QueryResult, prefix: string) {
  const ridIx = res.columns.indexOf('_rid');
  const keepIx = res.columns.indexOf('_keep');
  const gkIx = res.columns.indexOf('_gk');
  const visible = res.columns.map((c, i) => (HIDDEN.has(c) ? -1 : i)).filter((i) => i >= 0);
  const seen = new Map<string, number>();
  const rows: StageRow[] = res.rows.map((r, i) => {
    let id = ridIx >= 0 ? `${prefix}${String(r[ridIx])}` : `${prefix}#${i}`;
    // Duplicated ids can happen (e.g. same group twice); keep keys unique for React.
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n > 0) id = `${id}~${n}`;
    return {
      id,
      values: visible.map((ix) => r[ix]),
      status: keepIx >= 0 ? (Number(r[keepIx]) === 1 ? 'kept' : 'dropped') : 'normal',
      groupLabel: gkIx >= 0 ? String(r[gkIx]) : undefined,
    };
  });
  return { columns: visible.map((ix) => res.columns[ix]), rows };
}

/** Plain-language note for a step. It reads after the clause name, e.g. "WHERE" + "checks each row…". */
function noteFor(plan: StagePlan, rows: StageRow[], prev: Stage | undefined): string {
  const i = plan.info;
  const kept = rows.filter((r) => r.status !== 'dropped').length;
  const dropped = rows.length - kept;
  const removed = `${dropped} ${dropped === 1 ? 'is' : 'are'} removed`;
  switch (plan.kind) {
    case 'from':
      return `starts with every row in the ${i.table} table: ${plural(rows.length, 'row')}.`;
    case 'join': {
      const base = `attaches rows from ${i.table}`;
      if (!i.hasOn) return `${base} to every row, making every possible combination: ${plural(rows.length, 'row')}.`;
      const how = String(i.join).startsWith('LEFT')
        ? 'Rows with no match are still kept, with empty (NULL) values.'
        : 'Rows with no match are left out.';
      return `${base} wherever ${i.on} is true. ${how} Now there are ${plural(rows.length, 'row')}.`;
    }
    case 'where':
      return `checks each row: is ${i.condition} true? ${plural(kept, 'row')} pass and ${removed}.`;
    case 'group': {
      const groups = new Set(rows.map((r) => r.groupLabel)).size;
      return `sorts the ${plural(rows.length, 'row')} into piles that share the same ${i.keys}: ${plural(groups, 'group')}. Each pile will become one row.`;
    }
    case 'having':
      return `checks each group, not each row: is ${i.condition} true? ${plural(kept, 'group')} pass and ${removed}.`;
    case 'select': {
      const before = prev ? prev.outCount : rows.length;
      if (i.grouped) return `turns each group into one row and works out the columns you asked for: ${plural(rows.length, 'row')}.`;
      if (i.aggregate) return `uses an aggregate function, which squashes all ${plural(before, 'row')} into one summary row.`;
      if (i.distinct) return `keeps the columns you asked for and removes duplicates: ${plural(before, 'row')} became ${plural(rows.length, 'row')}.`;
      if (i.star) return `keeps every column of the ${plural(rows.length, 'row')}.`;
      return `keeps only the columns you asked for. Still ${plural(rows.length, 'row')}, but narrower.`;
    }
    case 'order':
      return `sorts the rows by ${i.order}${i.desc ? ', biggest first' : ', smallest first'}.`;
    case 'limit':
      return i.hasOffset
        ? `skips the first ${i.offset} rows, then keeps the next ${i.limit}. This is the final answer.`
        : `keeps only the first ${i.limit} rows. This is the final answer.`;
  }
}

function runPlan(db: Database, plans: StagePlan[]): Stage[] {
  const stages: Stage[] = [];
  let groupIndex = new Map<string, number>();
  let selectPrefix = 'r:';
  plans.forEach((plan) => {
    const prev = stages[stages.length - 1];
    let columns: string[];
    let rows: StageRow[];

    if (plan.kind === 'limit') {
      const res = runQuery(db, plan.sql);
      const lim = Number(res.rows[0][0]);
      const off = Number(res.rows[0][1]) || 0;
      columns = prev.columns;
      rows = prev.rows
        .filter((r) => r.status !== 'dropped')
        .map((r, i) => ({
          ...r,
          status: i >= off && (lim < 0 || i < off + lim) ? 'kept' : 'dropped',
        }));
    } else {
      const res = runQuery(db, plan.sql);
      // Rows keep the same id across stages, so they animate smoothly from one step to the next.
      if (plan.kind === 'select') selectPrefix = plan.info.grouped || plan.info.aggregate ? 'g:' : 'r:';
      const prefix = plan.kind === 'having' ? 'g:' : plan.kind === 'select' || plan.kind === 'order' ? selectPrefix : 'r:';
      ({ columns, rows } = toRows(res, prefix));
    }

    if (plan.kind === 'group') {
      groupIndex = new Map();
      rows.forEach((r) => {
        const label = r.groupLabel ?? '';
        if (!groupIndex.has(label)) groupIndex.set(label, groupIndex.size);
        r.group = groupIndex.get(label);
      });
    }
    if (plan.kind === 'having') {
      rows.forEach((r) => {
        const label = r.id.replace(/^g:/, '');
        r.groupLabel = label;
        r.group = groupIndex.get(label);
      });
    }

    stages.push({
      kind: plan.kind,
      title: plan.title,
      clause: plan.clause,
      sql: plan.sql,
      columns,
      rows,
      note: noteFor(plan, rows, prev),
      outCount: rows.filter((r) => r.status !== 'dropped').length,
    });
  });
  return stages;
}

/** Run the student's SQL, and if possible build the step-by-step stages for it. */
export function runWithSteps(db: Database, sql: string): RunOutcome {
  if (!sql.trim()) return { error: 'Type a query first, then press Run.', isSelect: false };
  const parsed = parseForSteps(sql);
  const isSelect = parsed.ok || parsed.isSelect;

  let result: QueryResult;
  try {
    result = runQuery(db, sql);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { error: friendlyError(db, raw), rawError: raw, isSelect };
  }
  const changes = isSelect ? undefined : db.getRowsModified();

  if (!parsed.ok) return { result, unsupported: UNSUPPORTED_TEXT[parsed.reason], changes, isSelect };

  try {
    const columnsOf = (table: string) => runQuery(db, `PRAGMA table_info("${table.replace(/"/g, '""')}")`).rows.map((r) => String(r[1]));
    const plans = buildStages(parsed.ast, { columnsOf });
    return { result, stages: runPlan(db, plans), isSelect: true };
  } catch {
    return { result, unsupported: UNSUPPORTED_TEXT.parse, isSelect: true };
  }
}
