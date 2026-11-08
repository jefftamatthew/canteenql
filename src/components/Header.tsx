import { NavLink } from 'react-router-dom';

export function Logo() {
  return (
    <svg width="34" height="26" viewBox="0 0 34 26" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="31" height="23" rx="5" fill="#2C6E57" />
      <rect x="5" y="5" width="13" height="16" rx="2" fill="#F5CB3C" />
      <rect x="20" y="5" width="9" height="7" rx="2" fill="#FFFFFF" />
      <rect x="20" y="14" width="9" height="7" rx="2" fill="#FFFFFF" />
    </svg>
  );
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center px-3.5 no-underline ${
    isActive ? 'font-bold text-ink shadow-[inset_0_-3px_0_#2C6E57] hover:text-ink' : 'text-muted hover:text-ink'
  }`;

export function Header({ note }: { note: string }) {
  return (
    <header className="border-b border-line-soft bg-white">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-9 gap-y-3 px-6 py-2.5">
        <NavLink to="/" className="flex min-h-11 items-center gap-2.5 text-ink no-underline hover:text-ink">
          <Logo />
          <span className="font-head text-[22px] font-extrabold tracking-[-0.02em]">CanteenQL</span>
        </NavLink>
        <nav aria-label="Main" className="flex flex-wrap gap-1">
          <NavLink to="/" end className={linkClass}>
            Query Explorer
          </NavLink>
          <NavLink to="/planner" className={linkClass}>
            Meal Planner
          </NavLink>
          <NavLink to="/sql" className={linkClass}>
            SQL Mode
          </NavLink>
        </nav>
        <span className="ml-auto text-[15px] text-muted">{note}</span>
      </div>
    </header>
  );
}
