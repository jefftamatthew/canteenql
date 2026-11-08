import type { ReactNode } from 'react';
import type { ErrorExplanation } from '../engine/explainError';
import { btnOutline } from '../ui/styles';

/** Render `code` and **bold** inside plain text. */
export function rich(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="inline">{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    return <span key={i}>{part}</span>;
  });
}

const MARK: Record<string, string> = {
  where: 'bg-mustard-soft text-mustard-ink',
  having: 'bg-plum-soft text-plum-ink',
  other: 'bg-mustard-soft text-mustard-ink',
};

/** A failed query, explained in plain language with one-click fixes. */
export function ErrorCard({ error, onApply }: { error: ErrorExplanation; onApply: (sql: string) => void }) {
  return (
    <section aria-labelledby="err-title" role="alert" className="flex flex-col gap-4 rounded-2xl border-[2.5px] border-ketchup bg-white px-6 py-[22px]">
      <h2 id="err-title" className="h-section m-0 text-[26px] text-ketchup-dark">
        {error.title}
      </h2>
      {error.body && <p className="m-0 max-w-[64ch]">{rich(error.body)}</p>}
      {error.fixes.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
          {error.fixes.map((fix, i) => (
            <div key={fix.button} className="flex flex-col gap-2.5 rounded-xl bg-bg px-[18px] py-4">
              <h3 className="h-section m-0 text-[19px]">{fix.title}</h3>
              <p className="m-0 text-[15px] text-muted">{fix.description}</p>
              <pre className="m-0 font-mono text-sm leading-[1.8] whitespace-pre-wrap">
                {fix.preview.map((l, j) => (
                  <span key={j}>
                    {l.changed ? <span className={`rounded px-1 ${MARK[l.family ?? 'other']}`}>{l.text}</span> : l.text}
                    {j < fix.preview.length - 1 ? '\n' : ''}
                  </span>
                ))}
              </pre>
              <button
                type="button"
                onClick={() => onApply(fix.sql)}
                className={
                  i === 0
                    ? 'inline-flex min-h-11 cursor-pointer items-center self-start rounded-[10px] border-0 bg-ink px-[18px] text-[15px] font-bold text-white'
                    : `${btnOutline} self-start px-[18px] text-[15px]`
                }
              >
                {fix.button}
              </button>
            </div>
          ))}
        </div>
      )}
      <details className="text-[15px] text-muted">
        <summary className="flex min-h-11 cursor-pointer items-center">Show the database's own error message</summary>
        <code className="font-mono text-sm">{error.raw}</code>
      </details>
    </section>
  );
}
