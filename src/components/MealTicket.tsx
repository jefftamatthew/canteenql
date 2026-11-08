import type { Ticket } from '../explorer/explorer';

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

export { Check };

/** One row of the query, drawn as a canteen meal ticket with a price stub. */
export function MealTicket({ t, index, stampDelay }: { t: Ticket; index: number; stampDelay: number }) {
  const stamped = !!t.stamp;
  return (
    <li
      className={`relative flex min-h-[124px] overflow-hidden rounded-xl border-[1.5px] transition-[opacity,transform] duration-300 ${
        stamped ? 'translate-y-1 border-line-soft bg-ticket-off text-ticket-off-text opacity-[0.88]' : 'ticket-in border-line bg-white text-ink'
      }`}
      style={stamped ? undefined : { animationDelay: `${index * 30}ms` }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-3.5">
        <div className="flex items-center gap-2">
          {t.rank !== undefined && (
            <span className="inline-flex h-[30px] min-w-[30px] flex-none items-center justify-center rounded-full bg-plum font-head text-base font-extrabold text-white">
              {t.rank}
            </span>
          )}
          <span
            className={`font-head text-[19px] leading-[1.2] font-bold tracking-[-0.01em] ${stamped ? 'line-through decoration-2' : ''}`}
          >
            {t.name}
          </span>
        </div>
        <span className="text-[15px] text-muted">{t.stallLine}</span>
        <span className="text-[15px] text-muted">{t.detailLine}</span>
        {t.passes && (
          <span className="mt-1.5 inline-flex items-center gap-1.5 self-start rounded-full bg-leaf-soft px-2.5 py-0.5 text-sm font-bold text-leaf-dark">
            <Check />
            {t.passes}
          </span>
        )}
      </div>
      <div className="flex w-[76px] flex-none flex-col items-center justify-center border-l-2 border-dashed border-line py-2">
        <span className="text-[13px] text-muted">NT$</span>
        <span className="font-head text-[28px] font-extrabold tracking-[-0.02em] tabular-nums">{t.price}</span>
      </div>
      {stamped && (
        <span className="stamp" style={{ animationDelay: `${stampDelay}ms` }}>
          {t.stamp}
        </span>
      )}
    </li>
  );
}
