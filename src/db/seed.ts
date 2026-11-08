// CanteenQL sample database: campus food stalls, their dishes, nutrition facts,
// and a week of meal logs. Everything is deterministic so challenge answers never change.

export const SCHEMA = `
CREATE TABLE stalls (
  id         INTEGER PRIMARY KEY,
  stall_name TEXT    NOT NULL,
  building   TEXT    NOT NULL,
  is_halal   INTEGER NOT NULL
);

CREATE TABLE dishes (
  id            INTEGER PRIMARY KEY,
  stall_id      INTEGER NOT NULL REFERENCES stalls(id),
  name          TEXT    NOT NULL,
  price         INTEGER NOT NULL,
  meal_slot     TEXT    NOT NULL,
  is_vegetarian INTEGER NOT NULL
);

CREATE TABLE nutrition (
  dish_id   INTEGER PRIMARY KEY REFERENCES dishes(id),
  kcal      INTEGER NOT NULL,
  protein_g REAL    NOT NULL,
  carbs_g   REAL    NOT NULL,
  fat_g     REAL    NOT NULL,
  sugar_g   REAL    NOT NULL
);

CREATE TABLE users (
  id           INTEGER PRIMARY KEY,
  name         TEXT    NOT NULL,
  daily_budget INTEGER NOT NULL,
  kcal_target  INTEGER NOT NULL
);

CREATE TABLE meal_logs (
  id       INTEGER PRIMARY KEY,
  user_id  INTEGER NOT NULL REFERENCES users(id),
  dish_id  INTEGER NOT NULL REFERENCES dishes(id),
  eaten_at TEXT    NOT NULL
);
`;

// [stall_name, building, is_halal]
export const STALLS: [string, string, 0 | 1][] = [
  ['Bento Corner', 'B', 0],
  ['Noodle House', 'A', 0],
  ['Veggie Bar', 'B', 0],
  ['Halal Kitchen', 'B', 1],
  ['Morning Toast', 'A', 0],
  ['Snack Kiosk', 'C', 0],
  ['Sunny Grill', 'C', 0],
];

export type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// [stall_id, name, price NT$, meal_slot, vegetarian, kcal, protein, carbs, fat, sugar]
type Dish = [number, string, number, Slot, 0 | 1, number, number, number, number, number];

export const DISHES: Dish[] = [
  [1, 'Chicken Breast Bento', 95, 'lunch', 0, 620, 38, 70, 18, 6],
  [2, 'Beef Noodle Soup', 130, 'lunch', 0, 640, 32, 75, 20, 5],
  [3, 'Tofu Veggie Bowl', 75, 'lunch', 1, 480, 18, 62, 16, 8],
  [1, 'Grilled Fish Rice', 105, 'dinner', 0, 590, 34, 68, 16, 4],
  [1, 'Pork Chop Rice', 90, 'dinner', 0, 710, 27, 80, 28, 6],
  [2, 'Egg Fried Rice', 70, 'dinner', 1, 560, 14, 78, 18, 3],
  [4, 'Chicken Curry Rice', 85, 'dinner', 0, 680, 29, 82, 22, 7],
  [4, 'Spicy Chicken Rice', 80, 'lunch', 0, 650, 31, 76, 20, 5],
  [5, 'Egg and Cheese Toast', 55, 'breakfast', 1, 420, 21, 38, 20, 5],
  [5, 'Peanut Butter Toast', 40, 'breakfast', 1, 380, 12, 40, 18, 9],
  [5, 'Ham and Egg Sandwich', 60, 'breakfast', 0, 450, 24, 40, 20, 4],
  [5, 'Soy Milk', 25, 'breakfast', 1, 130, 7, 15, 4, 9],
  [5, 'Chicken Burger', 65, 'breakfast', 0, 510, 26, 48, 22, 7],
  [2, 'Wonton Noodles', 85, 'lunch', 0, 520, 24, 70, 14, 3],
  [2, 'Veggie Dumplings', 60, 'lunch', 1, 400, 13, 58, 12, 3],
  [3, 'Lentil Curry', 70, 'dinner', 1, 450, 22, 64, 10, 6],
  [3, 'Garden Salad Bowl', 65, 'lunch', 1, 260, 9, 30, 12, 7],
  [3, 'Mapo Tofu Rice', 75, 'dinner', 1, 540, 21, 70, 18, 4],
  [4, 'Beef Kebab Plate', 110, 'dinner', 0, 760, 42, 66, 30, 5],
  [4, 'Falafel Wrap', 70, 'lunch', 1, 520, 17, 62, 22, 6],
  [4, 'Lamb Biryani', 120, 'dinner', 0, 780, 36, 90, 28, 4],
  [1, 'Salmon Bento', 125, 'lunch', 0, 640, 36, 66, 22, 4],
  [7, 'Grilled Chicken Salad', 90, 'lunch', 0, 380, 34, 18, 18, 6],
  [7, 'Steak Rice Bowl', 140, 'dinner', 0, 820, 44, 80, 34, 5],
  [7, 'Cheeseburger', 95, 'lunch', 0, 690, 30, 52, 38, 9],
  [6, 'Fruit Cup', 35, 'snack', 1, 110, 1, 28, 0, 22],
  [6, 'Bubble Milk Tea', 55, 'snack', 1, 350, 3, 62, 9, 45],
  [6, 'Protein Bar', 45, 'snack', 1, 210, 20, 22, 7, 8],
  [6, 'Tea Egg', 15, 'snack', 1, 75, 6, 1, 5, 0.5],
  [7, 'Corn Soup', 40, 'dinner', 1, 180, 5, 30, 5, 8],
];

