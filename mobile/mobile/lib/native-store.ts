import * as FileSystem from "expo-file-system/legacy";
import type { NativeThemeId } from "../constants/themes";

export type NativeTargetMode =
  | "big-only"
  | "old-only"
  | "duplicates"
  | "blurry"
  | "multibursts"
  | "screenshots"
  | "live-photos"
  | "balanced"
  | "big-or-old"
  | "old-and-large"
  | "similar"
  | "bursts"
  | "icloud"
  | "mistakes";

export type NativeSessionMode = "classic" | "endless" | "time-attack";

export type NativeActionType = "keep" | "trim" | "delete";

export type NativeTrimOutputMode = "replace" | "save-new";

export type NativeTrimKind = "metadata" | "location" | "compression" | "resize" | "format";

export type NativeTrimReviewMode = "normal" | "trimmed-only" | "all";

export type SmartReminderCategory = "streak" | "storage" | "newPhotos" | "cleanup" | "weekly";
export type AppLanguage = "en" | "zh-Hans" | "es" | "hi" | "ar" | "pt-BR" | "fr" | "de" | "ja" | "ko" | "ru" | "id" | "tr" | "it" | "vi" | "zh-Hant" | "cs" | "nl" | "fi" | "ms" | "no" | "pl" | "sv" | "th" | "uk" | "da" | "ta";

export type SmartReminderPreferences = {
  enabled: boolean;
  streak: boolean;
  storage: boolean;
  newPhotos: boolean;
  cleanup: boolean;
  weekly: boolean;
};

export type NativeEngagementSnapshot = {
  capturedAt: string;
  photoCount: number;
  totalSizeMB: number;
  freeSpaceMB: number | null;
  deviceCapacityMB: number | null;
  screenshotsCount: number;
  screenshotsMB: number;
  similarCount: number;
  similarMB: number;
  trimSavingsMB: number;
  deleteSavingsMB: number;
};

export type NativeBackgroundScanSchedule = {
  id: string;
  label: string;
  active: boolean;
  days: number[];
  times: string[];
  targetMB: number;
  lastRunAt: string | null;
  lastSuggestionAt: string | null;
};

export type NativeSettings = {
  appLanguage: AppLanguage;
  theme: NativeThemeId;
  cardsPerRound: number;
  targetMode: NativeTargetMode;
  sessionMode: NativeSessionMode;
  minSizeMB: number;
  minAgeYears: number;
  trimQuality: number;
  trimOutputMode: NativeTrimOutputMode;
  trimKinds: NativeTrimKind[];
  trimReviewMode: NativeTrimReviewMode;
  includePreviouslyReviewed: boolean;
  dailyGoalMB: number;
  largeText: boolean;
  highContrast: boolean;
  backgroundScanSchedules: NativeBackgroundScanSchedule[];
  smartReminders: SmartReminderPreferences;
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
  onboardingVersion: string | null;
  shareCount: number;
  /** Last time the user actively opened or used TrimSwipe. Only an ISO date is
   * synced for the gentle inactivity reminder; no photo data is involved. */
  lastActiveAt: string;
  dailyActivity: Record<string, NativeDailyStats>;
  dailyRewardClaims: Record<string, number>;
  actionLog: NativeActionLogEntry[];
  recentSeenPhotos: NativeSeenPhoto[];
  settings: NativeSettings;
  engagementSnapshot: NativeEngagementSnapshot | null;
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

export const MAX_PHOTO_SIZE_THRESHOLD_MB = 500;
export const MAX_PHOTO_AGE_THRESHOLD_YEARS = 100;

const DEFAULT_BACKGROUND_SCAN_SCHEDULES: NativeBackgroundScanSchedule[] = [
  {
    id: "daily-cleanup-check",
    label: "Daily cleanup check",
    active: false,
    days: [1, 2, 3, 4, 5],
    times: ["09:00"],
    targetMB: 50,
    lastRunAt: null,
    lastSuggestionAt: null,
  },
];

export const DEFAULT_NATIVE_SETTINGS: NativeSettings = {
  appLanguage: "en",
  theme: "soft",
  cardsPerRound: 10,
  targetMode: "old-and-large",
  sessionMode: "classic",
  minSizeMB: 5,
  minAgeYears: 1,
  trimQuality: 0.9,
  trimOutputMode: "replace",
  trimKinds: ["metadata", "location", "compression"],
  trimReviewMode: "normal",
  includePreviouslyReviewed: false,
  dailyGoalMB: 50,
  largeText: false,
  highContrast: false,
  backgroundScanSchedules: DEFAULT_BACKGROUND_SCAN_SCHEDULES,
  smartReminders: { enabled: false, streak: true, storage: true, newPhotos: true, cleanup: true, weekly: true },
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
  onboardingVersion: null,
  shareCount: 0,
  lastActiveAt: new Date().toISOString(),
  dailyActivity: {},
  dailyRewardClaims: {},
  actionLog: [],
  recentSeenPhotos: [],
  settings: DEFAULT_NATIVE_SETTINGS,
  engagementSnapshot: null,
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
    "big-only",
    "old-only",
    "duplicates",
    "blurry",
    "multibursts",
    "screenshots",
    "live-photos",
    "balanced",
    "big-or-old",
    "old-and-large",
    "similar",
    "bursts",
    "icloud",
    "mistakes",
  ];
  if (value === "bursts") return "multibursts";
  if (value === "mistakes") return "blurry";
  return modes.includes(value as NativeTargetMode) ? (value as NativeTargetMode) : "big-only";
}

