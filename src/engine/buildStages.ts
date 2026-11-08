import { AstNode, OPT, collect, containsAggregate, exprSql, parser, pretty } from './parseQuery';

export type StageKind = 'from' | 'join' | 'where' | 'group' | 'having' | 'select' | 'order' | 'limit';

/** A stage is one step of SQL's logical execution order, expressed as a runnable query. */
export interface StagePlan {
  kind: StageKind;
  title: string;
  /** The clause as the student would read it, e.g. "WHERE price < 3" */
  clause: string;
  /** SQL to run for this stage. Includes hidden helper columns (_rid, _keep, _gk). */
  sql: string;
  /** Extra info used to write the plain-language note. */
  info: Record<string, string | number | boolean>;
}

export interface BuildContext {
  /** Column names of a real table, in order. */
  columnsOf: (table: string) => string[];
}

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;
const STAR = [{ expr: { type: 'column_ref', table: null, column: '*' }, as: null }];

function emptySelect(ast: AstNode): AstNode {
  return {
    ...ast,
    columns: STAR,
    distinct: null,
    from: null,
    where: null,
    groupby: null,
    having: null,
    orderby: null,
    limit: null,
  };
}

function fromClause(ast: AstNode, items: AstNode[]): string {
  return parser.sqlify({ ...emptySelect(ast), from: items }, OPT).replace(/^SELECT \* FROM /, '');
}

/** Text of an ORDER BY / GROUP BY etc. clause, taken from regenerated SQL. */
function clauseFrom(ast: AstNode, part: Record<string, unknown>, keyword: string): string {
  const full = parser.sqlify({ ...emptySelect(ast), from: ast.from, ...part }, OPT);
  const i = full.indexOf(` ${keyword} `);
  return i >= 0 ? full.slice(i + 1) : '';
}

function selectList(ast: AstNode): string {
  const s = parser.sqlify(
    { ...ast, distinct: null, from: null, where: null, groupby: null, having: null, orderby: null, limit: null },
    OPT,
  );
  return s.replace(/^SELECT /, '');
}

const refName = (item: AstNode) => item.as || item.table;

export function joinWord(join: string | undefined): string {
  return (join || 'JOIN').toUpperCase();
}

