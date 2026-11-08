import { Parser } from 'node-sql-parser/build/sqlite';

// node-sql-parser's AST types are loose; we treat nodes as plain objects.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AstNode = any;

export const parser = new Parser();
export const OPT = { database: 'sqlite' };

export type ParseOutcome =
  | { ok: true; ast: AstNode }
  | { ok: false; reason: UnsupportedReason; isSelect: boolean };

export type UnsupportedReason =
  | 'parse'
  | 'multiple'
  | 'not-select'
  | 'with'
  | 'union'
  | 'subquery'
  | 'window'
  | 'no-from'
  | 'derived-table';

export const UNSUPPORTED_TEXT: Record<UnsupportedReason, string> = {
  parse: "This query uses syntax the step-by-step viewer doesn't understand yet, so here is just the result.",
  multiple: 'You ran more than one statement. Step-by-step works on a single SELECT, so here is the result of the last one.',
  'not-select': 'Step-by-step mode is for SELECT queries. Your statement ran on the database.',
  with: 'WITH (common table expressions) is an advanced feature; step-by-step is not available for it yet.',
  union: 'UNION / INTERSECT / EXCEPT combine several queries; step-by-step is not available for them yet.',
  subquery: 'This query has a query inside another query (a subquery). Step-by-step is not available for it yet.',
  window: 'Window functions (OVER …) are advanced; step-by-step is not available for them yet.',
  'no-from': 'This query has no FROM table, so there are no rows to step through.',
  'derived-table': 'This query reads FROM a subquery; step-by-step is not available for it yet.',
};

function walk(node: AstNode, visit: (n: AstNode) => boolean): boolean {
  if (!node || typeof node !== 'object') return false;
  if (visit(node)) return true;
  for (const key of Object.keys(node)) {
    if (walk(node[key], visit)) return true;
  }
  return false;
}

const STATEMENT_START = /^\s*(select|with)\b/i;

export function parseForSteps(sql: string): ParseOutcome {
  const isSelect = STATEMENT_START.test(stripComments(sql));
  let parsed: AstNode;
  try {
    parsed = parser.astify(stripComments(sql), OPT);
  } catch {
    return { ok: false, reason: 'parse', isSelect };
  }
  const list = Array.isArray(parsed) ? parsed.filter(Boolean) : [parsed];
  if (list.length !== 1) return { ok: false, reason: 'multiple', isSelect };
  const ast = list[0];
  if (ast.type !== 'select') return { ok: false, reason: 'not-select', isSelect: false };
  if (ast.with) return { ok: false, reason: 'with', isSelect };
  if (ast._next || ast.set_op) return { ok: false, reason: 'union', isSelect };
  if (!ast.from || ast.from.length === 0) return { ok: false, reason: 'no-from', isSelect };
  if (ast.from.some((f: AstNode) => !f.table || f.expr)) return { ok: false, reason: 'derived-table', isSelect };

  if (walk(ast, (n) => n !== ast && n.ast && typeof n.ast === 'object')) {
    return { ok: false, reason: 'subquery', isSelect };
  }
  if (walk(ast, (n) => n.over != null && n.over !== false)) return { ok: false, reason: 'window', isSelect };
  return { ok: true, ast };
}

export function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

export function exprSql(node: AstNode): string {
  return parser.exprToSQL(node, OPT);
}

/** Make generated SQL friendlier to read: "f"."name" -> f.name */
export function pretty(sql: string): string {
  return sql.replace(/"([A-Za-z_][A-Za-z0-9_]*)"/g, '$1').replace(/`([A-Za-z_][A-Za-z0-9_]*)`/g, '$1');
}

export function containsAggregate(node: AstNode): boolean {
  return walk(node, (n) => n.type === 'aggr_func');
}

export function collect(node: AstNode, pred: (n: AstNode) => boolean): AstNode[] {
  const out: AstNode[] = [];
  walk(node, (n) => {
    if (pred(n)) out.push(n);
    return false;
  });
  return out;
}
