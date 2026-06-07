import * as FileSystem from "expo-file-system/legacy";

export type NativeTargetMode = "balanced" | "big-or-old" | "old-and-large";

export type NativeSettings = {
  cardsPerRound: number;
  targetMode: NativeTargetMode;
  minSizeMB: number;
  minAgeYears: number;
  trimQuality: number;
};

export type NativeStats = {
  reviewed: number;
  kept: number;
  trimmed: number;
  deleted: number;
  mbFreed: number;
  sessions: number;
  startedAt: string;
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

export const DEFAULT_NATIVE_STATS: NativeStats = {
  reviewed: 0,
  kept: 0,
  trimmed: 0,
  deleted: 0,
  mbFreed: 0,
  sessions: 0,
  startedAt: new Date().toISOString().slice(0, 10),
  settings: DEFAULT_NATIVE_SETTINGS,
};

function statsUri(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${STATS_FILE}` : null;
}

function normalizeStats(value: unknown): NativeStats {
  const raw = value && typeof value === "object" ? (value as Partial<NativeStats>) : {};
  const rawSettings =
    raw.settings && typeof raw.settings === "object" ? raw.settings : DEFAULT_NATIVE_SETTINGS;

  return {
    reviewed: Number(raw.reviewed ?? 0),
    kept: Number(raw.kept ?? 0),
    trimmed: Number(raw.trimmed ?? 0),
    deleted: Number(raw.deleted ?? 0),
    mbFreed: Number(raw.mbFreed ?? 0),
    sessions: Number(raw.sessions ?? 0),
    startedAt: String(raw.startedAt ?? DEFAULT_NATIVE_STATS.startedAt),
    settings: {
      ...DEFAULT_NATIVE_SETTINGS,
      ...rawSettings,
      cardsPerRound: Math.min(30, Math.max(5, Number(rawSettings.cardsPerRound ?? 10))),
      minSizeMB: Math.min(50, Math.max(1, Number(rawSettings.minSizeMB ?? 8))),
      minAgeYears: Math.min(30, Math.max(1, Number(rawSettings.minAgeYears ?? 4))),
      trimQuality: Math.min(0.98, Math.max(0.65, Number(rawSettings.trimQuality ?? 0.9))),
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
