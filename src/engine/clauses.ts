// Splits a SQL statement into its top-level clauses (SELECT, FROM, JOIN, WHERE, …),
// ignoring anything inside strings, comments or brackets. Used by "Tidy up" and by
// the error card's suggested fixes.

export type ClauseKw = 'SELECT' | 'FROM' | 'JOIN' | 'WHERE' | 'GROUP BY' | 'HAVING' | 'ORDER BY' | 'LIMIT';

export const CLAUSE_RANK: Record<ClauseKw, number> = {
  SELECT: 0,
  FROM: 1,
  JOIN: 2,
  WHERE: 3,
  'GROUP BY': 4,
  HAVING: 5,
  'ORDER BY': 6,
  LIMIT: 7,
};

export interface Segment {
  kw: ClauseKw;
  /** Where the clause starts in the original text. */
  start: number;
  /** The clause text, trimmed, without a trailing semicolon. */
  text: string;
  /** Length of the keyword as written (e.g. "left join"). */
  kwLength: number;
}

const KEYWORDS: [RegExp, ClauseKw][] = [
  [/^select\b/i, 'SELECT'],
  [/^from\b/i, 'FROM'],
  [/^(?:(?:left|right|full)\s+(?:outer\s+)?|inner\s+|cross\s+)?join\b/i, 'JOIN'],
  [/^where\b/i, 'WHERE'],
  [/^group\s+by\b/i, 'GROUP BY'],
  [/^having\b/i, 'HAVING'],
  [/^order\s+by\b/i, 'ORDER BY'],
  [/^limit\b/i, 'LIMIT'],
];

/** Positions of top-level clause keywords. */
export function findClauses(sql: string): { kw: ClauseKw; start: number; length: number }[] {
  const found: { kw: ClauseKw; start: number; length: number }[] = [];
  let depth = 0;
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      const end = sql.indexOf(ch, i + 1);
      i = end < 0 ? sql.length : end + 1;
      continue;
    }
    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      i = end < 0 ? sql.length : end + 1;
      continue;
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end < 0 ? sql.length : end + 2;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && /[a-z]/i.test(ch) && (i === 0 || !/[\w.]/.test(sql[i - 1]))) {
      const rest = sql.slice(i);
      for (const [re, kw] of KEYWORDS) {
        const m = rest.match(re);
        if (m) {
          found.push({ kw, start: i, length: m[0].length });
          i += m[0].length;
          break;
        }
      }
      // skip the rest of this word
      while (i < sql.length && /\w/.test(sql[i])) i++;
      continue;
    }
    i++;
  }
  return found;
}

export function segments(sql: string): Segment[] {
  const found = findClauses(sql);
  return found.map((f, i) => {
    const end = i + 1 < found.length ? found[i + 1].start : sql.length;
    return { kw: f.kw, start: f.start, kwLength: f.length, text: sql.slice(f.start, end).trim().replace(/;\s*$/, '').trim() };
  });
}

const hasSemicolon = (sql: string) => /;\s*$/.test(sql.trim());

/** Put each top-level clause on its own line, with the keyword in capitals. */
export function tidy(sql: string): string {
  const segs = segments(sql);
  if (segs.length === 0) return sql;
  const lines = segs.map((s) => {
    const kw = s.text.slice(0, s.kwLength).toUpperCase().replace(/\s+/g, ' ');
    let rest = s.text.slice(s.kwLength).replace(/\s+/g, ' ');
    if (s.kw === 'WHERE' || s.kw === 'HAVING') rest = rest.replace(/ (and|or) /gi, (_m, op: string) => `\n  ${op.toUpperCase()} `);
    return kw + rest;
  });
  return lines.join('\n') + ';';
}

/** The first clause written after one that should come later, if any. */
export function misplacedClause(sql: string): { clause: Segment; after: Segment } | null {
  const segs = segments(sql);
  let maxSeg: Segment | null = null;
  for (const s of segs) {
    if (maxSeg && CLAUSE_RANK[s.kw] < CLAUSE_RANK[maxSeg.kw]) return { clause: s, after: maxSeg };
    if (!maxSeg || CLAUSE_RANK[s.kw] >= CLAUSE_RANK[maxSeg.kw]) maxSeg = s;
  }
  return null;
}

/** Rewrite the query with its clauses in the order SQL requires. */
export function reorderClauses(sql: string): string {
  const segs = segments(sql);
  const sorted = segs
    .map((s, i) => ({ s, i }))
    .sort((a, b) => CLAUSE_RANK[a.s.kw] - CLAUSE_RANK[b.s.kw] || a.i - b.i)
    .map((x) => x.s.text);
  return sorted.join('\n') + (hasSemicolon(sql) ? ';' : '');
}

/** Replace one clause's text and return the rebuilt query (clauses in their original order). */
export function rebuild(segs: Segment[], semicolon: boolean): string {
  return segs.map((s) => s.text).join('\n') + (semicolon ? ';' : '');
}

export function lineOf(sql: string, index: number): number {
  return sql.slice(0, index).split('\n').length;
}

export { hasSemicolon };
