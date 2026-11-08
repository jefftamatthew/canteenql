import { beforeAll, describe, expect, it } from 'vitest';
import type { Database } from 'sql.js';
import { makeTestDb } from '../db/testDb';
import { getSchema, runQuery } from '../db/build';
import { runWithSteps } from './runStages';
import { checkAnswer } from './checkAnswer';
import { explainError } from './explainError';
import { misplacedClause, reorderClauses, tidy } from './clauses';
import { CHALLENGES, isOpen } from '../challenges/challenges';
import { DEFAULT_FILTERS, describe as describeFilters, runExplorer, toSql, type Filters } from '../explorer/explorer';
import { DEFAULT_INPUT, budgetLeftFor, planDay, runnableSql, swapDish, totals } from '../planner/plan';

let db: Database;
beforeAll(async () => {
  db = await makeTestDb();
});

const kinds = (sql: string) => runWithSteps(db, sql).stages?.map((s) => s.kind);
const count = (sql: string) => runQuery(db, sql).rows.length;
const errorOf = (sql: string) => {
  try {
    runQuery(db, sql);
  } catch (e) {
    return explainError(db, sql, String(e));
  }
  throw new Error(`query did not fail: ${sql}`);
};

describe('database', () => {
  it('has the five canteen tables', () => {
    const schema = getSchema(db);
    expect(schema.map((t) => t.name)).toEqual(['stalls', 'dishes', 'nutrition', 'users', 'meal_logs']);
    expect(schema.find((t) => t.name === 'dishes')!.rowCount).toBe(30);
    expect(schema.find((t) => t.name === 'nutrition')!.columns[0].fk).toBe('dishes.id');
  });
  it('is deterministic', async () => {
    const other = await makeTestDb();
    const q = 'SELECT COUNT(*), SUM(dish_id), MAX(eaten_at) FROM meal_logs';
    expect(runQuery(other, q)).toEqual(runQuery(db, q));
  });
  it('every dish has nutrition facts', () => {
    expect(count('SELECT d.id FROM dishes d LEFT JOIN nutrition n ON n.dish_id = d.id WHERE n.dish_id IS NULL')).toBe(0);
  });
});

describe('step-by-step engine', () => {
  it('builds every stage for a full query', () => {
    expect(
      kinds(
        "SELECT s.stall_name, AVG(d.price) AS avg_price FROM dishes d JOIN stalls s ON d.stall_id = s.id WHERE d.meal_slot = 'lunch' GROUP BY s.stall_name HAVING COUNT(*) > 1 ORDER BY avg_price LIMIT 2",
      ),
    ).toEqual(['from', 'join', 'where', 'group', 'having', 'select', 'order', 'limit']);
  });

  it.each(CHALLENGES.map((c) => [c.id, c.solution]))('final stage matches the real result for %s', (_id, sql) => {
    const out = runWithSteps(db, sql);
    expect(out.error).toBeUndefined();
    expect(out.stages).toBeDefined();
    const last = out.stages![out.stages!.length - 1];
    expect(last.rows.filter((r) => r.status !== 'dropped').map((r) => r.values)).toEqual(runQuery(db, sql).rows);
  });

  it('falls back for subqueries but still returns results', () => {
    const out = runWithSteps(db, 'SELECT name FROM dishes WHERE id IN (SELECT dish_id FROM nutrition WHERE kcal > 700)');
    expect(out.stages).toBeUndefined();
    expect(out.result!.rows.length).toBeGreaterThan(0);
  });
});

describe('challenges', () => {
  it.each(CHALLENGES)('$id has a solution that passes and returns rows', (c) => {
    expect(checkAnswer(db, c.solution, c.solution).correct).toBe(true);
    expect(count(c.solution)).toBeGreaterThan(0);
  });
  it('rejects wrong answers with a reason', () => {
    const per = CHALLENGES.find((c) => c.id === 'per-slot')!;
    expect(checkAnswer(db, 'SELECT meal_slot, COUNT(*) FROM dishes', per.solution).message).toMatch(/GROUP BY/);
    const top = CHALLENGES.find((c) => c.id === 'protein-top5')!;
    expect(checkAnswer(db, 'SELECT dish_id, protein_g FROM nutrition ORDER BY protein_g LIMIT 5', top.solution).correct).toBe(false);
  });
  it('keeps three challenges open ahead of your progress', () => {
    expect(isOpen(2, 0)).toBe(true);
    expect(isOpen(3, 0)).toBe(false);
    expect(isOpen(3, 1)).toBe(true);
  });
});

describe('clause tools', () => {
  const bad = 'SELECT s.stall_name, AVG(d.price) AS avg_price\nFROM dishes d\nJOIN stalls s ON d.stall_id = s.id\nGROUP BY s.stall_name\nWHERE d.price < 100;';
  it('finds a clause written in the wrong place', () => {
    const m = misplacedClause(bad)!;
    expect(m.clause.kw).toBe('WHERE');
    expect(m.after.kw).toBe('GROUP BY');
  });
  it('reorders clauses into a query that runs', () => {
    const fixed = reorderClauses(bad);
    expect(fixed).toMatch(/WHERE d\.price < 100\nGROUP BY/);
    expect(count(fixed)).toBeGreaterThan(0);
  });
  it('ignores keywords inside strings and brackets', () => {
    expect(misplacedClause("SELECT name FROM dishes WHERE name = 'order by group'")).toBeNull();
    expect(misplacedClause('SELECT (SELECT 1 FROM stalls LIMIT 1) FROM dishes WHERE id = 1')).toBeNull();
  });
  it('tidies a one-line query onto clause lines', () => {
    expect(tidy('select name from dishes where price < 60 and is_vegetarian = 1 order by price')).toBe(
      'SELECT name\nFROM dishes\nWHERE price < 60\n  AND is_vegetarian = 1\nORDER BY price;',
    );
  });
});

