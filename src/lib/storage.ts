// Persistent stats stored in localStorage. Reactive via simple subscription.

export type DayLog = {
  date: string;          // YYYY-MM-DD
  kept: number;
  trimmed: number;
  deleted: number;
  mbFreed: number;
  memoryPlayed: number;  // memory rounds completed that day
};

export type Settings = {
  cardsPerRound: number;       // 5–30
  iCloudSync: boolean;
  reminderEnabled: boolean;
  reminderTime: string;        // "HH:MM" 24h
  iCloudBackupWarn: boolean;
  onboarded: boolean;
  displayName: string;
};

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
  // Pro / daily limit
  isPro: boolean;
  trimsToday: number;
  trimsTodayDate: string | null;
  // Per-day history (last ~30 days)
  daily: DayLog[];
  // Settings + onboarding
  settings: Settings;
  // Soft-deleted items pending permanent removal (for Undo)
  pendingDelete: { id: string; title: string; sizeMB: number; deletedAt: number }[];
};

const KEY = "slim.stats.v1";
export const FREE_TRIM_LIMIT = 10;

const DEFAULT_SETTINGS: Settings = {
  cardsPerRound: 10,
  iCloudSync: false,
  reminderEnabled: true,
  reminderTime: "19:00",
  iCloudBackupWarn: true,
  onboarded: false,
  displayName: "You",
};

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
  isPro: false,
  trimsToday: 0,
  trimsTodayDate: null,
  daily: [],
  settings: DEFAULT_SETTINGS,
  pendingDelete: [],
};

const listeners = new Set<() => void>();
let cache: Stats | null = null;

function readFromStorage(): Stats {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT,
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      pendingDelete: parsed.pendingDelete ?? [],
    };
  } catch {
    return DEFAULT;
  }
}

export function updateSettings(patch: Partial<Settings>) {
  setStats((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function softDelete(item: { id: string; title: string; sizeMB: number }) {
  setStats((s) => ({
    ...s,
    pendingDelete: [...s.pendingDelete, { ...item, deletedAt: Date.now() }],
  }));
}

export function undoDelete(id: string) {
  setStats((s) => ({
    ...s,
    pendingDelete: s.pendingDelete.filter((p) => p.id !== id),
  }));
}

export function purgeExpiredDeletes(maxAgeMs = 30_000) {
  const now = Date.now();
  setStats((s) => ({
    ...s,
    pendingDelete: s.pendingDelete.filter((p) => now - p.deletedAt < maxAgeMs),
  }));
}

export function deleteAllData() {
  if (typeof window === "undefined") return;
  cache = DEFAULT;
  window.localStorage.removeItem(KEY);
  notify();
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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function upsertToday(s: Stats, patch: Partial<Omit<DayLog, "date">>): DayLog[] {
  const date = todayStr();
  const existing = s.daily.find((d) => d.date === date);
  const merged: DayLog = existing
    ? {
        ...existing,
        kept: existing.kept + (patch.kept ?? 0),
        trimmed: existing.trimmed + (patch.trimmed ?? 0),
        deleted: existing.deleted + (patch.deleted ?? 0),
        mbFreed: +(existing.mbFreed + (patch.mbFreed ?? 0)).toFixed(2),
        memoryPlayed: existing.memoryPlayed + (patch.memoryPlayed ?? 0),
      }
    : {
        date,
        kept: patch.kept ?? 0,
        trimmed: patch.trimmed ?? 0,
        deleted: patch.deleted ?? 0,
        mbFreed: +(patch.mbFreed ?? 0).toFixed(2),
        memoryPlayed: patch.memoryPlayed ?? 0,
      };
  const others = s.daily.filter((d) => d.date !== date);
  // keep last 30 days
  const next = [...others, merged].sort((a, b) => (a.date < b.date ? -1 : 1));
  return next.slice(-30);
}

export function logDay(patch: Partial<Omit<DayLog, "date">>) {
  setStats((s) => ({ ...s, daily: upsertToday(s, patch) }));
}

/**
 * Returns true if the user can perform another trim today.
 * Free users get FREE_TRIM_LIMIT trims per day.
 */
export function canTrim(): boolean {
  const s = getStats();
  if (s.isPro) return true;
  const today = todayStr();
  if (s.trimsTodayDate !== today) return true; // counter resets
  return s.trimsToday < FREE_TRIM_LIMIT;
}

export function recordTrim() {
  const today = todayStr();
  setStats((s) => {
    if (s.trimsTodayDate !== today) {
      return { ...s, trimsToday: 1, trimsTodayDate: today };
    }
    return { ...s, trimsToday: s.trimsToday + 1 };
  });
}

export function trimsRemainingToday(): number {
  const s = getStats();
  if (s.isPro) return Infinity;
  const today = todayStr();
  if (s.trimsTodayDate !== today) return FREE_TRIM_LIMIT;
  return Math.max(0, FREE_TRIM_LIMIT - s.trimsToday);
}

export function setPro(isPro: boolean) {
  setStats((s) => ({ ...s, isPro }));
}
