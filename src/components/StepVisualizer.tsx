import { useEffect, useState } from 'react';
import type { Stage } from '../engine/runStages';
import { StageTable } from './StageTable';
import { StepButtons } from './StepButtons';
import { btnDark, btnOutline } from '../ui/styles';

const unit = (s: Stage) => (s.kind === 'having' ? 'groups' : 'rows');

/** "Watch it run" for any SELECT: one button per clause in run order, and the rows at that step. */
export function StepVisualizer({ stages }: { stages: Stage[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
  }, [stages]);
  const i = Math.min(index, stages.length - 1);
  const s = stages[i];
  const go = (n: number) => setIndex(Math.max(0, Math.min(stages.length - 1, n)));

  return (
    <section aria-labelledby="watch-title" className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="watch-title" className="h-section m-0 text-[30px] tracking-[-0.02em]">
            Watch it run
          </h2>
          <p className="mt-1 mb-0 text-muted">You write SELECT first, but the database runs FROM first.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-1 text-muted">
            Step {i + 1} of {stages.length}
          </span>
          <button type="button" className={`${btnOutline} min-h-12 rounded-xl px-4`} onClick={() => go(i - 1)} disabled={i === 0}>
            Previous
          </button>
          <button type="button" className={btnDark} onClick={() => go(i + 1)} disabled={i >= stages.length - 1}>
            Next step
          </button>
        </div>
      </div>

      <StepButtons steps={stages.map((x) => ({ kind: x.kind, label: x.title, rowsLabel: `${x.outCount} ${unit(x)}` }))} index={i} onPick={go} />

      <div className="flex flex-wrap items-center justify-between gap-x-7 gap-y-3 border-y-[1.5px] border-line py-4">
        <div className="max-w-[60ch] flex-[1_1_420px]">
          <p aria-live="polite" className="m-0 text-[19px]">
            <strong className="font-mono text-base">{s.title}</strong> {s.note}
          </p>
          <p className="mt-1 mb-0 font-mono text-sm break-words text-muted">{s.clause}</p>
        </div>
        <p className="m-0 flex items-baseline gap-2">
          <span className="font-head text-[44px] font-extrabold tracking-[-0.03em] tabular-nums">{s.outCount}</span>
          <span className="text-muted">{unit(s)}</span>
        </p>
      </div>

      <StageTable stage={s} />
    </section>
  );
}
