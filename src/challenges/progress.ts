const KEY = 'canteenql:solved';

export function loadProgress(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveProgress(done: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...done]));
  } catch {
    // Storage unavailable (private mode etc.): progress just won't persist.
  }
}
