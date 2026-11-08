import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDb } from '../DbContext';
import {
  BUILDINGS,
  DEFAULT_FILTERS,
  PRICE,
  PROTEIN,
  SORTS,
  runExplorer,
  tagFor,
  type FilterKey,
  type Filters,
  type SortKey,
} from '../explorer/explorer';
import { MealTicket } from '../components/MealTicket';
import { StepButtons } from '../components/StepButtons';
import { SqlLines } from '../components/SqlLines';
import { BarList } from '../components/BarList';
import { ResultTable } from '../components/ResultTable';
import { Scatter } from '../components/Scatter';
import { btnDark, btnOutline, btnPanel, btnPanelLink, btnPrimary, card, selectBox, tagOrder, tagWhere, toggle } from '../ui/styles';
import { familyOfKeyword } from '../ui/clauseColors';

type View = 'bar' | 'table' | 'scatter';

function Tag({ f, k }: { f: Filters; k: FilterKey }) {
  const t = tagFor(f, k);
  return t ? <span className={tagWhere}>{t}</span> : <span className="text-sm text-muted">No rule added</span>;
}

export function Explorer() {
  const { db } = useDb();
  const [f, setF] = useState<Filters>(DEFAULT_FILTERS);
  const [step, setStep] = useState(2);
  const [view, setView] = useState<View>('bar');
  const [copied, setCopied] = useState(false);
  const watchRef = useRef<HTMLHeadingElement>(null);

  const run = useMemo(() => runExplorer(db!, f), [db, f]);
  const current = Math.min(step, run.steps.length - 1);
  const s = run.steps[current];
  const set = (patch: Partial<Filters>) => setF((old) => ({ ...old, ...patch }));

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const lines = run.lines.map((l) => ({ kw: l.kw, rest: l.rest, family: familyOfKeyword(l.step === 'where' ? 'WHERE' : l.kw.trim()), active: l.step === s.kind }));
  // Stamps land one after another, but the whole cascade stays under ~2 seconds.
  let stampIdx = 0;
  const stampGap = Math.min(200, 1800 / Math.max(1, s.tickets.filter((t) => t.stamp).length));
  const sortInfo = SORTS[f.sort];
  const n = run.result.rows.length;
  const metricIx = run.result.columns.indexOf(sortInfo.column);
  const viewDefs: { id: View; label: string; cap: string }[] = [
    { id: 'bar', label: 'Bar chart', cap: `${n} dish${n === 1 ? '' : 'es'}, ${f.sort === 'price' ? 'price' : f.sort === 'kcal' ? 'calories' : 'protein'} per dish` },
    { id: 'table', label: 'Table', cap: `${n} row${n === 1 ? '' : 's'}, exactly as the database returns them` },
    { id: 'scatter', label: 'Price vs protein', cap: `All ${run.points.length} dishes, with your ${n} result${n === 1 ? '' : 's'} filled in` },
  ];

  const runQuery = () => {
    setStep(0);
    watchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    watchRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="mx-auto flex max-w-[1320px] flex-wrap items-start gap-8 px-6 pt-8 pb-16">
      <aside aria-labelledby="filters-title" className="flex min-w-0 flex-[1_1_290px] flex-col gap-4">
        <h2 id="filters-title" className="h-section m-0 text-2xl">
          Filters
        </h2>
        <p className="m-0 text-[15px] text-muted">Each filter writes one part of the SQL. The tag shows which part.</p>

        <div className={`${card} flex flex-col gap-[22px] p-5`}>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="price" className="font-bold">
                Max price
              </label>
              <span className="font-head text-xl font-bold">{f.maxPrice >= PRICE.max ? 'Any' : `NT$${f.maxPrice}`}</span>
            </div>
            <input
              id="price"
              type="range"
              min={PRICE.min}
              max={PRICE.max}
              step={PRICE.step}
              value={f.maxPrice}
              onChange={(e) => set({ maxPrice: Number(e.target.value) })}
              className="h-7 w-full accent-leaf"
            />
            <Tag f={f} k="price" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="protein" className="font-bold">
                Min protein
              </label>
              <span className="font-head text-xl font-bold">{f.minProtein <= PROTEIN.min ? 'Any' : `${f.minProtein} g`}</span>
            </div>
            <input
              id="protein"
              type="range"
              min={PROTEIN.min}
              max={PROTEIN.max}
              step={PROTEIN.step}
              value={f.minProtein}
              onChange={(e) => set({ minProtein: Number(e.target.value) })}
              className="h-7 w-full accent-leaf"
            />
            <Tag f={f} k="protein" />
          </div>

          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 font-bold">Building</legend>
            <div className="flex flex-wrap gap-2">
              {BUILDINGS.map((b) => {
                const on = f.buildings.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    aria-pressed={on}
                    className={toggle(on)}
                    onClick={() => set({ buildings: on ? f.buildings.filter((x) => x !== b) : [...f.buildings, b].sort() })}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
            <Tag f={f} k="building" />
          </fieldset>

          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 font-bold">Diet</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['halal', 'Halal'],
                  ['vegetarian', 'Vegetarian'],
                  ['lowSugar', 'Low sugar'],
                ] as const
              ).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={f[key]} className={toggle(f[key])} onClick={() => set({ [key]: !f[key] })}>
                  {label}
                </button>
              ))}
            </div>
            {(['halal', 'vegetarian', 'sugar'] as FilterKey[]).map((k) => {
              const t = tagFor(f, k);
              return t ? (
                <span key={k} className={tagWhere}>
                  {t}
                </span>
              ) : null;
            })}
          </fieldset>

          <div className="grid grid-cols-2 gap-3 border-t border-track pt-[18px]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sort" className="font-bold">
                Sort by
              </label>
              <select id="sort" className={selectBox} value={f.sort} onChange={(e) => set({ sort: e.target.value as SortKey })}>
                {(Object.keys(SORTS) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SORTS[k].label}
                  </option>
                ))}
              </select>
              <span className={tagOrder}>ORDER BY</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="limit" className="font-bold">
                Show
              </label>
              <select
                id="limit"
                className={selectBox}
                value={f.limit ?? 'all'}
                onChange={(e) => set({ limit: e.target.value === 'all' ? null : Number(e.target.value) })}
              >
                <option value="3">Top 3</option>
                <option value="5">Top 5</option>
                <option value="all">All</option>
              </select>
              {f.limit ? <span className={tagOrder}>LIMIT</span> : <span className="text-sm text-muted">No LIMIT</span>}
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={runQuery} className={`${btnPrimary} flex-1`}>
              Run the query
            </button>
            <button
              type="button"
              onClick={() => {
                setF(DEFAULT_FILTERS);
                setStep(0);
              }}
              className={`${btnOutline} min-h-[52px] rounded-xl px-4`}
            >
              Reset
            </button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-7">
        <section aria-labelledby="q-title" className="flex flex-col gap-2">
          <p className="m-0 text-muted">Your filters ask:</p>
          <h1 id="q-title" className="h-display m-0 max-w-[22ch] text-[36px] sm:text-[44px]">
            {run.question}
          </h1>
        </section>

        <section aria-labelledby="sql-title" className="overflow-hidden rounded-2xl bg-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-line px-5 py-3">
            <h2 id="sql-title" className="h-section m-0 text-[19px] text-[#F2F5F8]">
              The SQL your filters wrote
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                className={btnPanel}
                onClick={() => {
                  navigator.clipboard?.writeText(run.sql).then(() => setCopied(true), () => undefined);
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <Link to="/sql" state={{ sql: run.sql }} className={btnPanelLink}>
                Edit in SQL Mode
              </Link>
            </div>
          </div>
          <SqlLines lines={lines} />
        </section>

        <section aria-labelledby="run-title" className="flex flex-col gap-[18px]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="run-title" ref={watchRef} tabIndex={-1} className="h-section m-0 scroll-mt-4 text-[30px] tracking-[-0.02em]">
                Watch it run
              </h2>
              <p className="mt-1 mb-0 text-muted">You write SELECT first, but the database runs FROM first.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="mr-1 text-muted">
                Step {current + 1} of {run.steps.length}
              </span>
              <button type="button" className={`${btnOutline} min-h-12 rounded-xl px-4`} onClick={() => setStep(Math.max(0, current - 1))} disabled={current === 0}>
                Previous
              </button>
              <button
                type="button"
                className={btnDark}
                onClick={() => setStep(Math.min(run.steps.length - 1, current + 1))}
                disabled={current >= run.steps.length - 1}
              >
                Next step
              </button>
            </div>
          </div>

          <StepButtons steps={run.steps.map((x) => ({ kind: x.kind, label: x.label, rowsLabel: x.rowsLabel }))} index={current} onPick={setStep} />

          <div className="flex flex-wrap items-center justify-between gap-x-7 gap-y-3 border-y-[1.5px] border-line py-4">
            <p aria-live="polite" className="m-0 max-w-[60ch] flex-[1_1_420px] text-[19px]">
              <strong className="font-mono text-base">{s.label}</strong> {s.text}
            </p>
            <p className="m-0 flex items-baseline gap-2">
              <span className="font-head text-[44px] font-extrabold tracking-[-0.03em] tabular-nums">{s.rowCount}</span>
              <span className="text-muted">rows</span>
            </p>
          </div>

          <ul aria-label="Rows at this step" className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-3.5 p-0">
            {s.tickets.map((t, i) => (
              <MealTicket key={t.id} t={t} index={i} stampDelay={t.stamp ? Math.round(stampIdx++ * stampGap + 150) : 0} />
            ))}
          </ul>
        </section>

        <section aria-labelledby="res-title" className={`${card} flex flex-col gap-5 px-6 py-[22px]`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="res-title" className="h-section m-0 text-[26px]">
                Results
              </h2>
              <p className="mt-0.5 mb-0 text-muted">{viewDefs.find((v) => v.id === view)!.cap}</p>
            </div>
            <div role="group" aria-label="Result view" className="inline-flex flex-wrap rounded-xl bg-track p-1">
              {viewDefs.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={v.id === view}
                  onClick={() => setView(v.id)}
                  className={`min-h-10 cursor-pointer rounded-[9px] border-0 px-3.5 text-[15px] ${v.id === view ? 'bg-white font-bold text-ink' : 'bg-transparent text-sub'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {n === 0 && view !== 'scatter' ? (
            <p className="m-0 text-muted">No dish passes every filter. Loosen one of the filters on the left.</p>
          ) : view === 'bar' ? (
            <BarList
              bars={run.result.rows.map((r) => ({
                label: String(r[0]),
                sub: `${r[1]}, NT$${r[2]}`,
                value: Number(r[metricIx]),
                unit: sortInfo.unit,
              }))}
            />
          ) : view === 'table' ? (
            <ResultTable result={run.result} />
          ) : (
            <Scatter points={run.points} filters={f} />
          )}
        </section>
      </main>
    </div>
  );
}
