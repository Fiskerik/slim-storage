// Persistent stats stored in localStorage. Reactive via simple subscription.

export type Stats = {
  cleaned: number;       // photos kept (reviewed without delete)
  deleted: number;       // photos deleted
  slimmed: number;       // photos trimmed
  mbFreed: number;       // total MB freed (delete + slim ~30%)
  streak: number;
  lastSessionDate: string | null;
  // Memory game
  memoryPlayed: number;
  memoryCorrect: number;     // within ±1 year
  memoryBestStreak: number;
  memoryCurrentStreak: number;
  memoryTotalDelta: number;  // sum of |guess - actual|
};

const KEY = "slim.stats.v1";

const DEFAULT: Stats = {
  cleaned: 0,
  deleted: 0,
  slimmed: 0,
  mbFreed: 0,
  streak: 0,
  lastSessionDate: null,
  memoryPlayed: 0,
  memoryCorrect: 0,
  memoryBestStreak: 0,
  memoryCurrentStreak: 0,
  memoryTotalDelta: 0,
};

const listeners = new Set<() => void>();
let cache: Stats | null = null;

function readFromStorage(): Stats {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

export function getStats(): Stats {
  if (typeof window === "undefined") return DEFAULT;
  if (cache === null) cache = readFromStorage();
  return cache;
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function setStats(updater: (s: Stats) => Stats) {
  if (typeof window === "undefined") return;
  const next = updater(getStats());
  cache = next;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  notify();
}

export function subscribeStats(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function resetStats() {
  if (typeof window === "undefined") return;
  cache = DEFAULT;
  window.localStorage.removeItem(KEY);
  notify();
}

export function bumpStreak() {
  const today = new Date().toISOString().slice(0, 10);
  setStats((s) => {
    if (s.lastSessionDate === today) return s;
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const continues = s.lastSessionDate === yesterday;
    return {
      ...s,
      streak: continues ? s.streak + 1 : 1,
      lastSessionDate: today,
    };
  });
}
