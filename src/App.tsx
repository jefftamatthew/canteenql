import { useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DbProvider, useDb } from './DbContext';
import { Header } from './components/Header';
import { Explorer } from './pages/Explorer';
import { Planner } from './pages/Planner';
import { SqlMode } from './pages/SqlMode';
import { runQuery } from './db/build';

function Shell() {
  const { db, error } = useDb();
  const { pathname } = useLocation();
  const stalls = useMemo(() => (db ? Number(runQuery(db, 'SELECT COUNT(*) FROM stalls').rows[0][0]) : 0), [db]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const note = pathname.startsWith('/sql') ? 'Read-only: only SELECT queries run here' : `Menu from ${stalls} campus stalls`;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <Header note={db ? note : ''} />
      {error ? (
        <p className="mx-auto max-w-[1320px] px-6 py-8 text-ketchup-dark">The database didn't load: {error}. Reload the page to try again.</p>
      ) : !db ? (
        <p className="mx-auto max-w-[1320px] px-6 py-8 text-muted">Loading the canteen database…</p>
      ) : (
        <Routes>
          <Route path="/" element={<Explorer />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/sql" element={<SqlMode />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </div>
  );
}

export default function App() {
  return (
    <DbProvider>
      <Shell />
    </DbProvider>
  );
}
