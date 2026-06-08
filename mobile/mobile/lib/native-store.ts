import * as FileSystem from "expo-file-system/legacy";

export type NativeTargetMode = "balanced" | "big-or-old" | "old-and-large";

export type NativeSettings = {
  cardsPerRound: number;
  targetMode: NativeTargetMode;
  minSizeMB: number;
  minAgeYears: number;
  trimQuality: number;
};

export type NativeDailyStats = {
  reviewed: number;
  kept: number;
  trimmed: number;
  deleted: number;
  mbFreed: number;
  trimMbFreed: number;
  deleteMbFreed: number;
  sessions: number;
};

export type NativeStats = {
  reviewed: number;
  kept: number;
  trimmed: number;
  deleted: number;
  mbFreed: number;
  trimMbFreed: number;
  deleteMbFreed: number;
  sessions: number;
  startedAt: string;
  dailyActivity: Record<string, NativeDailyStats>;
  settings: NativeSettings;
};

const STATS_FILE = "trimswipe-native-stats-v1.json";

export const DEFAULT_NATIVE_SETTINGS: NativeSettings = {
  cardsPerRound: 10,
  targetMode: "big-or-old",
  minSizeMB: 8,
  minAgeYears: 4,
  trimQuality: 0.9,
};

export const EMPTY_DAILY_STATS: NativeDailyStats = {
  reviewed: 0,
  kept: 0,
  trimmed: 0,
  deleted: 0,
  mbFreed: 0,
  trimMbFreed: 0,
  deleteMbFreed: 0,
  sessions: 0,
};

export const DEFAULT_NATIVE_STATS: NativeStats = {
  reviewed: 0,
  kept: 0,
  trimmed: 0,
  deleted: 0,
  mbFreed: 0,
  trimMbFreed: 0,
  deleteMbFreed: 0,
  sessions: 0,
  startedAt: new Date().toISOString().slice(0, 10),
  dailyActivity: {},
  settings: DEFAULT_NATIVE_SETTINGS,
};

function statsUri(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${STATS_FILE}` : null;
}

function safeNumber(value: unknown, fallback = 0): number {
  const next = Number(value ?? fallback);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeDailyStats(value: unknown): NativeDailyStats {
  const raw = value && typeof value === "object" ? (value as Partial<NativeDailyStats>) : {};
  return {
    reviewed: Math.max(0, safeNumber(raw.reviewed)),
    kept: Math.max(0, safeNumber(raw.kept)),
    trimmed: Math.max(0, safeNumber(raw.trimmed)),
    deleted: Math.max(0, safeNumber(raw.deleted)),
    mbFreed: Math.max(0, safeNumber(raw.mbFreed)),
    trimMbFreed: Math.max(0, safeNumber(raw.trimMbFreed)),
    deleteMbFreed: Math.max(0, safeNumber(raw.deleteMbFreed)),
    sessions: Math.max(0, safeNumber(raw.sessions)),
  };
}

function normalizeDailyActivity(value: unknown): Record<string, NativeDailyStats> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date))
      .map(([date, stats]) => [date, normalizeDailyStats(stats)]),
  );
}

function normalizeStats(value: unknown): NativeStats {
  const raw = value && typeof value === "object" ? (value as Partial<NativeStats>) : {};
  const rawSettings =
    raw.settings && typeof raw.settings === "object" ? raw.settings : DEFAULT_NATIVE_SETTINGS;
  const mbFreed = Math.max(0, safeNumber(raw.mbFreed));
  const inferredTrimFreed =
    raw.trimMbFreed === undefined && safeNumber(raw.trimmed) > 0 ? mbFreed * 0.35 : safeNumber(raw.trimMbFreed);
  const trimMbFreed = Math.max(0, inferredTrimFreed);
  const deleteMbFreed = Math.max(0, safeNumber(raw.deleteMbFreed, mbFreed - trimMbFreed));

  return {
    reviewed: Math.max(0, safeNumber(raw.reviewed)),
    kept: Math.max(0, safeNumber(raw.kept)),
    trimmed: Math.max(0, safeNumber(raw.trimmed)),
    deleted: Math.max(0, safeNumber(raw.deleted)),
    mbFreed,
    trimMbFreed,
    deleteMbFreed,
    sessions: Math.max(0, safeNumber(raw.sessions)),
    startedAt: String(raw.startedAt ?? DEFAULT_NATIVE_STATS.startedAt),
    dailyActivity: normalizeDailyActivity(raw.dailyActivity),
    settings: {
      ...DEFAULT_NATIVE_SETTINGS,
      ...rawSettings,
      cardsPerRound: Math.min(30, Math.max(5, safeNumber(rawSettings.cardsPerRound, 10))),
      minSizeMB: Math.min(50, Math.max(1, safeNumber(rawSettings.minSizeMB, 8))),
      minAgeYears: Math.min(30, Math.max(1, safeNumber(rawSettings.minAgeYears, 4))),
      trimQuality: Math.min(0.98, Math.max(0.65, safeNumber(rawSettings.trimQuality, 0.9))),
    },
  };
}

export async function loadNativeStats(): Promise<NativeStats> {
  const uri = statsUri();
  if (!uri) return DEFAULT_NATIVE_STATS;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return DEFAULT_NATIVE_STATS;

    const raw = await FileSystem.readAsStringAsync(uri);
    return normalizeStats(JSON.parse(raw));
  } catch (error) {
    console.log("[NativeStore] Could not load stats", { error });
    return DEFAULT_NATIVE_STATS;
  }
}

export async function saveNativeStats(stats: NativeStats): Promise<void> {
  const uri = statsUri();
  if (!uri) return;

  try {
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(normalizeStats(stats)));
  } catch (error) {
    console.log("[NativeStore] Could not save stats", { error });
  }
}
