import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useDb } from '../DbContext';
import { CHALLENGES, isOpen, opensAfter } from '../challenges/challenges';
import { loadProgress, saveProgress } from '../challenges/progress';
import { runWithSteps, type RunOutcome } from '../engine/runStages';
import { checkAnswer, type CheckResult } from '../engine/checkAnswer';
import { READ_ONLY, explainError, type ErrorExplanation } from '../engine/explainError';
import { tidy } from '../engine/clauses';
import { stripComments } from '../engine/parseQuery';
import { runQuery } from '../db/build';
import { SqlEditor } from '../components/SqlEditor';
import { ErrorCard, rich } from '../components/ErrorCard';
import { SchemaList } from '../components/SchemaList';
import { StepVisualizer } from '../components/StepVisualizer';
import { ResultTable } from '../components/ResultTable';
import { BarList, barsFromResult } from '../components/BarList';
import { Check } from '../components/MealTicket';
import { btnOutline, btnPanel, card } from '../ui/styles';

const FREE_SQL = 'SELECT * FROM stalls;';

/** True when every statement in the text is a SELECT (or WITH … SELECT). */
function selectOnly(sql: string): boolean {
  const statements = stripComments(sql)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  return statements.length > 0 && statements.every((s) => /^(select|with)\b/i.test(s));
}

type View = 'table' | 'bar';

