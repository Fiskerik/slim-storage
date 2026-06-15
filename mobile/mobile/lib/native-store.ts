import * as FileSystem from "expo-file-system/legacy";

export type NativeTargetMode =
  | "balanced"
  | "big-or-old"
  | "old-and-large"
  | "big-only"
  | "old-only"
  | "similar"
  | "screenshots"
  | "icloud"
  | "mistakes";

export type NativeSessionMode = "classic" | "endless" | "time-attack";

export type NativeActionType = "keep" | "trim" | "delete";

export type NativeSettings = {
  cardsPerRound: number;
  targetMode: NativeTargetMode;
  sessionMode: NativeSessionMode;
  minSizeMB: number;
  minAgeYears: number;
  trimQuality: number;
  largeText: boolean;
  highContrast: boolean;
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

export type NativeSeenPhoto = {
  photoId: string;
  lastSeenAt: string;
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
  onboardingComplete: boolean;
  shareCount: number;
  dailyActivity: Record<string, NativeDailyStats>;
  dailyRewardClaims: Record<string, number>;
  actionLog: NativeActionLogEntry[];
  recentSeenPhotos: NativeSeenPhoto[];
  settings: NativeSettings;
};

export type NativeActionLogEntry = {
  id: string;
  photoId: string;
  title: string;
  action: NativeActionType;
  mbFreed: number;
  createdAt: string;
};

const STATS_FILE = "trimswipe-native-stats-v1.json";

export const DEFAULT_NATIVE_SETTINGS: NativeSettings = {
  cardsPerRound: 10,
  targetMode: "big-or-old",
  sessionMode: "classic",
  minSizeMB: 8,
  minAgeYears: 4,
  trimQuality: 0.9,
  largeText: false,
  highContrast: false,
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
  onboardingComplete: false,
  shareCount: 0,
  dailyActivity: {},
  dailyRewardClaims: {},
  actionLog: [],
  recentSeenPhotos: [],
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

function normalizeRewardClaims(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date))
      .map(([date, amount]): [string, number] => [date, Math.max(0, safeNumber(amount))])
      .filter(([, amount]) => amount > 0),
  );
}

function normalizeTargetMode(value: unknown): NativeTargetMode {
  const modes: NativeTargetMode[] = [
    "balanced",
    "big-or-old",
    "old-and-large",
    "big-only",
    "old-only",
    "similar",
    "screenshots",
    "icloud",
    "mistakes",
  ];
  return modes.includes(value as NativeTargetMode) ? (value as NativeTargetMode) : "big-or-old";
}

function normalizeSessionMode(value: unknown): NativeSessionMode {
  const modes: NativeSessionMode[] = ["classic", "endless", "time-attack"];
  return modes.includes(value as NativeSessionMode) ? (value as NativeSessionMode) : "classic";
}

function normalizeActionLog(value: unknown): NativeActionLogEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Partial<NativeActionLogEntry> => item !== null && typeof item === "object")
    .map((item) => ({
      id: String(item.id ?? `${Date.now()}-${Math.random()}`),
      photoId: String(item.photoId ?? ""),
      title: String(item.title ?? "Photo"),
      action: item.action === "trim" || item.action === "delete" || item.action === "keep" ? item.action : "keep",
      mbFreed: Math.max(0, safeNumber(item.mbFreed)),
      createdAt: String(item.createdAt ?? new Date().toISOString()),
    }))
    .filter((item) => item.photoId.length > 0)
    .slice(0, 60);
}

function normalizeSeenPhotos(value: unknown): NativeSeenPhoto[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Partial<NativeSeenPhoto> => item !== null && typeof item === "object")
    .map((item) => ({
      photoId: String(item.photoId ?? ""),
      lastSeenAt: String(item.lastSeenAt ?? new Date().toISOString()),
    }))
    .filter((item) => item.photoId.length > 0 && !Number.isNaN(Date.parse(item.lastSeenAt)))
    .slice(0, 500);
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
    onboardingComplete: raw.onboardingComplete === undefined ? safeNumber(raw.reviewed) > 0 : Boolean(raw.onboardingComplete),
    shareCount: Math.max(0, safeNumber(raw.shareCount)),
    dailyActivity: normalizeDailyActivity(raw.dailyActivity),
    dailyRewardClaims: normalizeRewardClaims(raw.dailyRewardClaims),
    actionLog: normalizeActionLog(raw.actionLog),
    recentSeenPhotos: normalizeSeenPhotos(raw.recentSeenPhotos),
    settings: {
      ...DEFAULT_NATIVE_SETTINGS,
      ...rawSettings,
      targetMode: normalizeTargetMode(rawSettings.targetMode),
      sessionMode: normalizeSessionMode(rawSettings.sessionMode),
      cardsPerRound: Math.min(30, Math.max(5, safeNumber(rawSettings.cardsPerRound, 10))),
      minSizeMB: Math.min(50, Math.max(1, safeNumber(rawSettings.minSizeMB, 8))),
      minAgeYears: Math.min(30, Math.max(1, safeNumber(rawSettings.minAgeYears, 4))),
      trimQuality: Math.min(0.98, Math.max(0.65, safeNumber(rawSettings.trimQuality, 0.9))),
      largeText: Boolean(rawSettings.largeText),
      highContrast: Boolean(rawSettings.highContrast),
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