function normalizeTrimOutputMode(value: unknown): NativeTrimOutputMode {
  return value === "save-new" ? "save-new" : "replace";
}

function normalizeTrimKinds(value: unknown): NativeTrimKind[] {
  const allowed: NativeTrimKind[] = ["metadata", "location", "compression", "resize", "format"];
  if (!Array.isArray(value)) return DEFAULT_NATIVE_SETTINGS.trimKinds;
  const kinds = value.filter((item): item is NativeTrimKind => allowed.includes(item as NativeTrimKind));
  return kinds.length > 0 ? [...new Set(kinds)] : DEFAULT_NATIVE_SETTINGS.trimKinds;
}

function normalizeTrimReviewMode(value: unknown): NativeTrimReviewMode {
  if (value === "trimmed-only") return "trimmed-only";
  if (value === "all") return "all";
  return "normal";
}

function normalizeScheduleTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}

function normalizeBackgroundScanSchedules(value: unknown): NativeBackgroundScanSchedule[] {
  const source = Array.isArray(value) && value.length > 0 ? value : DEFAULT_BACKGROUND_SCAN_SCHEDULES;
  const schedules = source
    .filter((item): item is Partial<NativeBackgroundScanSchedule> => item !== null && typeof item === "object")
    .map((item, index) => {
      const days = Array.isArray(item.days)
        ? [...new Set(item.days.map((day) => Math.round(safeNumber(day, -1))).filter((day) => day >= 0 && day <= 6))]
        : DEFAULT_BACKGROUND_SCAN_SCHEDULES[0].days;
      const times = Array.isArray(item.times)
        ? [...new Set(item.times.map(normalizeScheduleTime).filter((time): time is string => time !== null))].slice(0, 5)
        : DEFAULT_BACKGROUND_SCAN_SCHEDULES[0].times;
      const lastRunAt = typeof item.lastRunAt === "string" && !Number.isNaN(Date.parse(item.lastRunAt)) ? item.lastRunAt : null;
      const lastSuggestionAt =
        typeof item.lastSuggestionAt === "string" && !Number.isNaN(Date.parse(item.lastSuggestionAt))
          ? item.lastSuggestionAt
          : null;

      return {
        id: String(item.id ?? `cleanup-check-${index + 1}`),
        label: String(item.label ?? (index === 0 ? "Daily cleanup check" : `Cleanup check ${index + 1}`)).slice(0, 36),
        active: Boolean(item.active),
        days: days.length > 0 ? days : DEFAULT_BACKGROUND_SCAN_SCHEDULES[0].days,
        times: times.length > 0 ? times : DEFAULT_BACKGROUND_SCAN_SCHEDULES[0].times,
        targetMB: Math.min(1000, Math.max(10, Math.round(safeNumber(item.targetMB, 50) / 5) * 5)),
        lastRunAt,
        lastSuggestionAt,
      };
    })
    .slice(0, 8);

  return schedules.length > 0 ? schedules : DEFAULT_BACKGROUND_SCAN_SCHEDULES;
}

function normalizeSessionMode(value: unknown): NativeSessionMode {
  const modes: NativeSessionMode[] = ["classic", "endless", "time-attack"];
  return modes.includes(value as NativeSessionMode) ? (value as NativeSessionMode) : "classic";
}

function normalizeTheme(value: unknown): NativeThemeId {
  return value === "pink" || value === "orange" || value === "dark" || value === "green" ? value : "soft";
}

