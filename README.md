# CanteenQL

An interactive way to learn SQL using a campus canteen: seven food stalls, their dishes, nutrition facts and a week of meal logs.
It runs real SQLite in the browser (sql.js), so there is no server.

The look follows the "Canteen SQL Visualizer UI" design canvas.

## The three screens

| Screen | What students do |
|---|---|
| **Query Explorer** (`/`) | Move filters and watch them write a SQL query. Then step through it in run order (FROM, JOIN, WHERE, SELECT, ORDER BY, LIMIT). Each row is a meal ticket that gets stamped out when a rule removes it. Results show as a bar chart, a table, or a price-vs-protein scatter. |
| **Meal Planner** (`/planner`) | Set a budget and calorie and protein targets. The planner runs one query per meal and picks the best combination. "Watch this query run" opens that query in SQL Mode. |
| **SQL Mode** (`/sql`) | Write any SELECT query, read-only. Mistakes get a plain-language error card with one-click fixes, e.g. "Move WHERE up" or "Change to HAVING". Also holds 12 practice challenges, three open at a time. |

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine, explorer, planner, challenge and error-fix tests
npm run build    # static site in dist/
```

## Where things live

| Path | What |
|---|---|
| `src/db/seed.ts` | Schema and the fixed sample data |
| `src/challenges/challenges.ts` | The 12 practice challenges |
| `src/explorer/explorer.ts` | Filters, the SQL they write, and every step's tickets |
| `src/planner/plan.ts` | Meal planning queries and the combination search |
| `src/engine/runStages.ts` | Step-by-step stages for any SELECT, used in SQL Mode |
| `src/engine/explainError.ts` | Error titles, explanations and suggested fixes |
| `src/engine/clauses.ts` | Clause splitting used by "Tidy up" and the fixes |
| `src/index.css` | Design tokens (colours, fonts, stamp animation) |

Every number on screen comes from a real query. The tests check that the Explorer's final tickets match what the generated SQL actually returns.
