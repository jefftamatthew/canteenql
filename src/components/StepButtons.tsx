import { PALETTE, familyOf } from '../ui/clauseColors';

export interface StepButton {
  kind: string;
  label: string;
  rowsLabel: string;
}

/** The execution-order buttons: one per clause, coloured by clause family. */
export function StepButtons({ steps, index, onPick }: { steps: StepButton[]; index: number; onPick: (i: number) => void }) {
  return (
    <ol aria-label="Execution order" className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(118px,1fr))] gap-2 p-0">
      {steps.map((s, i) => {
        const p = PALETTE[familyOf(s.kind)];
        const active = i === index;
        const done = i < index;
        const style = active
          ? { border: '2px solid #18233A', background: p.on, color: p.onFg }
          : done
            ? { border: '2px solid transparent', background: p.bg, color: p.fg }
            : { border: '2px solid #D5DEE6', background: '#FFFFFF', color: '#4A5872' };
        return (
          <li key={i} className="flex">
            <button
              type="button"
              onClick={() => onPick(i)}
              aria-current={active ? 'step' : undefined}
              className="flex min-h-[84px] w-full cursor-pointer flex-col items-start justify-center gap-px rounded-xl px-3 py-2.5 text-left"
              style={style}
            >
              <span className="text-sm">{i + 1}.</span>
              <span className="font-mono text-sm font-semibold">{s.label}</span>
              <span className="text-sm">{s.rowsLabel}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