const APP_LANGUAGE_IDS: AppLanguage[] = ["en", "zh-Hans", "es", "hi", "ar", "pt-BR", "fr", "de", "ja", "ko", "ru", "id", "tr", "it", "vi", "zh-Hant", "cs", "nl", "fi", "ms", "no", "pl", "sv", "th", "uk", "da", "ta"];
function normalizeAppLanguage(value: unknown): AppLanguage {
  return typeof value === "string" && APP_LANGUAGE_IDS.includes(value as AppLanguage) ? value as AppLanguage : "en";
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
  const rawSnapshot = raw.engagementSnapshot && typeof raw.engagementSnapshot === "object" ? raw.engagementSnapshot as Partial<NativeEngagementSnapshot> : null;
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
    onboardingVersion: typeof raw.onboardingVersion === "string" ? raw.onboardingVersion : null,
    shareCount: Math.max(0, safeNumber(raw.shareCount)),
    lastActiveAt: typeof raw.lastActiveAt === "string" && !Number.isNaN(Date.parse(raw.lastActiveAt))
      ? raw.lastActiveAt
      : new Date().toISOString(),
    dailyActivity: normalizeDailyActivity(raw.dailyActivity),
    dailyRewardClaims: normalizeRewardClaims(raw.dailyRewardClaims),
    actionLog: normalizeActionLog(raw.actionLog),
    recentSeenPhotos: normalizeSeenPhotos(raw.recentSeenPhotos),
    settings: {
      ...DEFAULT_NATIVE_SETTINGS,
      ...rawSettings,
      appLanguage: normalizeAppLanguage(rawSettings.appLanguage),
      theme: normalizeTheme(rawSettings.theme),
      targetMode: normalizeTargetMode(rawSettings.targetMode),
      sessionMode: normalizeSessionMode(rawSettings.sessionMode),
      cardsPerRound: Math.min(30, Math.max(5, safeNumber(rawSettings.cardsPerRound, 10))),
      minSizeMB: Math.min(
        MAX_PHOTO_SIZE_THRESHOLD_MB,
        Math.max(0.5, safeNumber(rawSettings.minSizeMB, 5)),
      ),
      minAgeYears: Math.min(
        MAX_PHOTO_AGE_THRESHOLD_YEARS,
        Math.max(0, safeNumber(rawSettings.minAgeYears, 1)),
      ),
      trimQuality: Math.min(0.98, Math.max(0.5, safeNumber(rawSettings.trimQuality, 0.9))),
      trimOutputMode: normalizeTrimOutputMode(rawSettings.trimOutputMode),
      trimKinds: normalizeTrimKinds(rawSettings.trimKinds),
      trimReviewMode: normalizeTrimReviewMode(rawSettings.trimReviewMode),
      includePreviouslyReviewed: Boolean(rawSettings.includePreviouslyReviewed),
      dailyGoalMB: Math.min(1000, Math.max(5, safeNumber(rawSettings.dailyGoalMB, DEFAULT_NATIVE_SETTINGS.dailyGoalMB))),
      largeText: Boolean(rawSettings.largeText),
      highContrast: Boolean(rawSettings.highContrast),
      backgroundScanSchedules: normalizeBackgroundScanSchedules(rawSettings.backgroundScanSchedules),
      smartReminders: {
        ...DEFAULT_NATIVE_SETTINGS.smartReminders,
        ...(rawSettings.smartReminders && typeof rawSettings.smartReminders === "object" ? rawSettings.smartReminders : {}),
        enabled: Boolean((rawSettings.smartReminders as Partial<SmartReminderPreferences> | undefined)?.enabled),
        streak: (rawSettings.smartReminders as Partial<SmartReminderPreferences> | undefined)?.streak !== false,
        storage: (rawSettings.smartReminders as Partial<SmartReminderPreferences> | undefined)?.storage !== false,
        newPhotos: (rawSettings.smartReminders as Partial<SmartReminderPreferences> | undefined)?.newPhotos !== false,
        cleanup: (rawSettings.smartReminders as Partial<SmartReminderPreferences> | undefined)?.cleanup !== false,
        weekly: (rawSettings.smartReminders as Partial<SmartReminderPreferences> | undefined)?.weekly !== false,
      },
    },
    engagementSnapshot: rawSnapshot && typeof rawSnapshot.capturedAt === "string" ? {
      capturedAt: rawSnapshot.capturedAt,
      photoCount: Math.max(0, safeNumber(rawSnapshot.photoCount)),
      totalSizeMB: Math.max(0, safeNumber(rawSnapshot.totalSizeMB)),
      freeSpaceMB: rawSnapshot.freeSpaceMB == null ? null : Math.max(0, safeNumber(rawSnapshot.freeSpaceMB)),
      deviceCapacityMB: rawSnapshot.deviceCapacityMB == null ? null : Math.max(0, safeNumber(rawSnapshot.deviceCapacityMB)),
      screenshotsCount: Math.max(0, safeNumber(rawSnapshot.screenshotsCount)),
      screenshotsMB: Math.max(0, safeNumber(rawSnapshot.screenshotsMB)),
      similarCount: Math.max(0, safeNumber(rawSnapshot.similarCount)),
      similarMB: Math.max(0, safeNumber(rawSnapshot.similarMB)),
      trimSavingsMB: Math.max(0, safeNumber(rawSnapshot.trimSavingsMB)),
      deleteSavingsMB: Math.max(0, safeNumber(rawSnapshot.deleteSavingsMB)),
    } : null,
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
