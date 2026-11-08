import { PALETTE, familyOfKeyword, type Family } from '../ui/clauseColors';

export interface Line {
  kw: string;
  rest: string;
  /** Family colour of the keyword; defaults to the keyword's own family. */
  family?: Family;
  active?: boolean;
}

/** Read-only SQL on the dark panel, numbered, with clause keywords coloured and the active step's lines lit. */
export function SqlLines({ lines }: { lines: Line[] }) {
  return (
    <div className="overflow-x-auto py-3">
      {lines.map((l, i) => {
        const fam = PALETTE[l.family ?? familyOfKeyword(l.kw.trim())];
        return (
          <div
            key={i}
            className="pr-6 font-mono text-[15px] leading-8 whitespace-pre transition-colors duration-200"
            style={l.active ? { background: '#2A3A5C', boxShadow: `inset 4px 0 0 ${fam.kw}` } : undefined}
          >
            <span className="inline-block w-12 pr-5 text-right text-gutter">{i + 1}</span>
            <span className="font-semibold" style={{ color: fam.kw }}>
              {l.kw}
            </span>
            <span className="text-panel-text">{l.rest}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Split free SQL text into keyword-first lines for SqlLines (used for read-only previews). */
export function toLines(sql: string): Line[] {
  return sql.split('\n').map((line) => {
    const m = line.match(/^(\s*)((?:LEFT |INNER |CROSS )?JOIN|SELECT|FROM|WHERE|AND|OR|GROUP BY|HAVING|ORDER BY|LIMIT)\b/i);
    return m ? { kw: m[1] + m[2], rest: line.slice(m[0].length) } : { kw: '', rest: line };
  });
}
