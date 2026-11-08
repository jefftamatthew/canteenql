import type { QueryResult } from '../db/build';
import { formatValue, isNumber } from './format';

/** The rows exactly as the database returns them. */
export function ResultTable({ result, max = 500 }: { result: QueryResult; max?: number }) {
  if (result.columns.length === 0) return <p className="m-0 text-muted">This query returned no rows.</p>;
  const numeric = result.columns.map((_, i) => result.rows.length > 0 && result.rows.every((r) => r[i] === null || isNumber(r[i])));
  return (
    <div className="max-h-[480px] overflow-auto">
      <table className="w-full min-w-[520px] border-collapse text-[17px]">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left">
            {result.columns.map((c, i) => (
              <th
                key={i}
                scope="col"
                className={`border-b-[1.5px] border-line px-3 py-2.5 font-mono text-[13px] font-semibold whitespace-nowrap ${numeric[i] ? 'text-right' : ''}`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.slice(0, max).map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td
                  key={j}
                  className={`border-b border-track p-3 ${j === 0 ? 'font-bold' : ''} ${numeric[j] ? 'text-right tabular-nums' : ''} ${v === null ? 'text-muted italic' : ''}`}
                >
                  {formatValue(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length > max && <p className="mt-3 text-[15px] text-muted">Showing the first {max} of {result.rows.length} rows.</p>}
    </div>
  );
}
