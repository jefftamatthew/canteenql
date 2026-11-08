import type { DishPoint, Filters } from '../explorer/explorer';
import { PRICE, PROTEIN } from '../explorer/explorer';

/** Price across, protein up. Result dishes are filled, the rest outlined; the shaded box is the price/protein filter. */
export function Scatter({ points, filters }: { points: DishPoint[]; filters: Filters }) {
  const xMin = Math.floor(Math.min(...points.map((p) => p.price)) / 10) * 10;
  const xMax = Math.ceil(Math.max(...points.map((p) => p.price)) / 10) * 10;
  const yMax = Math.ceil(Math.max(...points.map((p) => p.protein)) / 10) * 10;
  const x = (v: number) => ((v - xMin) / (xMax - xMin)) * 100;
  const y = (v: number) => (v / yMax) * 100;

  const hasPrice = filters.maxPrice < PRICE.max;
  const hasProtein = filters.minProtein > PROTEIN.min;
  const box = hasPrice || hasProtein;
  const boxRight = hasPrice ? Math.min(100, Math.max(0, x(filters.maxPrice))) : 100;
  const boxBottom = hasProtein ? Math.min(100, y(filters.minProtein)) : 0;
  const hits = points.filter((p) => p.inResult);

  return (
    <figure className="m-0 flex flex-col gap-2.5">
      <div
        role="img"
        aria-label={`Scatter plot of ${points.length} dishes by price and protein. Your results: ${hits.map((h) => `${h.name}, NT$${h.price}, ${h.protein} g`).join('; ')}.`}
        className="relative mx-2 mb-7 ml-11 h-[320px] border-b-2 border-l-2 border-ink"
      >
        {box && (
          <>
            <div
              aria-hidden="true"
              className="absolute left-0 box-border rounded border-2 border-dashed border-leaf bg-leaf-soft"
              style={{ bottom: `${boxBottom}%`, width: `${boxRight}%`, height: `${100 - boxBottom}%` }}
            />
            <span aria-hidden="true" className="absolute top-2 left-2.5 text-sm font-bold text-leaf-dark">
              Matches your {[hasPrice && 'price', hasProtein && 'protein'].filter(Boolean).join(' and ')} filter{hasPrice && hasProtein ? 's' : ''}
            </span>
          </>
        )}
        {points.map((p) => {
          const px = x(p.price);
          // Result labels alternate sides so neighbours don't collide; near the right edge they always go left.
          const hitIndex = hits.indexOf(p);
          const flip = px > 68 || (hitIndex > 0 && hitIndex % 2 === 1 && px > 25);
          return (
            <div
              key={p.id}
              title={`${p.name}: NT$${p.price}, ${p.protein} g`}
              className={`absolute flex items-center gap-1.5 ${flip ? 'flex-row-reverse' : ''} ${p.inResult ? 'z-10' : ''}`}
              style={{ left: `${px}%`, bottom: `${y(p.protein)}%`, transform: flip ? 'translate(calc(-100% + 9px), 9px)' : 'translate(-9px, 9px)' }}
            >
              <span
                className={`box-border h-[18px] w-[18px] flex-none rounded-full border-2 ${p.inResult ? 'border-ink bg-leaf' : 'border-gutter bg-white'}`}
              />
              {p.inResult && <span className="rounded bg-white/90 px-1 text-[13px] font-bold whitespace-nowrap text-ink">{p.name}</span>}
            </div>
          );
        })}
        <span className="absolute bottom-[-4px] left-[-40px] text-[13px] text-muted">0 g</span>
        <span className="absolute top-[-4px] left-[-44px] text-[13px] text-muted">{yMax} g</span>
        <span className="absolute bottom-[-26px] left-[-6px] text-[13px] text-muted">NT${xMin}</span>
        <span className="absolute bottom-[-26px] left-[calc(50%-22px)] text-[13px] text-muted">NT${(xMin + xMax) / 2}</span>
        <span className="absolute right-[-6px] bottom-[-26px] text-[13px] text-muted">NT${xMax}</span>
      </div>
      <figcaption className="text-[15px] text-muted">
        Price across, protein up. Filled dots are your {hits.length} result{hits.length === 1 ? '' : 's'}; outlined dots were filtered out or
        cut. Hover a dot for its name.
      </figcaption>
    </figure>
  );
}