describe('error explanations', () => {
  it('explains WHERE after GROUP BY and offers both fixes from the design', () => {
    const sql = 'SELECT s.stall_name, AVG(d.price) AS avg_price\nFROM dishes d\nJOIN stalls s ON d.stall_id = s.id\nGROUP BY s.stall_name\nWHERE d.price < 100;';
    const e = errorOf(sql);
    expect(e.title).toBe('WHERE has to come before GROUP BY.');
    expect(e.line).toBe(5);
    expect(e.fixes.map((f) => f.button)).toEqual(['Move WHERE up', 'Change to HAVING']);
    expect(e.fixes[1].sql).toMatch(/HAVING AVG\(d\.price\) < 100/);
    for (const f of e.fixes) expect(() => runQuery(db, f.sql)).not.toThrow();
  });
  it('suggests the right column name', () => {
    const e = errorOf('SELECT name, prise FROM dishes');
    expect(e.fixes[0].button).toBe('Change to price');
    expect(count(e.fixes[0].sql)).toBe(30);
  });
  it('tells you which table a column lives in when the JOIN is missing', () => {
    const e = errorOf('SELECT name, kcal FROM dishes');
    expect(e.body).toMatch(/nutrition/);
  });
  it('fixes ambiguous columns by adding the alias', () => {
    const e = errorOf('SELECT name, id FROM dishes d JOIN stalls s ON d.stall_id = s.id');
    expect(e.fixes.length).toBe(2);
    expect(() => runQuery(db, e.fixes[0].sql)).not.toThrow();
  });
  it('moves an aggregate from WHERE to HAVING', () => {
    const e = errorOf('SELECT user_id, COUNT(*) FROM meal_logs WHERE COUNT(*) > 20 GROUP BY user_id');
    expect(e.fixes[0].sql).toMatch(/GROUP BY user_id\nHAVING COUNT\(\*\) > 20/);
    expect(count(e.fixes[0].sql)).toBe(6);
  });
});

describe('query explorer', () => {
  it('reproduces the design example: top 3 protein dishes under NT$100 in Building B', () => {
    const run = runExplorer(db, DEFAULT_FILTERS);
    expect(run.question).toBe('The 3 highest-protein dishes at NT$100 or less, with 25 g of protein or more, in Building B.');
    expect(run.steps.map((s) => s.label)).toEqual(['FROM', 'JOIN', 'WHERE', 'SELECT', 'ORDER BY', 'LIMIT']);
    expect(run.result.rows.map((r) => r[0])).toEqual(['Chicken Breast Bento', 'Spicy Chicken Rice', 'Chicken Curry Rice']);
    const limit = run.steps[5];
    expect(limit.tickets.find((t) => t.stamp === 'Cut by LIMIT')!.name).toBe('Pork Chop Rice');
    expect(limit.text).toMatch(/Pork Chop Rice is 4th/);
  });

  const variants: Filters[] = [
    DEFAULT_FILTERS,
    { ...DEFAULT_FILTERS, maxPrice: 150, minProtein: 0, buildings: [], limit: null },
    { ...DEFAULT_FILTERS, buildings: ['A', 'C'], sort: 'price', limit: 5 },
    { ...DEFAULT_FILTERS, halal: true, minProtein: 0, sort: 'kcal' },
    { ...DEFAULT_FILTERS, vegetarian: true, lowSugar: true, minProtein: 10, buildings: [], maxPrice: 80 },
  ];
  it.each(variants)('kept tickets match the real SQL result (%#)', (f) => {
    const run = runExplorer(db, f);
    const last = run.steps[run.steps.length - 1];
    const kept = last.tickets.filter((t) => !t.stamp).map((t) => t.name);
    expect(kept).toEqual(runQuery(db, toSql(f)).rows.map((r) => r[0]));
    const where = run.steps.find((s) => s.kind === 'where');
    if (where) expect(where.tickets.filter((t) => !t.stamp).length).toBe(run.steps.find((s) => s.kind === 'select')!.tickets.length);
  });

  it('writes no WHERE when every filter is open', () => {
    const f = { ...DEFAULT_FILTERS, maxPrice: 150, minProtein: 0, buildings: [] };
    expect(toSql(f)).not.toMatch(/WHERE/);
    expect(describeFilters({ ...f, limit: null })).toBe('All dishes, most protein first.');
  });
});

describe('meal planner', () => {
  it('plans three meals within budget', () => {
    const plan = planDay(db, DEFAULT_INPUT)!;
    const t = totals(plan);
    expect(Object.keys(plan.choice).sort()).toEqual(['breakfast', 'dinner', 'lunch']);
    expect(t.price).toBeLessThanOrEqual(DEFAULT_INPUT.budget);
    expect(t.protein).toBeGreaterThan(60);
  });
  it('swapping keeps the plan within budget', () => {
    let plan = planDay(db, DEFAULT_INPUT)!;
    for (let i = 0; i < 5; i++) {
      plan = swapDish(plan, 'lunch');
      expect(totals(plan).price).toBeLessThanOrEqual(DEFAULT_INPUT.budget);
    }
  });
  it('returns nothing when the budget is too small', () => {
    expect(planDay(db, { ...DEFAULT_INPUT, budget: 20 })).toBeNull();
  });
  it('the explanation query runs with the remaining budget filled in', () => {
    const plan = planDay(db, DEFAULT_INPUT)!;
    const sql = runnableSql('lunch', budgetLeftFor(plan, 'lunch'));
    expect(runWithSteps(db, sql).stages!.map((s) => s.kind)).toEqual(['from', 'join', 'where', 'select', 'order']);
  });
});
