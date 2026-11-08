import type { QueryResult } from '../db/build';
import { formatValue } from './format';

export interface Bar {
  label: string;
  sub?: string;
  value: number;
  unit: string;
}

/** Horizontal bars, one per row, with the value printed at the end. */
export function BarList({ bars }: { bars: Bar[] }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="flex flex-col gap-4">
      {bars.map((b, i) => (
        <div key={i} className="grid grid-cols-[minmax(120px,220px)_minmax(0,1fr)_auto] items-center gap-4 max-sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="font-bold">{b.label}</div>
            {b.sub && <div className="text-[15px] text-muted">{b.sub}</div>}
          </div>
          <div className="h-[30px] rounded-lg bg-track max-sm:col-span-2 max-sm:row-start-2">
            <div className="h-full rounded-lg bg-leaf" style={{ width: `${Math.max(2, (b.value / max) * 100)}%` }} />
          </div>
          <div className="text-right font-head text-[22px] font-extrabold tabular-nums">
            {b.unit === 'NT$' ? `NT$${formatValue(b.value)}` : `${formatValue(b.value)} ${b.unit}`}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Bars for any result with one text column and one number column. Returns null when a chart doesn't fit. */
export function barsFromResult(result: QueryResult): { bars: Bar[]; measure: string; label: string } | null {
  const { columns, rows } = result;
  if (rows.length < 2 || rows.length > 40) return null;
  const isText = (i: number) => rows.every((r) => typeof r[i] === 'string');
  const isNum = (i: number) => rows.every((r) => typeof r[i] === 'number');
  const labelIx = columns.findIndex((_, i) => isText(i));
  const numIx = columns.map((_, i) => i).filter((i) => isNum(i) && !/(^|_)id$/i.test(columns[i]));
  if (labelIx < 0 || numIx.length === 0) return null;
  const ix = numIx[numIx.length - 1];
  const unit = /price/i.test(columns[ix]) ? 'NT$' : /kcal/i.test(columns[ix]) ? 'kcal' : /_g$/i.test(columns[ix]) ? 'g' : '';
  return {
    measure: columns[ix],
    label: columns[labelIx],
    bars: rows.map((r) => ({ label: String(r[labelIx]), value: Number(r[ix]), unit })),
  };
}