export function SqlMode() {
  const { db, schema, reset } = useDb();
  const location = useLocation();
  const incoming = (location.state as { sql?: string } | null)?.sql;

  const [solved, setSolved] = useState(loadProgress);
  const firstOpen = CHALLENGES.findIndex((c, i) => !solved.has(c.id) && isOpen(i, solved.size));
  const [challenge, setChallenge] = useState<number | null>(incoming ? null : firstOpen >= 0 ? firstOpen : null);
  const [sql, setSql] = useState(incoming ?? (challenge !== null ? CHALLENGES[challenge].starter : FREE_SQL));
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [error, setError] = useState<ErrorExplanation | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [hints, setHints] = useState(0);
  const [view, setView] = useState<View>('table');
  const resultRef = useRef<HTMLDivElement>(null);
  const sqlRef = useRef(sql);
  sqlRef.current = sql;

  const c = challenge !== null ? CHALLENGES[challenge] : null;

  const run = useCallback(() => {
    if (!db) return;
    const text = sqlRef.current;
    setCheck(null);
    if (!selectOnly(text)) {
      setOutcome(null);
      setError(READ_ONLY);
      return;
    }
    const before = Number(runQuery(db, 'SELECT total_changes()').rows[0][0]);
    const out = runWithSteps(db, text);
    if (Number(runQuery(db, 'SELECT total_changes()').rows[0][0]) !== before) {
      // A statement slipped through and changed data: put the canteen back.
      void reset();
      setOutcome(null);
      setError(READ_ONLY);
      return;
    }
    if (out.error) {
      setOutcome(null);
      setError(explainError(db, text, out.rawError ?? out.error));
      return;
    }
    setError(null);
    setOutcome(out);
    setView('table');
    if (c) {
      const res = checkAnswer(db, text, c.solution);
      setCheck(res);
      if (res.correct && !solved.has(c.id)) {
        const next = new Set(solved);
        next.add(c.id);
        saveProgress(next);
        setSolved(next);
      }
    }
    requestAnimationFrame(() => resultRef.current?.focus({ preventScroll: true }));
  }, [db, c, solved, reset]);

  // A query handed over from the Explorer or the Planner runs straight away.
  const ranIncoming = useRef(false);
  useEffect(() => {
    if (incoming && !ranIncoming.current) {
      ranIncoming.current = true;
      run();
    }
  }, [incoming, run]);

  const openChallenge = (i: number | null) => {
    setChallenge(i);
    setSql(i === null ? FREE_SQL : CHALLENGES[i].starter);
    setOutcome(null);
    setError(null);
    setCheck(null);
    setHints(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const bars = useMemo(() => (outcome?.result ? barsFromResult(outcome.result) : null), [outcome]);
  const nextOpen = CHALLENGES.findIndex((x, i) => !solved.has(x.id) && isOpen(i, solved.size) && i !== challenge);

  return (
    <div className="mx-auto flex max-w-[1320px] flex-wrap items-start gap-8 px-6 pt-8 pb-16">
      <aside aria-labelledby="schema-title" className="flex min-w-0 flex-[1_1_290px] flex-col gap-4">
        <h2 id="schema-title" className="h-section m-0 text-2xl">
          Database tables
        </h2>
        <SchemaList schema={schema} />
      </aside>

      <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-6">
        <section aria-labelledby="ed-title" className="flex flex-col gap-2">
          <p className="m-0 text-muted">{c ? `Challenge ${challenge! + 1} of ${CHALLENGES.length}: ${c.concept}` : 'Write your own query'}</p>
          <h1 id="ed-title" className="h-display m-0 max-w-[22ch] text-[36px] sm:text-[44px]">
            {c ? c.question : 'Ask the canteen anything.'}
          </h1>
          <p className="m-0 max-w-[64ch]">
            {c ? rich(c.idea) : 'Any SELECT query runs here. Use the table list for column names, then step through the result.'}
          </p>
          {c && (
            <div className="flex flex-wrap items-center gap-2">
              {hints < 3 && (
                <button type="button" className={`${btnOutline} text-[15px]`} onClick={() => setHints((h) => h + 1)}>
                  {hints === 0 ? 'Show a hint' : hints === 1 ? 'Show another hint' : 'Show the answer'}
                </button>
              )}
              <button type="button" className="min-h-11 cursor-pointer border-0 bg-transparent px-2 text-[15px] text-muted underline underline-offset-2" onClick={() => openChallenge(null)}>
                Write your own query instead
              </button>
            </div>
          )}
          {c && hints > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {c.hints.slice(0, Math.min(hints, 2)).map((h, i) => (
                <li key={i} className="rounded-xl bg-mustard-soft px-4 py-2 text-mustard-ink">
                  <strong>Hint {i + 1}:</strong> {i === 1 ? <code className="font-mono text-sm">{h}</code> : h}
                </li>
              ))}
              {hints >= 3 && (
                <li className={`${card} px-4 py-3`}>
                  <strong>One correct answer</strong>
                  <pre className="mt-1 mb-2 font-mono text-sm whitespace-pre-wrap">{tidy(c.solution)}</pre>
                  <button type="button" className={`${btnOutline} text-[15px]`} onClick={() => setSql(tidy(c.solution))}>
                    Put it in the editor
                  </button>
                </li>
              )}
            </ul>
          )}
        </section>

        <div className="overflow-hidden rounded-2xl bg-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-line px-5 py-3">
            <label htmlFor="editor" className="text-[15px] text-panel-sub">
              Your query <span className="hidden text-gutter sm:inline">(Ctrl + Enter runs it)</span>
            </label>
            <div className="flex gap-2">
              <button type="button" className={btnPanel} onClick={() => setSql(tidy(sql))}>
                Tidy up
              </button>
              <button type="button" onClick={run} className="inline-flex min-h-11 cursor-pointer items-center rounded-[10px] border-0 bg-leaf px-[22px] text-base font-bold text-white">
                Run the query
              </button>
            </div>
          </div>
          <SqlEditor
            id="editor"
            value={sql}
            onChange={(v) => {
              setSql(v);
              if (error) setError(null);
            }}
            onRun={run}
            schema={schema}
            errorRange={error?.range}
          />
        </div>

        {error && (
          <ErrorCard
            error={error}
            onApply={(fixed) => {
              setSql(fixed);
              setError(null);
            }}
          />
        )}

        {check && (
          <div
            role="status"
            className={`flex flex-wrap items-center gap-3 rounded-2xl border-[2.5px] px-6 py-4 ${check.correct ? 'border-leaf bg-leaf-soft' : 'border-mustard bg-mustard-soft'}`}
          >
            <p className={`m-0 flex-1 font-bold ${check.correct ? 'text-leaf-dark' : 'text-mustard-ink'}`}>
              {check.correct ? 'Solved. ' : 'Not quite yet. '}
              {check.correct ? 'Your query returns exactly the right rows.' : check.message}
            </p>
            {check.correct && nextOpen >= 0 && (
              <button type="button" className="inline-flex min-h-11 cursor-pointer items-center rounded-[10px] border-0 bg-ink px-[18px] font-bold text-white" onClick={() => openChallenge(nextOpen)}>
                Next challenge
              </button>
            )}
          </div>
        )}

        {outcome?.result && (
          <div ref={resultRef} tabIndex={-1} className="flex flex-col gap-7 outline-none">
            {outcome.stages ? (
              <StepVisualizer stages={outcome.stages} />
            ) : (
              outcome.unsupported && <p className="m-0 rounded-xl bg-track px-4 py-3 text-sub">{outcome.unsupported}</p>
            )}
            <section aria-labelledby="res-title" className={`${card} flex flex-col gap-5 px-6 py-[22px]`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="res-title" className="h-section m-0 text-[26px]">
                    Results
                  </h2>
                  <p className="mt-0.5 mb-0 text-muted">
                    {view === 'bar' && bars
                      ? `${bars.measure} for each ${bars.label}`
                      : `${outcome.result.rows.length} row${outcome.result.rows.length === 1 ? '' : 's'}, exactly as the database returns them`}
                  </p>
                </div>
                {bars && (
                  <div role="group" aria-label="Result view" className="inline-flex rounded-xl bg-track p-1">
                    {(['table', 'bar'] as View[]).map((v) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={v === view}
                        onClick={() => setView(v)}
                        className={`min-h-10 cursor-pointer rounded-[9px] border-0 px-3.5 text-[15px] ${v === view ? 'bg-white font-bold text-ink' : 'bg-transparent text-sub'}`}
                      >
                        {v === 'table' ? 'Table' : 'Bar chart'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {view === 'bar' && bars ? <BarList bars={bars.bars} /> : <ResultTable result={outcome.result} />}
            </section>
          </div>
        )}

        <section aria-labelledby="ch-title" className="flex flex-col gap-3 border-t-[1.5px] border-line pt-[22px]">
          <h2 id="ch-title" className="h-section m-0 text-2xl">
            Practice challenges
          </h2>
          <p className="m-0 text-muted">
            {solved.size} of {CHALLENGES.length} solved
          </p>
          <ol className="m-0 flex list-none flex-col p-0">
            {CHALLENGES.map((x, i) => {
              const isCurrent = i === challenge;
              const done = solved.has(x.id);
              const open = isOpen(i, solved.size);
              return (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line-soft py-3.5 last:border-b-0">
                  <span className={isCurrent ? 'font-bold' : open || done ? '' : 'text-muted'}>
                    <span className="mr-2 text-muted tabular-nums">{i + 1}.</span>
                    {x.question}
                  </span>
                  <span className="flex items-center gap-3">
                    {done && (
                      <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-leaf-dark">
                        <Check />
                        Solved
                      </span>
                    )}
                    {isCurrent && !done && <span className="rounded-full bg-mustard-soft px-2.5 py-0.5 text-[15px] font-bold text-mustard-ink">Working on it</span>}
                    {!isCurrent && open && (
                      <button type="button" className={`${btnOutline} text-[15px]`} onClick={() => openChallenge(i)}>
                        {done ? 'Try again' : 'Try it'}
                      </button>
                    )}
                    {!open && !done && <span className="text-[15px] text-muted">Opens after {opensAfter(i)} solved</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </div>
  );
}
