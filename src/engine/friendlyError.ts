import type { Database } from 'sql.js';

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export function closest(word: string, options: string[]): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const o of options) {
    const d = distance(word.toLowerCase(), o.toLowerCase());
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best && bestD <= Math.max(2, Math.floor(word.length / 3)) ? best : null;
}

export function names(db: Database) {
  const tables = (db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0]?.values ?? []).map((r) => String(r[0]));
  const byTable = new Map(tables.map((t) => [t, (db.exec(`PRAGMA table_info("${t}")`)[0]?.values ?? []).map((r) => String(r[1]))]));
  const columns = [...byTable.values()].flat();
  return {
    tables,
    columns: [...new Set(columns)],
    /** Tables that have a column with this name (case-insensitive). */
    tablesWith: (col: string) => tables.filter((t) => byTable.get(t)!.some((c) => c.toLowerCase() === col.toLowerCase())),
  };
}

/** Turn SQLite's error messages into something a beginner can act on. */
export function friendlyError(db: Database, raw: string): string {
  const msg = raw.replace(/^Error:\s*/, '');
  let m: RegExpMatchArray | null;

  if ((m = msg.match(/no such column: ([\w.]+)/i))) {
    const name = m[1].split('.').pop()!;
    const hint = closest(name, names(db).columns);
    const prefix = m[1].includes('.') ? `There's no column called \`${m[1]}\`.` : `There's no column called \`${m[1]}\`.`;
    return hint
      ? `${prefix} Did you mean \`${hint}\`?`
      : `${prefix} Check the table list on the side for the right spelling, or whether you need a JOIN to reach it.`;
  }
  if ((m = msg.match(/no such table: ([\w.]+)/i))) {
    const hint = closest(m[1], names(db).tables);
    return `There's no table called \`${m[1]}\`.${hint ? ` Did you mean \`${hint}\`?` : ''}`;
  }
  if ((m = msg.match(/ambiguous column name: ([\w.]+)/i))) {
    return `More than one table has a column called \`${m[1]}\`, so SQL doesn't know which one you mean. Put the table name (or its alias) in front, like \`table.${m[1]}\`.`;
  }
  if ((m = msg.match(/near "([^"]*)": syntax error/i))) {
    return `SQL got confused near \`${m[1]}\`. Check for a missing comma, a misspelled keyword, or clauses in the wrong order (SELECT … FROM … WHERE … GROUP BY … HAVING … ORDER BY … LIMIT).`;
  }
  if (/incomplete input/i.test(msg)) {
    return 'The query seems to stop early. Is a closing bracket or quote missing?';
  }
  if (/misuse of aggregate/i.test(msg)) {
    return 'Aggregate functions like COUNT, SUM or AVG can\'t be used in WHERE. To filter on a total, use HAVING after GROUP BY.';
  }
  if (/a GROUP BY clause is required before HAVING/i.test(msg)) {
    return 'HAVING filters groups, so it needs a GROUP BY before it (or use WHERE to filter rows).';
  }
  if (/UNIQUE constraint failed/i.test(msg)) {
    return `That value already exists and must be unique (${msg.split(':').pop()?.trim()}).`;
  }
  return msg.charAt(0).toUpperCase() + msg.slice(1);
}
