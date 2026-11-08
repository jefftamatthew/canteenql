import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Database } from 'sql.js';
import { createCanteenDb } from './db/database';
import { getSchema, type TableInfo } from './db/build';

interface DbState {
  db: Database | null;
  schema: TableInfo[];
  error: string | null;
  /** Rebuild the original data (after UPDATE/DELETE experiments). */
  reset: () => Promise<void>;
  /** Re-read table info after a statement may have changed it. */
  refresh: () => void;
}

const Ctx = createContext<DbState | null>(null);

export function DbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [schema, setSchema] = useState<TableInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const fresh = await createCanteenDb();
      setDb((old) => {
        old?.close();
        return fresh;
      });
      setSchema(getSchema(fresh));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    if (db) setSchema(getSchema(db));
  }, [db]);

  return <Ctx.Provider value={{ db, schema, error, reset: load, refresh }}>{children}</Ctx.Provider>;
}

export function useDb() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDb outside DbProvider');
  return v;
}
