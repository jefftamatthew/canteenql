import { useState } from 'react';
import type { TableInfo } from '../db/build';
import { btnOutline } from '../ui/styles';

const LINKS: Record<string, string> = {
  'dishes.stall_id': 'Each dish is sold by one stall.',
  'nutrition.dish_id': 'Each dish has one row of nutrition facts.',
  'meal_logs.user_id': 'Each meal log belongs to one user.',
  'meal_logs.dish_id': 'Each meal log records one dish.',
};

/** The database tables with their columns, and how they connect. */
export function SchemaList({ schema }: { schema: TableInfo[] }) {
  const [showLinks, setShowLinks] = useState(false);
  const links = schema.flatMap((t) => t.columns.filter((c) => c.fk).map((c) => ({ from: `${t.name}.${c.name}`, to: c.fk! })));
  return (
    <>
      <div className="overflow-hidden rounded-2xl border-[1.5px] border-line bg-white">
        {schema.map((t, i) => (
          <div key={t.name} className={`flex flex-col gap-1 px-[18px] py-3.5 ${i < schema.length - 1 ? 'border-b border-track' : ''}`}>
            <span className="font-mono text-[15px] font-semibold text-ocean-ink">{t.name}</span>
            <span className="font-mono text-[13px] leading-[1.8] break-words text-sub">{t.columns.map((c) => c.name).join(', ')}</span>
            {t.columns
              .filter((c) => c.fk)
              .map((c) => (
                <span key={c.name} className="text-sm text-muted">
                  {c.name} points to {c.fk}
                </span>
              ))}
          </div>
        ))}
      </div>
      <button type="button" className={`${btnOutline} min-h-12 rounded-xl`} aria-expanded={showLinks} onClick={() => setShowLinks((s) => !s)}>
        {showLinks ? 'Hide how tables connect' : 'Show how tables connect'}
      </button>
      {showLinks && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {links.map((l) => (
            <li key={l.from} className="flex flex-col gap-0.5">
              <span className="font-mono text-sm">
                {l.from} <span aria-label="joins to">=</span> {l.to}
              </span>
              <span className="text-[15px] text-muted">{LINKS[l.from] ?? ''} Use this pair in a JOIN … ON.</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