export function buildStages(ast: AstNode, ctx: BuildContext): StagePlan[] {
  const items: AstNode[] = ast.from;
  const single = items.length === 1;
  const stages: StagePlan[] = [];

  const rowCols = (upto: AstNode[]) =>
    upto
      .flatMap((it) =>
        ctx.columnsOf(it.table).map((c) => `${q(refName(it))}.${q(c)} AS ${q(single ? c : `${refName(it)}.${c}`)}`),
      )
      .join(', ');
  const rowId = (upto: AstNode[]) =>
    upto.map((it) => `IFNULL(CAST(${q(refName(it))}.rowid AS TEXT), '∅')`).join(` || ':' || `);

  // 1. FROM — just the first table
  const first = items[0];
  stages.push({
    kind: 'from',
    title: 'FROM',
    clause: `FROM ${first.table}${first.as ? ` AS ${first.as}` : ''}`,
    sql: `SELECT ${rowId([first])} AS _rid, ${rowCols([first])} FROM ${fromClause(ast, [first])}`,
    info: { table: first.table },
  });

  // 2. JOINs — one stage per joined table
  for (let k = 1; k < items.length; k++) {
    const upto = items.slice(0, k + 1);
    const it = items[k];
    const word = joinWord(it.join);
    const on = it.on ? exprSql(it.on) : '';
    stages.push({
      kind: 'join',
      title: word.replace('INNER ', ''),
      clause: pretty(`${word} ${it.table}${it.as ? ` AS ${it.as}` : ''}${on ? ` ON ${on}` : ''}${it.using ? ` USING (${it.using.join(', ')})` : ''}`),
      sql: `SELECT ${rowId(upto)} AS _rid, ${rowCols(upto)} FROM ${fromClause(ast, upto)}`,
      info: { table: it.table, join: word, on: pretty(on), hasOn: !!(it.on || it.using) },
    });
  }

  const from = fromClause(ast, items);
  const where = ast.where ? exprSql(ast.where) : '';
  const whereSql = where ? ` WHERE ${where}` : '';

  // 3. WHERE — every row, marked keep / drop
  if (where) {
    stages.push({
      kind: 'where',
      title: 'WHERE',
      clause: pretty(`WHERE ${where}`),
      sql: `SELECT ${rowId(items)} AS _rid, ${rowCols(items)}, CASE WHEN (${where}) THEN 1 ELSE 0 END AS _keep FROM ${from}`,
      info: { condition: pretty(where) },
    });
  }

  const groupKeys: AstNode[] = ast.groupby?.columns ?? [];
  const keySql = groupKeys.map(exprSql);
  const grouped = keySql.length > 0;
  const groupId = grouped
    ? keySql.map((k) => `IFNULL(CAST((${k}) AS TEXT), 'NULL')`).join(` || ' · ' || `)
    : `'all rows'`;
  const groupBy = grouped ? clauseFrom(ast, { groupby: ast.groupby }, 'GROUP BY') : '';
  const aggregate = containsAggregate(ast.columns) || containsAggregate(ast.having);

  // 4. GROUP BY — rows sorted into piles
  if (grouped) {
    stages.push({
      kind: 'group',
      title: 'GROUP BY',
      clause: pretty(groupBy),
      sql: `SELECT ${rowId(items)} AS _rid, ${groupId} AS _gk, ${rowCols(items)} FROM ${from}${whereSql} ORDER BY ${keySql.map((k) => `(${k})`).join(', ')}`,
      info: { keys: pretty(keySql.join(', ')) },
    });
  }

  // 5. HAVING — one row per group, marked keep / drop
  const having = ast.having ? exprSql(ast.having) : '';
  if (having) {
    const aliasMap = new Map<string, AstNode>();
    for (const c of ast.columns) if (c.as) aliasMap.set(String(c.as).toLowerCase(), c);
    const shown: string[] = [];
    const add = (s: string) => {
      if (!shown.includes(s)) shown.push(s);
    };
    groupKeys.forEach((k, i) => add(`${keySql[i]} AS ${q(pretty(exprSql(k)))}`));
    add(`COUNT(*) AS ${q('rows in group')}`);
    for (const agg of collect(ast.having, (n) => n.type === 'aggr_func')) {
      const s = exprSql(agg);
      if (/^COUNT\(\*\)$/i.test(s)) continue; // already shown as "rows in group"
      add(`${s} AS ${q(pretty(s))}`);
    }
    for (const ref of collect(ast.having, (n) => n.type === 'column_ref' && !n.table)) {
      const col = aliasMap.get(String(ref.column?.expr?.value ?? ref.column).toLowerCase());
      if (col) add(`${exprSql(col.expr)} AS ${q(col.as)}`);
    }
    stages.push({
      kind: 'having',
      title: 'HAVING',
      clause: pretty(`HAVING ${having}`),
      sql: `SELECT ${groupId} AS _rid, ${shown.join(', ')}, CASE WHEN (${having}) THEN 1 ELSE 0 END AS _keep FROM ${from}${whereSql} ${groupBy}`,
      info: { condition: pretty(having) },
    });
  }

  // 6. SELECT — pick / compute the output columns
  const distinct = !!ast.distinct;
  const list = selectList(ast);
  const selectRid = distinct ? '' : `, ${grouped || aggregate ? groupId : rowId(items)} AS _rid`;
  const body = `${from}${whereSql}${groupBy ? ` ${groupBy}` : ''}${having ? ` HAVING ${having}` : ''}`;
  const selectSql = `SELECT ${distinct ? 'DISTINCT ' : ''}${list}${selectRid} FROM ${body}`;
  stages.push({
    kind: 'select',
    title: distinct ? 'SELECT DISTINCT' : 'SELECT',
    clause: pretty(`SELECT ${distinct ? 'DISTINCT ' : ''}${list}`),
    sql: selectSql,
    info: { grouped, aggregate, distinct, star: /(^|,\s*)(\S+\.)?\*/.test(list) },
  });

  // 7. ORDER BY
  let orderSql = selectSql;
  if (ast.orderby) {
    const order = clauseFrom(ast, { orderby: ast.orderby }, 'ORDER BY');
    orderSql = `${selectSql} ${order}`;
    stages.push({
      kind: 'order',
      title: 'ORDER BY',
      clause: pretty(order),
      sql: orderSql,
      info: { order: pretty(order.replace(/^ORDER BY /, '')), desc: /\bDESC\b/.test(order) },
    });
  }

  // 8. LIMIT / OFFSET — computed from the previous stage's rows
  if (ast.limit && ast.limit.value?.length) {
    const vals: AstNode[] = ast.limit.value;
    let limitExpr: AstNode;
    let offsetExpr: AstNode | null = null;
    if (vals.length === 2 && ast.limit.seperator === ',') [offsetExpr, limitExpr] = vals;
    else [limitExpr, offsetExpr = null] = vals;
    const lim = exprSql(limitExpr);
    const off = offsetExpr ? exprSql(offsetExpr) : '0';
    stages.push({
      kind: 'limit',
      title: 'LIMIT',
      clause: `LIMIT ${lim}${offsetExpr ? ` OFFSET ${off}` : ''}`,
      sql: `SELECT (${lim}) AS lim, (${off}) AS off`,
      info: { limit: lim, offset: off, hasOffset: !!offsetExpr },
    });
  }

  return stages;
}

/** The order clauses appear in when the query is written (used for the "written vs run order" strip). */
export const WRITTEN_ORDER: StageKind[] = ['select', 'from', 'join', 'where', 'group', 'having', 'order', 'limit'];
export const RUN_ORDER: StageKind[] = ['from', 'join', 'where', 'group', 'having', 'select', 'order', 'limit'];
