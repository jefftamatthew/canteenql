import type { Database } from 'sql.js';
import { closest, friendlyError, names } from './friendlyError';
import { hasSemicolon, lineOf, misplacedClause, rebuild, reorderClauses, segments } from './clauses';

export interface Fix {
  title: string;
  description: string;
  /** The corrected query. */
  sql: string;
  /** A few lines of the corrected query to preview, with the changed line marked. */
  preview: { text: string; changed: boolean; family?: 'where' | 'having' | 'other' }[];
  button: string;
}

export interface ErrorExplanation {
  title: string;
  /** Plain-language explanation. `backticks` render as code, **stars** as bold. */
  body: string;
  fixes: Fix[];
  /** Character range in the query to underline. */
  range?: { from: number; to: number };
  /** Line number to point at, if known. */
  line?: number;
  raw: string;
}

const AGG = /\b(count|sum|avg|min|max)\s*\(/i;

/** A short preview: the changed clause plus its neighbours. */
function previewAround(sql: string, changedText: string, family: Fix['preview'][number]['family']): Fix['preview'] {
  const lines = sql.replace(/;\s*$/, '').split('\n');
  const idx = lines.findIndex((l) => l.trim() === changedText.trim());
  const from = Math.max(0, idx - 1);
  const to = Math.min(lines.length, idx + 2);
  return lines.slice(from, to).map((text, i) => ({
    text: text + (from + i === lines.length - 1 && hasSemicolon(sql) ? ';' : ''),
    changed: from + i === idx,
    family: from + i === idx ? family : undefined,
  }));
}

function replaceWord(sql: string, word: string, replacement: string): string {
  const re = new RegExp(`(?<![\\w.'"])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w'"])`, 'g');
  return sql.replace(re, replacement);
}

function rangeOfWord(sql: string, word: string): { from: number; to: number } | undefined {
  const i = sql.search(new RegExp(`(?<![\\w'"])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w'"])`));
  return i >= 0 ? { from: i, to: i + word.length } : undefined;
}

/** Turn a failed query into a title, an explanation and up to two one-click fixes. */
export function explainError(db: Database, sql: string, raw: string): ErrorExplanation {
  const msg = raw.replace(/^Error:\s*/, '');
  let m: RegExpMatchArray | null;

  // 1. Clauses in the wrong order (SQLite just says "syntax error")
  const misplaced = misplacedClause(sql);
  if (/syntax error|incomplete input/i.test(msg) && misplaced) {
    const { clause, after } = misplaced;
    const line = lineOf(sql, clause.start);
    const fixes: Fix[] = [];
    const moved = reorderClauses(sql);
    const groupWord = after.kw === 'GROUP BY' || after.kw === 'HAVING' || after.kw === 'ORDER BY' || after.kw === 'LIMIT';
    const isWhereAfterGroup = clause.kw === 'WHERE' && (after.kw === 'GROUP BY' || after.kw === 'HAVING');

    fixes.push({
      title: clause.kw === 'WHERE' ? 'Filter rows first' : `Move ${clause.kw} up`,
      description:
        clause.kw === 'WHERE' && groupWord
          ? 'Keep the rule as it is, but check it on each row before grouping.'
          : `Put ${clause.kw} where SQL expects it.`,
      sql: moved,
      preview: previewAround(moved, clause.text, clause.kw === 'WHERE' ? 'where' : 'other'),
      button: `Move ${clause.kw} up`,
    });

    if (isWhereAfterGroup) {
      // Offer the HAVING version: filter whole groups instead of single rows.
      const cond = clause.text.slice(clause.kwLength).trim();
      let havingCond = cond;
      if (!AGG.test(cond)) {
        // Wrap the column in the same aggregate the SELECT uses, e.g. d.price -> AVG(d.price)
        const select = segments(sql).find((s) => s.kw === 'SELECT')?.text ?? '';
        const cm = cond.match(/^([\w.]+)\s*(<=|>=|<>|!=|=|<|>)\s*(.+)$/);
        const agg = cm && select.match(new RegExp(`\\b(AVG|SUM|MIN|MAX|COUNT)\\s*\\(\\s*${cm[1].replace('.', '\\.')}\\s*\\)`, 'i'));
        havingCond = cm && agg ? `${agg[0]} ${cm[2]} ${cm[3]}` : '';
      }
      if (havingCond) {
        const segs = segments(sql).filter((s) => s !== clause && s.start !== clause.start);
        const existing = segs.find((s) => s.kw === 'HAVING');
        const havingText = existing ? `${existing.text} AND ${havingCond}` : `HAVING ${havingCond}`;
        const groupIdx = segs.findIndex((s) => s.kw === 'GROUP BY');
        const out = segs.map((s) => ({ ...s }));
        if (existing) out.find((s) => s.kw === 'HAVING')!.text = havingText;
        else out.splice(groupIdx + 1, 0, { kw: 'HAVING', start: -1, kwLength: 6, text: havingText });
        const fixed = rebuild(out, hasSemicolon(sql));
        fixes.push({
          title: 'Filter groups after',
          description: AGG.test(cond) ? 'Your rule uses a total, so it belongs in HAVING.' : 'Check the rule on each whole group, after grouping.',
          sql: fixed,
          preview: previewAround(fixed, havingText, 'having'),
          button: 'Change to HAVING',
        });
      }
    }

    const body = isWhereAfterGroup
      ? `On line ${line}, WHERE comes after ${after.kw}. WHERE filters single rows **before** they are grouped, so it must come first. To filter whole groups **after** grouping, use HAVING.`
      : `On line ${line}, ${clause.kw} comes after ${after.kw}. SQL clauses always go in this order: SELECT, FROM, JOIN, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT.`;
    return {
      title: `${clause.kw} has to come before ${after.kw}.`,
      body,
      fixes,
      range: { from: clause.start, to: clause.start + clause.text.length },
      line,
      raw: msg,
    };
  }

  // 2. Misspelled column
  if ((m = msg.match(/no such column: ([\w.]+)/i))) {
    const full = m[1];
    const [qual, col] = full.includes('.') ? full.split('.') : [null, full];
    const all = names(db);
    const hint = closest(col, all.columns);
    const fixes: Fix[] = [];
    const owner = all.tablesWith(col);
    if (hint && hint.toLowerCase() !== col.toLowerCase()) {
      const fixed = replaceWord(sql, full, qual ? `${qual}.${hint}` : hint);
      const changedLine = fixed.split('\n').find((l) => l.includes(hint)) ?? fixed;
      fixes.push({
        title: `Use ${hint}`,
        description: `The closest column name is ${hint}.`,
        sql: fixed,
        preview: previewAround(fixed, changedLine, 'other'),
        button: `Change to ${hint}`,
      });
    }
    const body =
      fixes.length > 0
        ? `Check the spelling: did you mean \`${hint}\`?`
        : owner.length
          ? `\`${col}\` is a column of ${owner.map((t) => `\`${t}\``).join(' and ')}. Make sure that table is in your FROM or JOIN${qual ? `, and that \`${qual}\` is its name or alias` : ''}.`
          : `None of the tables has a column called \`${col}\`. Check the spelling against the table list.`;
    return { title: `There's no column called ${full}.`, body, fixes, range: rangeOfWord(sql, full), raw: msg };
  }

  // 3. Misspelled table
  if ((m = msg.match(/no such table: ([\w.]+)/i))) {
    const hint = closest(m[1], names(db).tables);
    const fixes: Fix[] = [];
    if (hint) {
      const fixed = replaceWord(sql, m[1], hint);
      fixes.push({
        title: `Use ${hint}`,
        description: `The closest table name is ${hint}.`,
        sql: fixed,
        preview: previewAround(fixed, fixed.split('\n').find((l) => l.includes(hint)) ?? fixed, 'other'),
        button: `Change to ${hint}`,
      });
    }
    return {
      title: `There's no table called ${m[1]}.`,
      body: `The tables are ${names(db).tables.map((t) => `\`${t}\``).join(', ')}.`,
      fixes,
      range: rangeOfWord(sql, m[1]),
      raw: msg,
    };
  }

  // 4. Ambiguous column: offer one fix per table that has it
  if ((m = msg.match(/ambiguous column name: ([\w.]+)/i))) {
    const col = m[1];
    const refs = [...sql.matchAll(/\b(?:from|join)\s+(\w+)(?:\s+(?:as\s+)?(?!on\b|where\b|join\b|left\b|inner\b|group\b|order\b|limit\b)(\w+))?/gi)].map((r) => ({
      table: r[1],
      alias: r[2] ?? r[1],
    }));
    const all = names(db);
    const owners = refs.filter((r) => all.tablesWith(col).includes(r.table)).slice(0, 2);
    const fixes = owners.map((o) => {
      const fixed = replaceWord(sql, col, `${o.alias}.${col}`);
      return {
        title: `Use ${o.alias}.${col}`,
        description: `Take ${col} from ${o.table}.`,
        sql: fixed,
        preview: previewAround(fixed, fixed.split('\n').find((l) => l.includes(`${o.alias}.${col}`)) ?? fixed, 'other' as const),
        button: `Use ${o.alias}.${col}`,
      };
    });
    return {
      title: `Which ${col} do you mean?`,
      body: `More than one table in your query has a column called \`${col}\`. Put the table name or its alias in front, like \`${owners[0]?.alias ?? 'table'}.${col}\`.`,
      fixes,
      range: rangeOfWord(sql, col),
      raw: msg,
    };
  }

  // 5. Aggregate inside WHERE: move that condition to HAVING
  if (/misuse of aggregate/i.test(msg)) {
    const segs = segments(sql);
    const where = segs.find((s) => s.kw === 'WHERE');
    const group = segs.find((s) => s.kw === 'GROUP BY');
    const fixes: Fix[] = [];
    if (where && group) {
      const cond = where.text.slice(where.kwLength).trim();
      const out = segs.filter((s) => s !== where).map((s) => ({ ...s }));
      const having = out.find((s) => s.kw === 'HAVING');
      const havingText = having ? `${having.text} AND ${cond}` : `HAVING ${cond}`;
      if (having) having.text = havingText;
      else out.splice(out.indexOf(out.find((s) => s.kw === 'GROUP BY')!) + 1, 0, { kw: 'HAVING', start: -1, kwLength: 6, text: havingText });
      const fixed = rebuild(out, hasSemicolon(sql));
      fixes.push({
        title: 'Filter groups after',
        description: 'Totals only exist after grouping, so check them in HAVING.',
        sql: fixed,
        preview: previewAround(fixed, havingText, 'having'),
        button: 'Change to HAVING',
      });
    }
    return {
      title: "COUNT, SUM and AVG can't go in WHERE.",
      body: group
        ? 'WHERE looks at one row at a time, before any totals exist. To filter on a total, use HAVING after GROUP BY.'
        : 'WHERE looks at one row at a time, before any totals exist. Add a GROUP BY, then filter the totals with HAVING.',
      fixes,
      range: where ? { from: where.start, to: where.start + where.text.length } : undefined,
      raw: msg,
    };
  }

  // 6. Everything else: the plain-language message, no fix
  const text = friendlyError(db, raw);
  const sentence = text.match(/^[^.?!]*[.?!]/)?.[0] ?? text;
  return { title: sentence, body: text.slice(sentence.length).trim(), fixes: [], raw: msg };
}

export const READ_ONLY: ErrorExplanation = {
  title: 'Only SELECT queries run here.',
  body: 'SQL Mode is read-only, so the canteen data stays the same for everyone. Start your query with SELECT.',
  fixes: [],
  raw: 'blocked: statement would change the database',
};
