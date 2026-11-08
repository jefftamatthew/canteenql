export interface Challenge {
  id: string;
  /** The question, shown as the page heading and in the challenge list. */
  question: string;
  /** The SQL idea this challenge introduces. */
  concept: string;
  /** One short explanation of that idea. Text in `backticks` shows as code. */
  idea: string;
  starter: string;
  solution: string;
  hints: [string, string];
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'every-dish',
    question: 'What does the dishes table look like?',
    concept: 'SELECT *',
    idea: '`SELECT *` means "every column". `FROM` names the table to read. Show every column of the dishes table.',
    starter: 'SELECT ',
    solution: 'SELECT * FROM dishes;',
    hints: ['The table is called dishes.', 'SELECT * FROM dishes;'],
  },
  {
    id: 'names-prices',
    question: 'What does each dish cost?',
    concept: 'Choosing columns',
    idea: 'List the columns you want after `SELECT`, with commas between them. Show the name and price of every dish, in that order.',
    starter: 'SELECT  FROM dishes;',
    solution: 'SELECT name, price FROM dishes;',
    hints: ['Put name and price after SELECT.', 'SELECT name, price FROM dishes;'],
  },
  {
    id: 'cheap',
    question: 'Which dishes cost less than NT$60?',
    concept: 'WHERE',
    idea: '`WHERE` keeps only the rows where a condition is true. Compare with `<`, `>`, `=`, `<=` or `>=`. Show the name and price.',
    starter: 'SELECT name, price FROM dishes\nWHERE ',
    solution: 'SELECT name, price FROM dishes WHERE price < 60;',
    hints: ['Compare price with 60.', 'WHERE price < 60'],
  },
  {
    id: 'veg-lunch',
    question: 'Which vegetarian dishes are served at lunch?',
    concept: 'AND',
    idea: "`AND` joins two conditions that must both be true. Text goes in single quotes, like `'lunch'`. Show the name and price.",
    starter: 'SELECT name, price FROM dishes\nWHERE ',
    solution: "SELECT name, price FROM dishes WHERE is_vegetarian = 1 AND meal_slot = 'lunch';",
    hints: ['Vegetarian dishes have is_vegetarian = 1.', "WHERE is_vegetarian = 1 AND meal_slot = 'lunch'"],
  },
  {
    id: 'protein-top5',
    question: 'Which 5 dishes have the most protein?',
    concept: 'ORDER BY and LIMIT',
    idea: '`ORDER BY column DESC` sorts biggest first. `LIMIT 5` keeps the first 5 rows. Show dish_id and protein_g from the nutrition table, highest first.',
    starter: 'SELECT dish_id, protein_g FROM nutrition\n',
    solution: 'SELECT dish_id, protein_g FROM nutrition ORDER BY protein_g DESC LIMIT 5;',
    hints: ['Sort by protein_g with DESC, then add LIMIT.', 'ORDER BY protein_g DESC LIMIT 5'],
  },
  {
    id: 'count-avg',
    question: 'How many dishes are there, and what do they cost on average?',
    concept: 'COUNT and AVG',
    idea: '`COUNT(*)` counts rows and `AVG(price)` averages a column. Both squash all the rows into one. Show the count first, then the average price.',
    starter: 'SELECT  FROM dishes;',
    solution: 'SELECT COUNT(*), AVG(price) FROM dishes;',
    hints: ['Use COUNT(*) and AVG(price).', 'SELECT COUNT(*), AVG(price) FROM dishes;'],
  },
  {
    id: 'per-slot',
    question: 'How many dishes are there for each meal?',
    concept: 'GROUP BY',
    idea: '`GROUP BY meal_slot` makes one group for each meal. `COUNT(*)` then counts each group. Show meal_slot and the count.',
    starter: 'SELECT meal_slot, COUNT(*)\nFROM dishes\n',
    solution: 'SELECT meal_slot, COUNT(*) FROM dishes GROUP BY meal_slot;',
    hints: ['Add GROUP BY at the end.', 'GROUP BY meal_slot'],
  },
  {
    id: 'busy',
    question: 'Who logged more than 20 meals this week?',
    concept: 'HAVING',
    idea: '`WHERE` filters rows before grouping. `HAVING` filters whole groups after grouping, so it can use `COUNT(*)`. Show user_id and the number of meals.',
    starter: 'SELECT user_id, COUNT(*)\nFROM meal_logs\n',
    solution: 'SELECT user_id, COUNT(*) FROM meal_logs GROUP BY user_id HAVING COUNT(*) > 20;',
    hints: ['GROUP BY user_id, then HAVING COUNT(*) > 20.', 'GROUP BY user_id HAVING COUNT(*) > 20'],
  },
  {
    id: 'dish-stall',
    question: 'Which stall sells each dish?',
    concept: 'JOIN',
    idea: 'dishes only stores a stall_id. `JOIN stalls s ON d.stall_id = s.id` attaches the matching stall to each dish. Show the dish name and the stall_name.',
    starter: 'SELECT d.name, s.stall_name\nFROM dishes d\nJOIN stalls s ON ',
    solution: 'SELECT d.name, s.stall_name FROM dishes d JOIN stalls s ON d.stall_id = s.id;',
    hints: ['Match the dish’s stall_id with the stall’s id.', 'JOIN stalls s ON d.stall_id = s.id'],
  },
  {
    id: 'halal-protein',
    question: 'Which halal dishes have more than 25 g of protein?',
    concept: 'Two JOINs',
    idea: 'Halal is stored on stalls and protein on nutrition, so you need both tables. Show the dish name and protein_g.',
    starter: 'SELECT d.name, n.protein_g\nFROM dishes d\nJOIN stalls s ON d.stall_id = s.id\nJOIN nutrition n ON \nWHERE ',
    solution:
      'SELECT d.name, n.protein_g FROM dishes d JOIN stalls s ON d.stall_id = s.id JOIN nutrition n ON d.id = n.dish_id WHERE s.is_halal = 1 AND n.protein_g > 25;',
    hints: ['Join nutrition on d.id = n.dish_id.', 'WHERE s.is_halal = 1 AND n.protein_g > 25'],
  },
  {
    id: 'avg-under-100',
    question: "What's the average price at each stall, for dishes under NT$100?",
    concept: 'JOIN, WHERE and GROUP BY',
    idea: 'Clause order matters: `WHERE` comes before `GROUP BY`. Show stall_name and the average price.',
    starter: 'SELECT s.stall_name, AVG(d.price) AS avg_price\nFROM dishes d\nJOIN stalls s ON d.stall_id = s.id\n',
    solution:
      'SELECT s.stall_name, AVG(d.price) AS avg_price FROM dishes d JOIN stalls s ON d.stall_id = s.id WHERE d.price < 100 GROUP BY s.stall_name;',
    hints: ['Filter the dishes with WHERE, then group by stall.', 'WHERE d.price < 100 GROUP BY s.stall_name'],
  },
  {
    id: 'cheapest-lunch',
    question: 'Which stall has the cheapest average lunch?',
    concept: 'Everything together',
    idea: 'Filter to lunch dishes, group by stall, sort by the average price and keep only the first row. Show stall_name and the average price.',
    starter: 'SELECT s.stall_name, AVG(d.price) AS avg_price\nFROM dishes d\nJOIN stalls s ON d.stall_id = s.id\n',
    solution:
      "SELECT s.stall_name, AVG(d.price) AS avg_price FROM dishes d JOIN stalls s ON d.stall_id = s.id WHERE d.meal_slot = 'lunch' GROUP BY s.stall_name ORDER BY avg_price LIMIT 1;",
    hints: ["WHERE d.meal_slot = 'lunch', then GROUP BY s.stall_name.", 'ORDER BY avg_price LIMIT 1'],
  },
];

/** A challenge opens once you have solved enough of the earlier ones (three are always open ahead). */
export function isOpen(index: number, solvedCount: number): boolean {
  return index <= solvedCount + 2;
}

export function opensAfter(index: number): number {
  return index - 2;
}
