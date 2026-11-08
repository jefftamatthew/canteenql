import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDb } from '../DbContext';
import {
  DEFAULT_INPUT,
  MEAL_SLOTS,
  SLOT_LABEL,
  budgetLeftFor,
  displaySql,
  planDay,
  runnableSql,
  swapDish,
  totals,
  type MealSlot,
  type Plan,
  type PlanInput,
} from '../planner/plan';
import { SqlLines, toLines } from '../components/SqlLines';
import { btnOutline, btnPanelLink, btnPrimary, card } from '../ui/styles';

const COUNT_WORD = ['No meals', 'One meal', 'Two meals', 'Three meals'];

function Meter({ label, value, of, unit, note, overIsBad = true }: { label: string; value: number; of: number; unit: string; note: string; overIsBad?: boolean }) {
  const pct = Math.round((value / Math.max(of, 1)) * 100);
  const fmt = (v: number) => v.toLocaleString('en-US');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="font-bold">{label}</span>
        <span>
          <strong className="font-head text-[22px]">{fmt(value)}</strong>{' '}
          <span className="text-muted">
            of {unit === 'NT$' ? `NT$${fmt(of)}` : `${fmt(of)}${unit === 'g' ? ' g' : ''}`}
          </span>
        </span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuenow={Math.min(pct, 100)} aria-valuemin={0} aria-valuemax={100} className="h-3 rounded-full bg-track">
        <div className={`h-full rounded-full ${pct > 100 && overIsBad ? 'bg-ketchup' : 'bg-leaf'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-[15px] text-muted">{note}</span>
    </div>
  );
}

function NumberField({ id, label, value, onChange, prefix, suffix }: { id: string; label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      <div className="flex min-h-12 items-center gap-1.5 rounded-[10px] border-[1.5px] border-line-strong px-3 focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-ocean">
        {prefix && <span className="text-muted">{prefix}</span>}
        <input
          id={id}
          type="number"
          min={0}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(e.target.valueAsNumber)}
          className="min-w-0 flex-1 border-0 bg-transparent font-head text-xl font-bold text-ink outline-none"
        />
        {suffix && <span className="text-muted">{suffix}</span>}
      </div>
    </div>
  );
}

export function Planner() {
  const { db } = useDb();
  const [input, setInput] = useState<PlanInput>(DEFAULT_INPUT);
  const [plan, setPlan] = useState<Plan | null>(() => planDay(db!, DEFAULT_INPUT));
  const [planned, setPlanned] = useState<PlanInput>(DEFAULT_INPUT);

  const valid = input.budget > 0 && input.kcalTarget > 0 && input.proteinGoal > 0 && input.slots.length > 0;
  const t = plan ? totals(plan) : null;
  const explainSlot: MealSlot | null = plan ? (plan.input.slots.includes('lunch') ? 'lunch' : plan.input.slots[0]) : null;
  const runSql = useMemo(() => (plan && explainSlot ? runnableSql(explainSlot, budgetLeftFor(plan, explainSlot)) : ''), [plan, explainSlot]);

  const makePlan = () => {
    if (!valid) return;
    setPlanned(input);
    setPlan(planDay(db!, input));
  };

  const budgetNote = t ? (t.price <= planned.budget ? `NT$${planned.budget - t.price} left` : `NT$${t.price - planned.budget} over`) : '';
  const kcalGap = t ? planned.kcalTarget - t.kcal : 0;
  const kcalNote = kcalGap > 150 ? `${kcalGap.toLocaleString('en-US')} kcal under, room for a snack` : kcalGap < -150 ? `${(-kcalGap).toLocaleString('en-US')} kcal over` : 'Right on target';
  const proteinGap = t ? Math.round(planned.proteinGoal - t.protein) : 0;
  const proteinNote = proteinGap > 0 ? `${proteinGap} g short` : 'Goal reached';

  return (
    <div className="mx-auto flex max-w-[1320px] flex-wrap items-start gap-8 px-6 pt-8 pb-16">
      <aside aria-labelledby="day-title" className="flex min-w-0 flex-[1_1_290px] flex-col gap-4">
        <h2 id="day-title" className="h-section m-0 text-2xl">
          Your day
        </h2>
        <form
          className={`${card} flex flex-col gap-[18px] p-5`}
          onSubmit={(e) => {
            e.preventDefault();
            makePlan();
          }}
        >
          <NumberField id="budget" label="Daily budget" prefix="NT$" value={input.budget} onChange={(v) => setInput({ ...input, budget: v })} />
          <NumberField id="kcal" label="Calorie target" suffix="kcal" value={input.kcalTarget} onChange={(v) => setInput({ ...input, kcalTarget: v })} />
          <NumberField id="prot" label="Protein goal" suffix="g" value={input.proteinGoal} onChange={(v) => setInput({ ...input, proteinGoal: v })} />
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-1.5 p-0 font-bold">Meals to plan</legend>
            {MEAL_SLOTS.map((slot) => (
              <label key={slot} className="flex min-h-10 items-center gap-2.5">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-leaf"
                  checked={input.slots.includes(slot)}
                  onChange={(e) =>
                    setInput({ ...input, slots: e.target.checked ? MEAL_SLOTS.filter((s) => s === slot || input.slots.includes(s)) : input.slots.filter((s) => s !== slot) })
                  }
                />
                {SLOT_LABEL[slot]}
              </label>
            ))}
          </fieldset>
          <button type="submit" className={btnPrimary} disabled={!valid}>
            Plan my day
          </button>
          {!valid && <p className="m-0 text-[15px] text-ketchup-dark">Fill in all three numbers and pick at least one meal.</p>}
        </form>
      </aside>

      <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-7">
        {!plan || !t ? (
          <section className="flex flex-col gap-2">
            <p className="m-0 text-muted">Your plan for today</p>
            <h1 className="h-display m-0 max-w-[22ch] text-[36px] sm:text-[44px]">No set of dishes fits NT${planned.budget}.</h1>
            <p className="m-0 max-w-[60ch]">Raise the daily budget or plan fewer meals, then choose Plan my day again.</p>
          </section>
        ) : (
          <>
            <section aria-labelledby="plan-title" className="flex flex-col gap-2">
              <p className="m-0 text-muted">Your plan for today</p>
              <h1 id="plan-title" className="h-display m-0 max-w-[22ch] text-[36px] sm:text-[44px]">
                {COUNT_WORD[plan.input.slots.length]}, NT${t.price}, and {Math.round(t.protein)} g of protein.
              </h1>
            </section>

            <section aria-label="Totals against your targets" className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-6 border-y-[1.5px] border-line py-5">
              <Meter label="Budget" value={t.price} of={planned.budget} unit="NT$" note={budgetNote} />
              <Meter label="Calories" value={t.kcal} of={planned.kcalTarget} unit="kcal" note={kcalNote} />
              <Meter label="Protein" value={Math.round(t.protein)} of={planned.proteinGoal} unit="g" note={proteinNote} overIsBad={false} />
            </section>

            <ul aria-label="Meals" className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 p-0">
              {plan.input.slots.map((slot) => {
                const opts = plan.options[slot]!;
                const o = opts[plan.choice[slot]!];
                const canSwap = swapDish(plan, slot) !== plan;
                return (
                  <li key={slot} className="flex overflow-hidden rounded-[14px] border-[1.5px] border-line bg-white">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-[18px]">
                      <span className="text-muted">{SLOT_LABEL[slot]}</span>
                      <h3 className="h-section m-0 text-[22px] leading-[1.15] tracking-[-0.01em]">{o.name}</h3>
                      <span className="text-[15px] text-muted">
                        {o.stall}, Building {o.building}
                      </span>
                      <span className="text-[15px]">
                        {o.kcal} kcal, {o.protein} g protein
                      </span>
                      <button
                        type="button"
                        className={`${btnOutline} mt-2 self-start text-[15px]`}
                        disabled={!canSwap}
                        onClick={() => setPlan(swapDish(plan, slot))}
                      >
                        Swap dish
                      </button>
                    </div>
                    <div className="flex w-20 flex-none flex-col items-center justify-center border-l-2 border-dashed border-line">
                      <span className="text-[13px] text-muted">NT$</span>
                      <span className="font-head text-[30px] font-extrabold tracking-[-0.02em]">{o.price}</span>
                    </div>
                  </li>
                );
              })}
            </ul>

            {explainSlot && (
              <section aria-labelledby="how-title" className="overflow-hidden rounded-2xl bg-panel">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-line px-[22px] py-3.5">
                  <h2 id="how-title" className="h-section m-0 text-xl text-[#F2F5F8]">
                    How this plan was found
                  </h2>
                  <Link to="/sql" state={{ sql: runSql }} className={btnPanelLink}>
                    Watch this query run
                  </Link>
                </div>
                <p className="m-0 max-w-[70ch] px-[22px] pt-4 text-panel-sub">
                  For each meal, one query finds the dishes that still fit your budget and ranks them by protein per NT$. The planner then picks the
                  combination that comes closest to all three targets.
                </p>
                <div className="px-2 pb-3">
                  <SqlLines lines={toLines(displaySql(explainSlot))} />
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
