import type { Stage } from '../engine/runStages';
import { formatValue, isNumber } from './format';
import { Check } from './MealTicket';

const MAX_ROWS = 150;

/** The rows at one step, with removed rows struck out and groups colour-banded. */
export function StageTable({ stage }: { stage: Stage }) {
  const marker = stage.kind === 'where' || stage.kind === 'having' || stage.kind === 'limit' || stage.kind === 'group';
  const rows = stage.rows.slice(0, MAX_ROWS);
  return (
    <div className="max-h-[520px] overflow-auto rounded-2xl border-[1.5px] border-line bg-white">
      <table className="w-full border-collapse text-base">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="text-left">
            {marker && (
              <th scope="col" className="w-20 border-b-[1.5px] border-line px-3 py-2.5 text-sm font-bold text-muted">
                {stage.kind === 'group' ? 'Group' : 'Result'}
              </th>
            )}
            {stage.columns.map((c, i) => (
              <th key={`${c}-${i}`} scope="col" className="border-b-[1.5px] border-line px-3 py-2.5 font-mono text-[13px] font-semibold whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const dropped = r.status === 'dropped';
            const newGroup = stage.kind === 'group' && i > 0 && rows[i - 1].group !== r.group;
            const banded = (stage.kind === 'group' || stage.kind === 'having') && r.group !== undefined;
            return (
              <tr
                key={r.id}
                className={`${banded ? `grouped g${r.group! % 8}` : ''} ${dropped ? 'bg-ticket-off text-ticket-off-text' : ''} ${newGroup ? 'border-t-4 border-bg' : ''}`}
              >
                {marker && (
                  <td className="border-b border-track px-3 py-2">
                    {r.status === 'kept' && (
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-leaf-dark">
                        <Check />
                        Kept
                      </span>
                    )}
                    {dropped && (
                      <span className="inline-block -rotate-6 rounded-md border-2 border-ketchup px-1.5 font-head text-sm font-extrabold text-ketchup">Out</span>
                    )}
                    {stage.kind === 'group' && <span className="text-sm text-muted">{r.groupLabel}</span>}
                  </td>
                )}
                {r.values.map((v, j) => (
                  <td
                    key={j}
                    className={`border-b border-track px-3 py-2 whitespace-nowrap ${isNumber(v) ? 'text-right tabular-nums' : ''} ${v === null ? 'text-muted italic' : ''} ${
                      dropped ? 'line-through decoration-2' : ''
                    }`}
                  >
                    {formatValue(v)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {stage.rows.length > MAX_ROWS && (
        <p className="m-0 p-3 text-[15px] text-muted">
          Showing the first {MAX_ROWS} of {stage.rows.length} rows in this step.
        </p>
      )}
      {stage.rows.length === 0 && <p className="m-0 p-4 text-muted">No rows at this step.</p>}
    </div>
  );
}