// [name, daily_budget NT$, kcal_target]
export const USERS: [string, number, number][] = [
  ['Ava Lin', 250, 2000],
  ['Ben Okafor', 300, 2600],
  ['Chloe Wang', 200, 1800],
  ['Daniel Kim', 280, 2400],
  ['Ella Rossi', 220, 1900],
  ['Farah Hassan', 260, 2100],
  ['Grace Chen', 240, 2000],
  ['Hugo Silva', 320, 2700],
  ['Isla Murphy', 210, 1800],
  ['Jamal Haddad', 270, 2300],
  ['Kira Tanaka', 230, 1900],
  ['Leo Fischer', 300, 2500],
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MealLog {
  id: number;
  user_id: number;
  dish_id: number;
  eaten_at: string;
}

const SLOT_TIMES: Record<Slot, string[]> = {
  breakfast: ['07:40', '08:05', '08:30'],
  lunch: ['12:10', '12:25', '12:45'],
  dinner: ['18:15', '18:40', '19:05'],
  snack: ['15:30', '16:00', '21:10'],
};

/** One week of meals (2–9 Nov 2026) for every user. */
export function generateMealLogs(): MealLog[] {
  const rand = mulberry32(20261102);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const bySlot = (slot: Slot) => DISHES.map((d, i) => ({ id: i + 1, d })).filter((x) => x.d[3] === slot);
  const halal = new Set(STALLS.map((s, i) => (s[2] ? i + 1 : 0)).filter(Boolean));
  const logs: MealLog[] = [];
  const days = [2, 3, 4, 5, 6, 7, 8].map((d) => `2026-11-${String(d).padStart(2, '0')}`);

  USERS.forEach((_, u) => {
    const userId = u + 1;
    const appetite = 0.45 + rand() * 0.5; // how often this user eats at the canteen
    const onlyHalal = userId === 6; // Farah only eats at the halal stall
    for (const day of days) {
      for (const slot of ['breakfast', 'lunch', 'dinner', 'snack'] as Slot[]) {
        const chance = slot === 'lunch' ? appetite + 0.3 : slot === 'snack' ? appetite - 0.25 : appetite;
        if (rand() > chance) continue;
        let options = bySlot(slot);
        if (onlyHalal && slot !== 'snack') {
          const h = options.filter((o) => halal.has(o.d[0]));
          if (h.length) options = h;
        }
        logs.push({ id: logs.length + 1, user_id: userId, dish_id: pick(options).id, eaten_at: `${day} ${pick(SLOT_TIMES[slot])}` });
      }
    }
  });
  return logs;
}
