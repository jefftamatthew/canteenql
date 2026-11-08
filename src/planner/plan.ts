import type { Database } from 'sql.js';
import { runQuery } from '../db/build';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
export const SLOT_LABEL: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

export interface PlanInput {
  budget: number;
  kcalTarget: number;
  proteinGoal: number;
  slots: MealSlot[];
}

export const DEFAULT_INPUT: PlanInput = { budget: 250, kcalTarget: 2000, proteinGoal: 90, slots: ['breakfast', 'lunch', 'dinner'] };

export interface Option {
  id: number;
  name: string;
  stall: string;
  building: string;
  price: number;
  kcal: number;
  protein: number;
}

export interface Plan {
  input: PlanInput;
  /** Ranked options for each planned slot (best protein per NT$ first). */
  options: Partial<Record<MealSlot, Option[]>>;
  /** Index into options[slot] of the chosen dish. */
  choice: Partial<Record<MealSlot, number>>;
}

export interface Totals {
  price: number;
  kcal: number;
  protein: number;
}

/** The query shown under "How this plan was found", with the remaining budget as a parameter. */
export function displaySql(slot: MealSlot): string {
  return [
    'SELECT d.name, d.price, n.kcal, n.protein_g',
    'FROM dishes d',
    'JOIN nutrition n ON d.id = n.dish_id',
    `WHERE d.meal_slot = '${slot}'`,
    '  AND d.price <= :budget_left',
    'ORDER BY n.protein_g / d.price DESC;',
  ].join('\n');
}

/** The same query with the parameter filled in, ready to run in SQL Mode. */
export function runnableSql(slot: MealSlot, budgetLeft: number): string {
  return displaySql(slot).replace(':budget_left', String(budgetLeft));
}

const CANDIDATES = 8;

function optionsFor(db: Database, slot: MealSlot, budget: number): Option[] {
  const res = runQuery(
    db,
    `SELECT d.id, d.name, s.stall_name, s.building, d.price, n.kcal, n.protein_g
     FROM dishes d JOIN stalls s ON d.stall_id = s.id JOIN nutrition n ON d.id = n.dish_id
     WHERE d.meal_slot = '${slot}' AND d.price <= ${Math.floor(budget)}
     ORDER BY n.protein_g / d.price DESC, d.id`,
  );
  return res.rows.slice(0, CANDIDATES).map((r) => ({
    id: Number(r[0]),
    name: String(r[1]),
    stall: String(r[2]),
    building: String(r[3]),
    price: Number(r[4]),
    kcal: Number(r[5]),
    protein: Number(r[6]),
  }));
}

export function totals(plan: Plan): Totals {
  return plan.input.slots.reduce(
    (t, slot) => {
      const o = plan.options[slot]?.[plan.choice[slot] ?? -1];
      return o ? { price: t.price + o.price, kcal: t.kcal + o.kcal, protein: t.protein + o.protein } : t;
    },
    { price: 0, kcal: 0, protein: 0 },
  );
}

function score(t: Totals, input: PlanInput): number {
  const kcalMiss = Math.abs(t.kcal - input.kcalTarget) / input.kcalTarget;
  const proteinShort = Math.max(0, input.proteinGoal - t.protein) / input.proteinGoal;
  return kcalMiss + 1.5 * proteinShort + 0.1 * (t.price / input.budget);
}

/** Pick one dish per meal that fits the budget and comes closest to the calorie and protein targets. */
export function planDay(db: Database, input: PlanInput): Plan | null {
  const slots = MEAL_SLOTS.filter((s) => input.slots.includes(s));
  if (slots.length === 0) return null;
  const options: Plan['options'] = {};
  for (const s of slots) options[s] = optionsFor(db, s, input.budget);
  if (slots.some((s) => options[s]!.length === 0)) return null;

  let best: { choice: Plan['choice']; score: number } | null = null;
  const walk = (i: number, choice: Plan['choice']) => {
    if (i === slots.length) {
      const t = totals({ input: { ...input, slots }, options, choice });
      if (t.price > input.budget) return;
      const sc = score(t, input);
      if (!best || sc < best.score) best = { choice: { ...choice }, score: sc };
      return;
    }
    options[slots[i]]!.forEach((_, k) => walk(i + 1, { ...choice, [slots[i]]: k }));
  };
  walk(0, {});
  if (!best) return null;
  return { input: { ...input, slots }, options, choice: (best as { choice: Plan['choice'] }).choice };
}

/** Swap one meal for the next option on its ranked list that still fits the budget. */
export function swapDish(plan: Plan, slot: MealSlot): Plan {
  const list = plan.options[slot] ?? [];
  const current = plan.choice[slot] ?? 0;
  for (let step = 1; step < list.length; step++) {
    const k = (current + step) % list.length;
    const next = { ...plan, choice: { ...plan.choice, [slot]: k } };
    if (totals(next).price <= plan.input.budget) return next;
  }
  return plan;
}

/** Budget left for one slot once the other chosen meals are paid for. */
export function budgetLeftFor(plan: Plan, slot: MealSlot): number {
  const others = plan.input.slots
    .filter((s) => s !== slot)
    .reduce((sum, s) => sum + (plan.options[s]?.[plan.choice[s] ?? -1]?.price ?? 0), 0);
  return plan.input.budget - others;
}
