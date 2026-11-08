import type { Database, SqlValue } from 'sql.js';
import { runQuery } from '../db/build';
import { friendlyError } from './friendlyError';
import { stripComments } from './parseQuery';

export interface CheckResult {
  correct: boolean;
  message: string;
}

const norm = (v: SqlValue) => {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (v === null) return 'NULL';
  return String(v);
};

const key = (row: SqlValue[]) => JSON.stringify(row.map(norm));

/**
 * Compare a student's query with the lesson's solution by their results.
 * Column names don't matter; row order only matters when the solution uses ORDER BY.
 */
export function checkAnswer(db: Database, student: string, solution: string): CheckResult {
  if (!student.trim()) return { correct: false, message: 'Write a query first.' };
  let got;
  try {
    got = runQuery(db, student);
  } catch (e) {
    return { correct: false, message: friendlyError(db, e instanceof Error ? e.message : String(e)) };
  }
  const want = runQuery(db, solution);
  const ordered = /\border\s+by\b/i.test(stripComments(solution));

  if (got.columns.length !== want.columns.length) {
    return {
      correct: false,
      message: `Your result has ${got.columns.length} column${got.columns.length === 1 ? '' : 's'}, but the answer has ${want.columns.length}. Check which columns you SELECT.`,
    };
  }
  if (got.rows.length !== want.rows.length) {
    const s = stripComments(student);
    if (got.rows.length === 1 && /\b(count|sum|avg|min|max)\s*\(/i.test(s) && !/\bgroup\s+by\b/i.test(s) && /\bgroup\s+by\b/i.test(solution)) {
      return {
        correct: false,
        message: `Your aggregate squashed everything into 1 row, but the answer has ${want.rows.length} (one per group). Did you forget GROUP BY?`,
      };
    }
    return {
      correct: false,
      message: `Your result has ${got.rows.length} row${got.rows.length === 1 ? '' : 's'}, but the answer has ${want.rows.length}. Check your filters (WHERE / HAVING / LIMIT).`,
    };
  }
  const g = got.rows.map(key);
  const w = want.rows.map(key);
  const sameSet = [...g].sort().join('\n') === [...w].sort().join('\n');
  if (!sameSet) {
    return { correct: false, message: 'Right number of rows and columns, but some values are different. Look closely at the conditions and the columns you chose.' };
  }
  if (ordered && g.join('\n') !== w.join('\n')) {
    return { correct: false, message: 'The rows are right, but they are in a different order. Check your ORDER BY (ASC or DESC?).' };
  }
  return { correct: true, message: 'Correct. Your query returns exactly the right rows.' };
}
