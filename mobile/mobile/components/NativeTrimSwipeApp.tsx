import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  deletePhotos,
  estimateTrimSavings,
  loadPhotoRound,
  requestPhotoPermission,
  scanPhotoLibrary,
  trimPhoto,
  type NativeLibraryScan,
  type NativeLibraryScanProgress,
  type NativePhoto,
} from "../lib/native-photo-source";
import {
  DEFAULT_NATIVE_STATS,
  EMPTY_DAILY_STATS,
  loadNativeStats,
  saveNativeStats,
  type NativeActionLogEntry,
  type NativeActionType,
  type NativeDailyStats,
  type NativeSeenPhoto,
  type NativeSessionMode,
  type NativeSettings,
  type NativeStats,
} from "../lib/native-store";

type Screen = "games" | "swipe" | "this-or-that" | "storage-budget" | "memory-lane" | "stats" | "settings";
type Action = "keep" | "trim" | "delete";

type SessionRecap = {
  kept: number;
  trimmed: number;
  deleted: number;
  freed: number;
};

type Achievement = {
  title: string;
  detail: string;
  progress: number;
  unlocked: boolean;
};

const SWIPE_THRESHOLD = 110;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_REVIEW_TARGET = 10;
const WEEKLY_SAVINGS_TARGET_MB = 500;
const FOUR_K_VIDEO_MB_PER_MINUTE = 375;
const TIME_ATTACK_SECONDS = 60;
const FREE_DAILY_TRIM_LIMIT = 10;
const SELECTION_GRACE_DAYS = 7;
const SEEN_PHOTO_LIMIT = 500;

function formatMB(value: number): string {
  return value >= 1024 ? `${(value / 1024).toFixed(2)} GB` : `${value.toFixed(1)} MB`;
}

function roundSettings(settings: NativeSettings): NativeSettings {
  return {
    ...settings,
    cardsPerRound: Math.min(30, Math.max(5, settings.cardsPerRound)),
    minSizeMB: Math.min(50, Math.max(1, settings.minSizeMB)),
    minAgeYears: Math.min(30, Math.max(1, settings.minAgeYears)),
    trimQuality: Math.min(0.98, Math.max(0.65, settings.trimQuality)),
  };
}

function targetLabel(settings: NativeSettings): string {
  if (settings.targetMode === "balanced") return "Balanced";
  if (settings.targetMode === "big-only") return `${settings.minSizeMB}+ MB only`;
  if (settings.targetMode === "old-only") return `${settings.minAgeYears}+ year old photos`;
  if (settings.targetMode === "old-and-large") {
    return `${settings.minAgeYears}+ yrs and ${settings.minSizeMB}+ MB`;
  }
  if (settings.targetMode === "similar") return "Similar photos";
  if (settings.targetMode === "screenshots") return "Screenshots";
  if (settings.targetMode === "icloud") return "iCloud-heavy";
  if (settings.targetMode === "mistakes") return "Likely mistakes";
  return `${settings.minSizeMB}+ MB or ${settings.minAgeYears}+ yrs`;
}

function sessionModeLabel(mode: NativeSessionMode): string {
  if (mode === "endless") return "Endless";
  if (mode === "time-attack") return "Time attack";
  return "Classic";
}

function actionVerb(action: NativeActionType): string {
  if (action === "trim") return "Trimmed";
  if (action === "delete") return "Deleted";
  return "Kept";
}

function dateKey(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function clampProgress(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(1, value / target));
}

function percentValue(value: number): `${number}%` {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%` as `${number}%`;
}

function progressWidth(progress: number): `${number}%` {
  return percentValue(clampProgress(progress, 1) * 100);
}

function mergeDailyStats(
  current: NativeDailyStats,
  patch: Partial<NativeDailyStats>,
): NativeDailyStats {
  return {
    reviewed: Math.max(0, current.reviewed + (patch.reviewed ?? 0)),
    kept: Math.max(0, current.kept + (patch.kept ?? 0)),
    trimmed: Math.max(0, current.trimmed + (patch.trimmed ?? 0)),
    deleted: Math.max(0, current.deleted + (patch.deleted ?? 0)),
    mbFreed: Math.max(0, +(current.mbFreed + (patch.mbFreed ?? 0)).toFixed(2)),
    trimMbFreed: Math.max(0, +(current.trimMbFreed + (patch.trimMbFreed ?? 0)).toFixed(2)),
    deleteMbFreed: Math.max(0, +(current.deleteMbFreed + (patch.deleteMbFreed ?? 0)).toFixed(2)),
    sessions: Math.max(0, current.sessions + (patch.sessions ?? 0)),
  };
}

function withDailyActivity(stats: NativeStats, patch: Partial<NativeDailyStats>): NativeStats {
  const today = dateKey();
  const current = stats.dailyActivity[today] ?? EMPTY_DAILY_STATS;
  return {
    ...stats,
    dailyActivity: {
      ...stats.dailyActivity,
      [today]: mergeDailyStats(current, patch),
    },
  };
}

function dailyFor(stats: NativeStats, key: string): NativeDailyStats {
  return stats.dailyActivity[key] ?? EMPTY_DAILY_STATS;
}

function sumDays(stats: NativeStats, days: number): NativeDailyStats {
  const today = new Date();
  return Array.from({ length: days }, (_, index) => dateKey(addDays(today, -index))).reduce(
    (total, key) => mergeDailyStats(total, dailyFor(stats, key)),
    EMPTY_DAILY_STATS,
  );
}

function sumPeriod(stats: NativeStats, predicate: (date: Date) => boolean): NativeDailyStats {
  return Object.entries(stats.dailyActivity).reduce((total, [key, value]) => {
    const date = new Date(`${key}T12:00:00`);
    return predicate(date) ? mergeDailyStats(total, value) : total;
  }, EMPTY_DAILY_STATS);
}

function monthStats(stats: NativeStats): NativeDailyStats {
  const now = new Date();
  return sumPeriod(
    stats,
    (date) => date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(),
  );
}

function yearStats(stats: NativeStats): NativeDailyStats {
  const now = new Date();
  return sumPeriod(stats, (date) => date.getFullYear() === now.getFullYear());
}

function currentStreak(stats: NativeStats): number {
  let streak = 0;
  let cursor = new Date();

  while (dailyFor(stats, dateKey(cursor)).reviewed > 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function trimStreak(stats: NativeStats): number {
  let streak = 0;
  let cursor = new Date();

  while (dailyFor(stats, dateKey(cursor)).trimmed > 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function storageHealthScore(stats: NativeStats, week: NativeDailyStats, streak: number): number {
  const base = 42;
  const reviewScore = Math.min(24, stats.reviewed * 0.8);
  const savingsScore = Math.min(24, stats.mbFreed / 60);
  const momentumScore = Math.min(10, week.reviewed * 0.8 + streak * 2);
  return Math.round(Math.min(100, base + reviewScore + savingsScore + momentumScore));
}

function levelInfo(stats: NativeStats): { level: number; title: string; progress: number; next: string } {
  const points = stats.reviewed + stats.mbFreed / 25 + stats.trimmed * 0.6 + stats.deleted * 0.8;
  const level = Math.max(1, Math.floor(points / 25) + 1);
  const progress = (points % 25) / 25;
  const titles = ["Fresh Start", "Space Saver", "Camera Roll Pro", "Storage Guardian"];
  const title = titles[Math.min(titles.length - 1, Math.floor((level - 1) / 3))];
  return { level, title, progress, next: `${Math.ceil(25 - (points % 25))} pts to level ${level + 1}` };
}

function yearOptions(correctYear: number): number[] {
  const currentYear = new Date().getFullYear();
  const candidates = new Set<number>([correctYear]);
  [-1, 1, -2, 2, -4, 4, -7, 7].forEach((offset) => {
    const year = correctYear + offset;
    if (year >= 2007 && year <= currentYear) candidates.add(year);
  });

  while (candidates.size < 4) {
    candidates.add(Math.max(2007, currentYear - Math.floor(Math.random() * 12)));
  }

  return shuffleSmall([...candidates].slice(0, 4));
}

function shuffleSmall<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createActionLogEntry(photo: NativePhoto, action: Action, mbFreed: number): NativeActionLogEntry {
  return {
    id: `${Date.now()}-${photo.id}`,
    photoId: photo.id,
    title: photo.title,
    action,
    mbFreed,
    createdAt: new Date().toISOString(),
  };
}

function appendActionLog(stats: NativeStats, entry: NativeActionLogEntry): NativeStats {
  return {
    ...stats,
    actionLog: [entry, ...stats.actionLog.filter((item) => item.id !== entry.id)].slice(0, 60),
  };
}

function recentSelectionIds(stats: NativeStats): string[] {
  const cutoff = Date.now() - SELECTION_GRACE_DAYS * DAY_MS;
  const ids = new Set<string>();

  stats.recentSeenPhotos.forEach((item) => {
    const seenAt = Date.parse(item.lastSeenAt);
    if (!Number.isNaN(seenAt) && seenAt >= cutoff) ids.add(item.photoId);
  });

  stats.actionLog.forEach((item) => {
    const actedAt = Date.parse(item.createdAt);
    if (!Number.isNaN(actedAt) && actedAt >= cutoff) ids.add(item.photoId);
  });

  return [...ids];
}

function withRecentlySeenPhotos(stats: NativeStats, photos: NativePhoto[]): NativeStats {
  if (photos.length === 0) return stats;

  const now = new Date().toISOString();
  const cutoff = Date.now() - SELECTION_GRACE_DAYS * DAY_MS;
  const entries = new Map<string, NativeSeenPhoto>();

  stats.recentSeenPhotos.forEach((item) => {
    const seenAt = Date.parse(item.lastSeenAt);
    if (!Number.isNaN(seenAt) && seenAt >= cutoff) entries.set(item.photoId, item);
  });

  photos.forEach((photo) => entries.set(photo.id, { photoId: photo.id, lastSeenAt: now }));

  return {
    ...stats,
    recentSeenPhotos: [...entries.values()]
      .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))
      .slice(0, SEEN_PHOTO_LIMIT),
  };
}

function progressShareText(stats: NativeStats): string {
  const week = sumDays(stats, 7);
  return [
    `I reclaimed ${formatMB(stats.mbFreed)} with TrimSwipe.`,
    `${stats.reviewed} photos reviewed, ${stats.trimmed} trimmed, ${stats.deleted} deleted.`,
    `This week: ${formatMB(week.mbFreed)} saved.`,
  ].join("\n");
}

export function NativeTrimSwipeApp() {
  const [screen, setScreen] = useState<Screen>("games");
  const [stats, setStats] = useState<NativeStats>(DEFAULT_NATIVE_STATS);
  const [queue, setQueue] = useState<NativePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [permissionLimited, setPermissionLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recap, setRecap] = useState<SessionRecap | null>(null);
  const [pendingDeletes, setPendingDeletes] = useState<NativePhoto[]>([]);
  const [trimmingCount, setTrimmingCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [libraryScan, setLibraryScan] = useState<NativeLibraryScan | null>(null);
  const [scanProgress, setScanProgress] = useState<NativeLibraryScanProgress | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const sessionRef = useRef<SessionRecap>({ kept: 0, trimmed: 0, deleted: 0, freed: 0 });
  const pendingDeletesRef = useRef<NativePhoto[]>([]);

  const settings = roundSettings(stats.settings);
  const top = queue[0];
  const next = queue[1];
  const trimsToday = dailyFor(stats, dateKey()).trimmed;
  const trimsRemainingToday = Math.max(0, FREE_DAILY_TRIM_LIMIT - trimsToday);

  useEffect(() => {
    let cancelled = false;
    loadNativeStats().then((loaded) => {
      if (cancelled) return;
      setStats(loaded);
      setStatsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function commitStats(updater: (current: NativeStats) => NativeStats) {
    setStats((current) => {
      const next = updater(current);
      void saveNativeStats(next);
      return next;
    });
  }

  function completeOnboarding() {
    commitStats((current) => ({ ...current, onboardingComplete: true }));
  }

  async function shareProgress() {
    try {
      await Share.share({ message: progressShareText(stats) });
      commitStats((current) => ({ ...current, shareCount: current.shareCount + 1 }));
    } catch (error) {
      console.log("[NativeTrimSwipe] Share failed", { error });
    }
  }

  async function runLibraryScan() {
    setScanBusy(true);
    setScanError(null);
    setScanProgress({ scanned: 0 });

    try {
      const permission = await requestPhotoPermission();
      if (!permission.granted) {
        setPermissionDenied(true);
        setPermissionLimited(false);
        setScanError("Photo access is needed to scan your library.");
        return;
      }

      setPermissionDenied(false);
      setPermissionLimited(permission.limited);
      const result = await scanPhotoLibrary(setScanProgress);
      setLibraryScan(result);
      setScanProgress(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not scan the photo library";
      setScanError(message);
    } finally {
      setScanBusy(false);
    }
  }

  async function loadRound(settingsOverride = settings) {
    const activeSettings = roundSettings(settingsOverride);
    setLoading(true);
    setError(null);
    setRecap(null);
    setPendingDeletes([]);
    setTimeLeft(activeSettings.sessionMode === "time-attack" ? TIME_ATTACK_SECONDS : 0);
    pendingDeletesRef.current = [];
    sessionRef.current = { kept: 0, trimmed: 0, deleted: 0, freed: 0 };

    try {
      const permission = await requestPhotoPermission();
      if (!permission.granted) {
        setPermissionDenied(true);
        setPermissionLimited(false);
        setQueue([]);
        return;
      }

      setPermissionDenied(false);
      setPermissionLimited(permission.limited);
      const photos = await loadPhotoRound(activeSettings.cardsPerRound, activeSettings, {
        avoidIds: recentSelectionIds(stats),
      });
      setQueue(photos);
      commitStats((current) => withRecentlySeenPhotos(current, photos));
      if (photos.length === 0) {
        setError("No photos were available in the current library selection.");
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Could not load photos";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!statsLoaded || !stats.onboardingComplete) return;
    void loadRound();
    // Run once after initial settings load. Manual reload picks up later settings changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsLoaded, stats.onboardingComplete, stats.startedAt]);

  useEffect(() => {
    if (settings.sessionMode !== "time-attack" || loading || recap || pendingDeletes.length > 0) return undefined;
    if (timeLeft <= 0) return undefined;

    const timer = setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, pendingDeletes.length, recap, settings.sessionMode, timeLeft]);

  useEffect(() => {
    if (settings.sessionMode !== "time-attack" || timeLeft !== 0 || loading || recap) return;
    if (queue.length === 0) return;
    setQueue([]);
    finishSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, queue.length, recap, settings.sessionMode, timeLeft]);

  function finishSession() {
    commitStats((current) =>
      withDailyActivity(
        {
          ...current,
          sessions: current.sessions + 1,
        },
        { sessions: 1 },
      ),
    );

    if (pendingDeletesRef.current.length > 0) {
      return;
    }

    if (settings.sessionMode === "endless") {
      void loadRound();
      return;
    }

    setRecap({ ...sessionRef.current });
  }

  function finishIfNeeded(rest: NativePhoto[]) {
    if (rest.length > 0) return;
    finishSession();
  }

  function advance() {
    setQueue((current) => {
      const rest = current.slice(1);
      finishIfNeeded(rest);
      return rest;
    });
  }

  function handleAction(photo: NativePhoto, action: Action) {
    const session = sessionRef.current;

    if (action === "keep") {
      session.kept += 1;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      commitStats((current) =>
        appendActionLog(
          withDailyActivity(
            {
              ...current,
              reviewed: current.reviewed + 1,
              kept: current.kept + 1,
            },
            { reviewed: 1, kept: 1 },
          ),
          createActionLogEntry(photo, "keep", 0),
        ),
      );
      advance();
      return;
    }

    if (action === "delete") {
      session.deleted += 1;
      session.freed += photo.sizeMB;
      pendingDeletesRef.current = [...pendingDeletesRef.current, photo];
      setPendingDeletes(pendingDeletesRef.current);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      commitStats((current) =>
        appendActionLog(
          withDailyActivity(
            {
              ...current,
              reviewed: current.reviewed + 1,
              deleted: current.deleted + 1,
              mbFreed: +(current.mbFreed + photo.sizeMB).toFixed(2),
              deleteMbFreed: +(current.deleteMbFreed + photo.sizeMB).toFixed(2),
            },
            { reviewed: 1, deleted: 1, mbFreed: photo.sizeMB, deleteMbFreed: photo.sizeMB },
          ),
          createActionLogEntry(photo, "delete", photo.sizeMB),
        ),
      );
      advance();
      return;
    }

    if (trimsRemainingToday <= 0) {
      Alert.alert(
        "Daily trim limit reached",
        `Free accounts can trim ${FREE_DAILY_TRIM_LIMIT} photos per day. Keep reviewing or delete photos today, and trims reset tomorrow.`,
      );
      return;
    }

    const estimated = estimateTrimSavings(photo);
    session.trimmed += 1;
    session.freed += estimated;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    commitStats((current) =>
      appendActionLog(
        withDailyActivity(
          {
            ...current,
            reviewed: current.reviewed + 1,
            trimmed: current.trimmed + 1,
            mbFreed: +(current.mbFreed + estimated).toFixed(2),
            trimMbFreed: +(current.trimMbFreed + estimated).toFixed(2),
          },
          { reviewed: 1, trimmed: 1, mbFreed: estimated, trimMbFreed: estimated },
        ),
        createActionLogEntry(photo, "trim", estimated),
      ),
    );
    setTrimmingCount((count) => count + 1);
    void trimPhoto(photo, settings.trimQuality)
      .then((result) => {
        if (!result.trimmed && result.error) {
          console.log("[NativeTrimSwipe] Trim skipped", { id: photo.id, error: result.error });
        }
      })
      .finally(() => setTrimmingCount((count) => Math.max(0, count - 1)));
    advance();
  }

  async function confirmDeletes(photos: NativePhoto[]) {
    setLoading(true);
    const result = await deletePhotos(photos.map((photo) => photo.id));
    setLoading(false);

    if (result.deleted !== photos.length) {
      Alert.alert("Delete failed", "Some photos could not be moved to Recently Deleted.");
    }

    setPendingDeletes([]);
    pendingDeletesRef.current = [];
    setRecap({ ...sessionRef.current });
  }

  function undoPendingDeletes() {
    const photos = pendingDeletesRef.current;
    setPendingDeletes([]);
    pendingDeletesRef.current = [];
    sessionRef.current.deleted = Math.max(0, sessionRef.current.deleted - photos.length);
    sessionRef.current.freed = Math.max(
      0,
      sessionRef.current.freed - photos.reduce((sum, photo) => sum + photo.sizeMB, 0),
    );
    const restoredMB = photos.reduce((sum, photo) => sum + photo.sizeMB, 0);
    commitStats((current) =>
      withDailyActivity(
        {
          ...current,
          deleted: Math.max(0, current.deleted - photos.length),
          mbFreed: Math.max(0, +(current.mbFreed - restoredMB).toFixed(2)),
          deleteMbFreed: Math.max(0, +(current.deleteMbFreed - restoredMB).toFixed(2)),
        },
        { deleted: -photos.length, mbFreed: -restoredMB, deleteMbFreed: -restoredMB },
      ),
    );
    setRecap({ ...sessionRef.current });
  }

  function updateSettings(patch: Partial<NativeSettings>) {
    commitStats((current) => ({
      ...current,
      settings: roundSettings({ ...current.settings, ...patch }),
    }));
  }

  function startGame(patch: Partial<NativeSettings>) {
    const nextSettings = roundSettings({ ...settings, ...patch });
    commitStats((current) => ({ ...current, settings: nextSettings }));
    setScreen("swipe");
    void loadRound(nextSettings);
  }

  async function bulkTrimPhotos(photos: NativePhoto[]) {
    const available = Math.max(0, FREE_DAILY_TRIM_LIMIT - dailyFor(stats, dateKey()).trimmed);
    const candidates = photos.filter((photo) => !photo.isCloudAsset).slice(0, available);
    if (available <= 0) {
      Alert.alert(
        "Daily trim limit reached",
        `Free accounts can trim ${FREE_DAILY_TRIM_LIMIT} photos per day. This limit will become part of the Pro tier later.`,
      );
      return;
    }

    if (candidates.length === 0) {
      Alert.alert("Nothing local to trim", "This deck only has iCloud-only or unavailable photos.");
      return;
    }

    setBulkBusy(true);
    setTrimmingCount((count) => count + candidates.length);

    const estimated = candidates.reduce((sum, photo) => sum + estimateTrimSavings(photo), 0);
    sessionRef.current.trimmed += candidates.length;
    sessionRef.current.freed += estimated;
    commitStats((current) => {
      const next = withDailyActivity(
        {
          ...current,
          reviewed: current.reviewed + candidates.length,
          trimmed: current.trimmed + candidates.length,
          mbFreed: +(current.mbFreed + estimated).toFixed(2),
          trimMbFreed: +(current.trimMbFreed + estimated).toFixed(2),
        },
        { reviewed: candidates.length, trimmed: candidates.length, mbFreed: estimated, trimMbFreed: estimated },
      );
      return candidates.reduce(
        (statsSoFar, photo) => appendActionLog(statsSoFar, createActionLogEntry(photo, "trim", estimateTrimSavings(photo))),
        next,
      );
    });

    setQueue((current) => {
      const trimmedIds = new Set(candidates.map((photo) => photo.id));
      const rest = current.filter((photo) => !trimmedIds.has(photo.id));
      finishIfNeeded(rest);
      return rest;
    });

    await Promise.all(candidates.map((photo) => trimPhoto(photo, settings.trimQuality)));
    setTrimmingCount((count) => Math.max(0, count - candidates.length));
    setBulkBusy(false);
  }

  async function confirmGameOutcome({
    title,
    detail,
    kept,
    deleted,
  }: {
    title: string;
    detail: string;
    kept: NativePhoto[];
    deleted: NativePhoto[];
  }): Promise<number> {
    if (deleted.length === 0) return 0;

    return new Promise((resolve) => {
      Alert.alert(title, detail, [
        { text: "Cancel", style: "cancel", onPress: () => resolve(0) },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const result = await deletePhotos(deleted.map((photo) => photo.id));
            const deletedPhotos = deleted.slice(0, result.deleted);
            const keptPhotos = result.deleted > 0 ? kept : [];
            const freed = deletedPhotos.reduce((sum, photo) => sum + photo.sizeMB, 0);
            if (result.deleted !== deleted.length) {
              Alert.alert("Delete incomplete", `${result.deleted}/${deleted.length} photos were moved to Recently Deleted.`);
            }

            if (deletedPhotos.length > 0 || keptPhotos.length > 0) {
              commitStats((current) => {
                const next = withDailyActivity(
                  {
                    ...current,
                    reviewed: current.reviewed + keptPhotos.length + deletedPhotos.length,
                    kept: current.kept + keptPhotos.length,
                    deleted: current.deleted + deletedPhotos.length,
                    mbFreed: +(current.mbFreed + freed).toFixed(2),
                    deleteMbFreed: +(current.deleteMbFreed + freed).toFixed(2),
                  },
                  {
                    reviewed: keptPhotos.length + deletedPhotos.length,
                    kept: keptPhotos.length,
                    deleted: deletedPhotos.length,
                    mbFreed: freed,
                    deleteMbFreed: freed,
                  },
                );

                return [...keptPhotos, ...deletedPhotos].reduce((statsSoFar, photo) => {
                  const action: Action = deletedPhotos.some((deletedPhoto) => deletedPhoto.id === photo.id)
                    ? "delete"
                    : "keep";
                  return appendActionLog(
                    statsSoFar,
                    createActionLogEntry(photo, action, action === "delete" ? photo.sizeMB : 0),
                  );
                }, next);
              });
            }

            resolve(result.deleted);
          },
        },
      ]);
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={[styles.shell, settings.highContrast && styles.shellHighContrast]}>
        {!statsLoaded ? (
          <Centered>
            <ActivityIndicator color="#f97316" size="large" />
            <Text style={styles.muted}>Preparing TrimSwipe...</Text>
          </Centered>
        ) : !stats.onboardingComplete ? (
          <OnboardingScreen
            scan={libraryScan}
            scanBusy={scanBusy}
            scanError={scanError}
            scanProgress={scanProgress}
            permissionDenied={permissionDenied}
            permissionLimited={permissionLimited}
            onScan={runLibraryScan}
            onDone={completeOnboarding}
            onOpenSettings={() => {
              completeOnboarding();
              setScreen("settings");
            }}
          />
        ) : screen === "swipe" ? (
          <SwipeScreen
            top={top}
            next={next}
            queueCount={queue.length}
            loading={loading}
            error={error}
            permissionDenied={permissionDenied}
            permissionLimited={permissionLimited}
            settings={settings}
            recap={recap}
            pendingDeletes={pendingDeletes}
            trimmingCount={trimmingCount}
            timeLeft={timeLeft}
            largeControls={settings.largeText}
            trimsRemaining={trimsRemainingToday}
            trimLimit={FREE_DAILY_TRIM_LIMIT}
            onAction={handleAction}
            onReload={loadRound}
            onOpenSettings={() => Linking.openSettings()}
            onConfirmDeletes={confirmDeletes}
            onUndoDeletes={undoPendingDeletes}
            onShare={shareProgress}
          />
        ) : screen === "stats" ? (
          <StatsScreen
            stats={stats}
            onStartRound={() => {
              setScreen("swipe");
              void loadRound();
            }}
            onOpenSettings={() => setScreen("settings")}
            onShare={shareProgress}
          />
        ) : screen === "this-or-that" ? (
          <ThisOrThatScreen
            settings={settings}
            onBack={() => setScreen("games")}
            onConfirmOutcome={(kept, deleted) =>
              confirmGameOutcome({
                title: "Delete the unpicked photos?",
                detail: `This will move ${deleted.length} photo${deleted.length === 1 ? "" : "s"} to Recently Deleted and free about ${formatMB(
                  deleted.reduce((sum, photo) => sum + photo.sizeMB, 0),
                )}.`,
                kept,
                deleted,
              })
            }
          />
        ) : screen === "storage-budget" ? (
          <StorageBudgetScreen
            settings={settings}
            onBack={() => setScreen("games")}
            onConfirmOutcome={(kept, deleted) =>
              confirmGameOutcome({
                title: "Delete photos outside your budget?",
                detail: `This will move ${deleted.length} photo${deleted.length === 1 ? "" : "s"} to Recently Deleted and free about ${formatMB(
                  deleted.reduce((sum, photo) => sum + photo.sizeMB, 0),
                )}.`,
                kept,
                deleted,
              })
            }
          />
        ) : screen === "memory-lane" ? (
          <MemoryLaneScreen
            settings={settings}
            onBack={() => setScreen("games")}
            onConfirmOutcome={(kept, deleted) =>
              confirmGameOutcome({
                title: "Delete cleared memories?",
                detail: `This will move ${deleted.length} photo${deleted.length === 1 ? "" : "s"} to Recently Deleted and free about ${formatMB(
                  deleted.reduce((sum, photo) => sum + photo.sizeMB, 0),
                )}.`,
                kept,
                deleted,
              })
            }
          />
        ) : screen === "games" ? (
          <GamesScreen
            settings={settings}
            queue={queue}
            actionLog={stats.actionLog}
            busy={bulkBusy}
            trimsRemaining={trimsRemainingToday}
            onStartGame={startGame}
            onOpenThisOrThat={() => setScreen("this-or-that")}
            onOpenStorageBudget={() => setScreen("storage-budget")}
            onOpenMemoryLane={() => setScreen("memory-lane")}
            onBulkTrim={() => void bulkTrimPhotos(queue)}
            onStartRound={() => {
              setScreen("swipe");
              void loadRound();
            }}
          />
        ) : (
          <SettingsScreen settings={settings} onChange={updateSettings} onReload={loadRound} />
        )}
        {statsLoaded && stats.onboardingComplete ? <BottomNav screen={screen} onChange={setScreen} /> : null}
      </View>
    </SafeAreaView>
  );
}

function SwipeScreen({
  top,
  next,
  queueCount,
  loading,
  error,
  permissionDenied,
  permissionLimited,
  settings,
  recap,
  pendingDeletes,
  trimmingCount,
  timeLeft,
  largeControls,
  trimsRemaining,
  trimLimit,
  onAction,
  onReload,
  onOpenSettings,
  onConfirmDeletes,
  onUndoDeletes,
  onShare,
}: {
  top?: NativePhoto;
  next?: NativePhoto;
  queueCount: number;
  loading: boolean;
  error: string | null;
  permissionDenied: boolean;
  permissionLimited: boolean;
  settings: NativeSettings;
  recap: SessionRecap | null;
  pendingDeletes: NativePhoto[];
  trimmingCount: number;
  timeLeft: number;
  largeControls: boolean;
  trimsRemaining: number;
  trimLimit: number;
  onAction: (photo: NativePhoto, action: Action) => void;
  onReload: () => void;
  onOpenSettings: () => void;
  onConfirmDeletes: (photos: NativePhoto[]) => void;
  onUndoDeletes: () => void;
  onShare: () => void;
}) {
  if (loading) {
    return (
      <Centered>
        <ActivityIndicator color="#f97316" size="large" />
        <Text style={styles.muted}>Loading your photo round...</Text>
      </Centered>
    );
  }

  if (permissionDenied) {
    return (
      <Centered>
        <Text style={styles.heroTitle}>Photo access needed</Text>
        <Text style={styles.centerText}>
          TrimSwipe needs photo access to build your cleanup deck.
        </Text>
        <PrimaryButton label="Open iOS Settings" onPress={onOpenSettings} />
        <SecondaryButton label="Try again" onPress={onReload} />
      </Centered>
    );
  }

  if (pendingDeletes.length > 0 && !top) {
    return (
      <DeleteReview
        photos={pendingDeletes}
        onConfirm={() => onConfirmDeletes(pendingDeletes)}
        onCancel={onUndoDeletes}
      />
    );
  }

  if (recap) {
    return <Recap recap={recap} onNext={onReload} onShare={onShare} />;
  }

  if (error && !top) {
    return (
      <Centered>
        <Text style={styles.heroTitle}>No deck yet</Text>
        <Text style={styles.centerText}>{error}</Text>
        <PrimaryButton label="Reload photos" onPress={onReload} />
      </Centered>
    );
  }

  return (
    <View style={styles.content}>
      <View style={styles.swipeHeader}>
        <View style={styles.swipeHeaderCopy}>
          <Text style={styles.eyebrow}>Current focus</Text>
          <Text style={[styles.swipeTitle, largeControls && styles.swipeTitleLarge]}>
            {targetLabel(settings)}
          </Text>
          <Text style={styles.swipeSubtitle}>
            {sessionModeLabel(settings.sessionMode)} mode. A cleaner set of photos, one quick decision at a time.
          </Text>
        </View>
        <View style={styles.swipeStatusColumn}>
          <Text style={styles.queuePill}>{queueCount} left</Text>
          <Text style={styles.trimLimitPill}>{trimsRemaining}/{trimLimit} trims</Text>
          {settings.sessionMode === "time-attack" ? <Text style={styles.timerPill}>{timeLeft}s</Text> : null}
          {trimmingCount > 0 ? <Text style={styles.trimBadge}>Trimming {trimmingCount}</Text> : null}
        </View>
      </View>
      {permissionLimited ? (
        <Text style={styles.warning}>Limited photo access is enabled. Some photos may be hidden.</Text>
      ) : null}
      <View style={styles.deck}>
        {next ? <PhotoCard photo={next} stacked /> : null}
        {top ? <SwipeablePhotoCard photo={top} onAction={(action) => onAction(top, action)} /> : null}
      </View>
      <View style={styles.actions}>
        <ActionButton label="Keep" tone="keep" large={largeControls} onPress={() => top && onAction(top, "keep")} />
        <ActionButton
          label={trimsRemaining > 0 ? "Trim" : "Limit hit"}
          tone="trim"
          large={largeControls}
          disabled={trimsRemaining <= 0}
          onPress={() => top && onAction(top, "trim")}
        />
        <ActionButton label="Delete" tone="delete" large={largeControls} onPress={() => top && onAction(top, "delete")} />
      </View>
    </View>
  );
}

function SwipeablePhotoCard({
  photo,
  onAction,
}: {
  photo: NativePhoto;
  onAction: (action: Action) => void;
}) {
  const pan = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    pan.setValue({ x: 0, y: 0 });
  }, [pan, photo.id]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -SWIPE_THRESHOLD && Math.abs(gesture.dy) > Math.abs(gesture.dx)) {
            onAction("trim");
            return;
          }
          if (gesture.dx > SWIPE_THRESHOLD) {
            onAction("delete");
            return;
          }
          if (gesture.dx < -SWIPE_THRESHOLD) {
            onAction("keep");
            return;
          }
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            tension: 70,
            friction: 8,
          }).start();
        },
      }),
    [onAction, pan],
  );

  const rotate = pan.x.interpolate({
    inputRange: [-180, 0, 180],
    outputRange: ["-12deg", "0deg", "12deg"],
  });
  const keepOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -20, 0],
    outputRange: [0.38, 0.14, 0],
    extrapolate: "clamp",
  });
  const deleteOpacity = pan.x.interpolate({
    inputRange: [0, 20, SWIPE_THRESHOLD],
    outputRange: [0, 0.14, 0.38],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.animatedCard,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }],
        },
      ]}
    >
      <PhotoCard photo={photo} />
      <Animated.View pointerEvents="none" style={[styles.swipeTint, styles.keepTint, { opacity: keepOpacity }]} />
      <Animated.View pointerEvents="none" style={[styles.swipeTint, styles.deleteTint, { opacity: deleteOpacity }]} />
    </Animated.View>
  );
}

function PhotoCard({ photo, stacked }: { photo: NativePhoto; stacked?: boolean }) {
  return (
    <View style={[styles.photoCard, stacked && styles.stackedCard]}>
      <Image source={{ uri: photo.uri }} style={styles.photoImage} contentFit="cover" transition={120} />
      <View style={styles.photoShade} />
      <View style={styles.photoTop}>
        <Text style={styles.pill}>Delete saves {photo.sizeMB.toFixed(1)} MB</Text>
        <Text style={styles.pill}>Trim saves ~{estimateTrimSavings(photo).toFixed(1)} MB</Text>
      </View>
      <View style={styles.photoBottom}>
        <Text style={styles.photoTitle} numberOfLines={1}>
          {photo.title}
        </Text>
        <Text style={styles.photoMeta}>
          {photo.month} {photo.year} - {photo.device}
        </Text>
        <View style={styles.reasonRow}>
          {photo.cleanupReasons.map((reason) => (
            <Text key={reason} style={styles.reason}>
              {reason}
            </Text>
          ))}
          {photo.isCloudAsset ? <Text style={styles.reason}>iCloud</Text> : null}
        </View>
      </View>
    </View>
  );
}

function DeleteReview({
  photos,
  onConfirm,
  onCancel,
}: {
  photos: NativePhoto[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const total = photos.reduce((sum, photo) => sum + photo.sizeMB, 0);
  return (
    <View style={styles.content}>
      <Text style={styles.heroTitle}>Confirm deletion</Text>
      <Text style={styles.muted}>
        {photos.length} photo{photos.length === 1 ? "" : "s"} will move to Recently Deleted.
      </Text>
      <ScrollView style={styles.reviewList}>
        {photos.map((photo) => (
          <View key={photo.id} style={styles.reviewRow}>
            <Image source={{ uri: photo.uri }} style={styles.reviewThumb} contentFit="cover" />
            <View style={styles.reviewCopy}>
              <Text style={styles.reviewTitle} numberOfLines={1}>
                {photo.title}
              </Text>
              <Text style={styles.mutedSmall}>{photo.sizeMB.toFixed(1)} MB</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <PrimaryButton label={`Delete ${formatMB(total)}`} danger onPress={onConfirm} />
      <SecondaryButton label="Keep them all" onPress={onCancel} />
    </View>
  );
}

function Recap({ recap, onNext, onShare }: { recap: SessionRecap; onNext: () => void; onShare: () => void }) {
  const total = recap.kept + recap.trimmed + recap.deleted;
  const insight =
    recap.deleted > recap.trimmed
      ? "Deletes did the heavy lifting this round."
      : recap.trimmed > 0
        ? "Trims quietly reclaimed space without losing memories."
        : "A light pass still keeps the camera roll intentional.";
  return (
    <Centered>
      <Text style={styles.heroTitle}>Set complete</Text>
      <Text style={styles.centerText}>
        You reviewed {total} photos and freed about {formatMB(recap.freed)}.
      </Text>
      <Text style={styles.insightText}>{insight}</Text>
      <View style={styles.statGrid}>
        <MiniStat label="Kept" value={recap.kept} />
        <MiniStat label="Trimmed" value={recap.trimmed} />
        <MiniStat label="Deleted" value={recap.deleted} />
      </View>
      <PrimaryButton label="New set" onPress={onNext} />
      <SecondaryButton label="Share progress" onPress={onShare} />
    </Centered>
  );
}

function StatsScreen({
  stats,
  onStartRound,
  onOpenSettings,
  onShare,
}: {
  stats: NativeStats;
  onStartRound: () => void;
  onOpenSettings: () => void;
  onShare: () => void;
}) {
  const today = dailyFor(stats, dateKey());
  const week = sumDays(stats, 7);
  const month = monthStats(stats);
  const year = yearStats(stats);
  const streak = currentStreak(stats);
  const trimsInARow = trimStreak(stats);
  const health = storageHealthScore(stats, week, streak);
  const level = levelInfo(stats);
  const videoText =
    stats.mbFreed > 0
      ? `Equivalent to about ${Math.max(1, Math.round(stats.mbFreed / FOUR_K_VIDEO_MB_PER_MINUTE))} min of 4K video.`
      : "Start with one focused round and this will become your cleanup story.";
  const achievements: Achievement[] = [
    {
      title: "Daily rhythm",
      detail: `${today.reviewed}/${DAILY_REVIEW_TARGET} photos reviewed today`,
      progress: clampProgress(today.reviewed, DAILY_REVIEW_TARGET),
      unlocked: today.reviewed >= DAILY_REVIEW_TARGET,
    },
    {
      title: "Weekly saver",
      detail: `${formatMB(week.mbFreed)} / ${formatMB(WEEKLY_SAVINGS_TARGET_MB)} this week`,
      progress: clampProgress(week.mbFreed, WEEKLY_SAVINGS_TARGET_MB),
      unlocked: week.mbFreed >= WEEKLY_SAVINGS_TARGET_MB,
    },
    {
      title: "Metadata master",
      detail: `${stats.trimmed}/50 trims completed`,
      progress: clampProgress(stats.trimmed, 50),
      unlocked: stats.trimmed >= 50,
    },
    {
      title: "Heavy hitter",
      detail: `${formatMB(stats.mbFreed)} / 1.00 GB reclaimed`,
      progress: clampProgress(stats.mbFreed, 1024),
      unlocked: stats.mbFreed >= 1024,
    },
  ];

  return (
    <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
      <View style={styles.dashboardHero}>
        <View style={styles.dashboardHeroTop}>
          <View>
            <Text style={styles.eyebrow}>Progress</Text>
            <Text style={styles.heroTitle}>Storage health</Text>
          </View>
          <View style={styles.healthScore}>
            <Text style={styles.healthValue}>{health}</Text>
            <Text style={styles.healthLabel}>score</Text>
          </View>
        </View>
        <Text style={styles.dashboardCopy}>{videoText}</Text>
        <View style={styles.levelRow}>
          <View style={styles.levelCopy}>
            <Text style={styles.levelTitle}>Level {level.level}</Text>
            <Text style={styles.mutedSmall}>{level.title}</Text>
          </View>
          <View style={styles.levelProgress}>
            <ProgressBar progress={level.progress} />
            <Text style={styles.mutedSmall}>{level.next}</Text>
          </View>
        </View>
      </View>

      <View style={styles.quickActions}>
        <QuickActionButton label="Start round" detail={targetLabel(stats.settings)} onPress={onStartRound} />
        <QuickActionButton label="Tune focus" detail="Smart filters and modes" onPress={onOpenSettings} />
        <QuickActionButton label="Share" detail={`${stats.shareCount} shared`} onPress={onShare} />
      </View>

      <SectionTitle title="TrimStreak" detail={trimsInARow > 0 ? `${trimsInARow} days active` : "Start today"} />
      <View style={styles.streakCard}>
        <View>
          <Text style={styles.streakValue}>{trimsInARow}</Text>
          <Text style={styles.mutedSmall}>days with at least one trim</Text>
        </View>
        <View style={styles.streakDivider} />
        <View style={styles.streakCopy}>
          <Text style={styles.challengeTitle}>{today.trimmed}/{FREE_DAILY_TRIM_LIMIT} trims today</Text>
          <Text style={styles.mutedSmall}>Free trims reset daily. Pro can lift this later.</Text>
        </View>
      </View>

      <SectionTitle title="Challenges" detail={streak > 0 ? `${streak}-day streak` : "Build your first streak"} />
      <ChallengeCard
        title="Clean 10 photos today"
        value={`${today.reviewed}/${DAILY_REVIEW_TARGET}`}
        detail={`${today.trimmed + today.deleted} cleaned, ${formatMB(today.mbFreed)} reclaimed`}
        progress={clampProgress(today.reviewed, DAILY_REVIEW_TARGET)}
      />
      <ChallengeCard
        title="Save 500 MB this week"
        value={formatMB(week.mbFreed)}
        detail={`${week.reviewed} reviewed across the last 7 days`}
        progress={clampProgress(week.mbFreed, WEEKLY_SAVINGS_TARGET_MB)}
      />

      <SectionTitle title="Impact" detail="What actually freed space" />
      <ImpactBreakdown trimMB={stats.trimMbFreed} deleteMB={stats.deleteMbFreed} />
      <SectionTitle title="Trim savings" detail="This week / month / year" />
      <View style={styles.metricGrid}>
        <MetricCard label="Today trimmed" value={formatMB(today.trimMbFreed)} />
        <MetricCard label="This week" value={formatMB(week.trimMbFreed)} />
        <MetricCard label="This month" value={formatMB(month.trimMbFreed)} />
        <MetricCard label="This year" value={formatMB(year.trimMbFreed)} />
      </View>
      <View style={styles.metricGrid}>
        <MetricCard label="Reviewed" value={String(stats.reviewed)} />
        <MetricCard label="Trimmed" value={String(stats.trimmed)} />
        <MetricCard label="Deleted" value={String(stats.deleted)} />
        <MetricCard label="Sessions" value={String(stats.sessions)} />
      </View>

      <SectionTitle title="Recent activity" detail="Last 7 days" />
      <ActivityBars stats={stats} />

      <SectionTitle title="Badges" detail="Simple milestones to chase" />
      <AchievementGrid achievements={achievements} />
    </ScrollView>
  );
}

function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

function QuickActionButton({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.quickAction}>
      <Text style={styles.quickActionLabel}>{label}</Text>
      <Text style={styles.quickActionDetail} numberOfLines={1}>
        {detail}
      </Text>
    </Pressable>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: progressWidth(progress) }]} />
    </View>
  );
}

function ChallengeCard({
  title,
  value,
  detail,
  progress,
}: {
  title: string;
  value: string;
  detail: string;
  progress: number;
}) {
  return (
    <View style={styles.challengeCard}>
      <View style={styles.challengeHeader}>
        <Text style={styles.challengeTitle}>{title}</Text>
        <Text style={styles.challengeValue}>{value}</Text>
      </View>
      <ProgressBar progress={progress} />
      <Text style={styles.mutedSmall}>{detail}</Text>
    </View>
  );
}

function ImpactBreakdown({ trimMB, deleteMB }: { trimMB: number; deleteMB: number }) {
  const total = trimMB + deleteMB;
  const trimProgress = total > 0 ? trimMB / total : 0;
  const deleteProgress = total > 0 ? deleteMB / total : 0;

  return (
    <View style={styles.impactPanel}>
      <View style={styles.impactHeader}>
        <Text style={styles.impactValue}>{formatMB(total)}</Text>
        <Text style={styles.mutedSmall}>Total estimated reclaimed</Text>
      </View>
      <ImpactRow label="Trim" value={formatMB(trimMB)} progress={trimProgress} tone="trim" />
      <ImpactRow label="Delete" value={formatMB(deleteMB)} progress={deleteProgress} tone="delete" />
    </View>
  );
}

function ImpactRow({
  label,
  value,
  progress,
  tone,
}: {
  label: string;
  value: string;
  progress: number;
  tone: "trim" | "delete";
}) {
  return (
    <View style={styles.impactRow}>
      <View style={styles.impactLabelRow}>
        <Text style={styles.impactLabel}>{label}</Text>
        <Text style={styles.impactAmount}>{value}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            tone === "trim" ? styles.progressTrim : styles.progressDelete,
            { width: progressWidth(progress) },
          ]}
        />
      </View>
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.mutedSmall}>{label}</Text>
    </View>
  );
}

function ActivityBars({ stats }: { stats: NativeStats }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(new Date(), index - 6);
    const key = dateKey(date);
    return {
      key,
      label: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3),
      stats: dailyFor(stats, key),
    };
  });
  const maxReviewed = Math.max(1, ...days.map((day) => day.stats.reviewed));

  return (
    <View style={styles.activityPanel}>
      {days.map((day) => (
        <View key={day.key} style={styles.activityDay}>
          <View style={styles.activityBarTrack}>
            <View
              style={[
                styles.activityBar,
                { height: percentValue(Math.max(8, (day.stats.reviewed / maxReviewed) * 100)) },
              ]}
            />
          </View>
          <Text style={styles.activityLabel}>{day.label}</Text>
          <Text style={styles.activityValue}>{day.stats.reviewed}</Text>
        </View>
      ))}
    </View>
  );
}

function AchievementGrid({ achievements }: { achievements: Achievement[] }) {
  return (
    <View style={styles.achievementGrid}>
      {achievements.map((achievement) => (
        <View
          key={achievement.title}
          style={[styles.achievementCard, achievement.unlocked && styles.achievementUnlocked]}
        >
          <View style={styles.achievementStatus}>
            <Text style={styles.achievementStatusText}>{achievement.unlocked ? "Done" : "Next"}</Text>
          </View>
          <Text style={styles.achievementTitle}>{achievement.title}</Text>
          <Text style={styles.mutedSmall}>{achievement.detail}</Text>
          <ProgressBar progress={achievement.progress} />
        </View>
      ))}
    </View>
  );
}

function OnboardingScreen({
  scan,
  scanBusy,
  scanError,
  scanProgress,
  permissionDenied,
  permissionLimited,
  onScan,
  onDone,
  onOpenSettings,
}: {
  scan: NativeLibraryScan | null;
  scanBusy: boolean;
  scanError: string | null;
  scanProgress: NativeLibraryScanProgress | null;
  permissionDenied: boolean;
  permissionLimited: boolean;
  onScan: () => void;
  onDone: () => void;
  onOpenSettings: () => void;
}) {
  const progressText = scanProgress?.total
    ? `Scanning ${scanProgress.scanned}/${scanProgress.total} photos...`
    : scanProgress
      ? `Scanning ${scanProgress.scanned} photos...`
      : "Scanning...";

  return (
    <ScrollView contentContainerStyle={[styles.content, styles.onboardingContent]}>
      <View style={styles.dashboardHero}>
        <Text style={styles.eyebrow}>Welcome</Text>
        <Text style={styles.heroTitle}>See what your camera roll is costing.</Text>
        <Text style={styles.dashboardCopy}>
          Start with a scan. TrimSwipe estimates your photo storage, how much trimming can save, and how much space
          likely duplicates or bad shots could free if deleted.
        </Text>
        {permissionLimited ? (
          <Text style={styles.warning}>Limited photo access is enabled, so this scan only covers selected photos.</Text>
        ) : null}
        {scanError ? <Text style={styles.warning}>{scanError}</Text> : null}
        <PrimaryButton
          label={scanBusy ? progressText : scan ? "Scan again" : "Scan photo library"}
          disabled={scanBusy}
          onPress={onScan}
        />
        {permissionDenied ? <SecondaryButton label="Open iOS Settings" onPress={() => Linking.openSettings()} /> : null}
      </View>

      {scan ? (
        <>
          <ScanResults scan={scan} />
          <PrimaryButton label="Choose a cleanup game" onPress={onDone} />
          <SecondaryButton label="Tune settings first" onPress={onOpenSettings} />
        </>
      ) : (
        <View style={styles.onboardingSteps}>
          <OnboardingStep title="Device-aware bars" detail="The full bar is your iPhone or iPad storage capacity." />
          <OnboardingStep title="Trim estimate" detail="See how much space compression can save without deleting." />
          <OnboardingStep title="Delete estimate" detail="See likely duplicate and mistake savings before making choices." />
        </View>
      )}
    </ScrollView>
  );
}

function ScanResults({ scan }: { scan: NativeLibraryScan }) {
  const capacityMB = scan.deviceCapacityMB ?? Math.max(1, scan.totalSizeMB);
  const afterTrimMB = Math.max(0, scan.totalSizeMB - scan.trimSavingsMB);
  const afterDeleteMB = Math.max(0, scan.totalSizeMB - scan.deleteSavingsMB);
  const capacityLabel = scan.deviceCapacityMB
    ? `${formatMB(scan.deviceCapacityMB)} device capacity`
    : "Photo library size used as scale";

  return (
    <View style={styles.scanPanel}>
      <View style={styles.scanHeader}>
        <View>
          <Text style={styles.eyebrow}>Scan result</Text>
          <Text style={styles.scanTotal}>{formatMB(scan.totalSizeMB)}</Text>
        </View>
        <Text style={styles.scanCapacity}>{capacityLabel}</Text>
      </View>

      <View style={styles.scanMetricGrid}>
        <ScanMetric label="Photos scanned" value={String(scan.assetCount)} />
        <ScanMetric label="Trim can save" value={formatMB(scan.trimSavingsMB)} />
        <ScanMetric label="Delete can save" value={formatMB(scan.deleteSavingsMB)} />
        <ScanMetric label="Screenshots found" value={String(scan.screenshotCount)} />
      </View>

      <View style={styles.storageBars}>
        <StorageBar
          label="Photo library now"
          detail={`${formatMB(scan.totalSizeMB)} allocated`}
          valueMB={scan.totalSizeMB}
          capacityMB={capacityMB}
          tone="now"
        />
        <StorageBar
          label="After Trim"
          detail={`${formatMB(scan.trimSavingsMB)} estimated savings`}
          valueMB={afterTrimMB}
          capacityMB={capacityMB}
          tone="trim"
        />
        <StorageBar
          label="After Delete"
          detail={`${formatMB(scan.deleteSavingsMB)} from duplicates and likely mistakes`}
          valueMB={afterDeleteMB}
          capacityMB={capacityMB}
          tone="delete"
        />
      </View>

      <Text style={styles.scanFootnote}>
        Delete estimate includes {scan.duplicateRemovalCount} duplicate candidates and {scan.mistakeCount} likely blurry,
        dark, or accidental photos. Some sizes are estimated when iOS does not expose exact bytes.
      </Text>
    </View>
  );
}

function ScanMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.scanMetric}>
      <Text style={styles.scanMetricValue}>{value}</Text>
      <Text style={styles.mutedSmall}>{label}</Text>
    </View>
  );
}

function StorageBar({
  label,
  detail,
  valueMB,
  capacityMB,
  tone,
}: {
  label: string;
  detail: string;
  valueMB: number;
  capacityMB: number;
  tone: "now" | "trim" | "delete";
}) {
  const fillStyle =
    tone === "trim"
      ? styles.storageFillTrim
      : tone === "delete"
        ? styles.storageFillDelete
        : styles.storageFillNow;

  return (
    <View style={styles.storageBarBlock}>
      <View style={styles.impactLabelRow}>
        <Text style={styles.impactLabel}>{label}</Text>
        <Text style={styles.impactAmount}>{formatMB(valueMB)}</Text>
      </View>
      <View style={styles.storageTrack}>
        <View style={[styles.storageFill, fillStyle, { width: progressWidth(valueMB / capacityMB) }]} />
      </View>
      <Text style={styles.mutedSmall}>{detail}</Text>
    </View>
  );
}

function OnboardingStep({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.onboardingStep}>
      <Text style={styles.challengeTitle}>{title}</Text>
      <Text style={styles.muted}>{detail}</Text>
    </View>
  );
}

function GamesScreen({
  settings,
  queue,
  actionLog,
  busy,
  trimsRemaining,
  onStartGame,
  onOpenThisOrThat,
  onOpenStorageBudget,
  onOpenMemoryLane,
  onBulkTrim,
  onStartRound,
}: {
  settings: NativeSettings;
  queue: NativePhoto[];
  actionLog: NativeActionLogEntry[];
  busy: boolean;
  trimsRemaining: number;
  onStartGame: (patch: Partial<NativeSettings>) => void;
  onOpenThisOrThat: () => void;
  onOpenStorageBudget: () => void;
  onOpenMemoryLane: () => void;
  onBulkTrim: () => void;
  onStartRound: () => void;
}) {
  const trimCandidates = queue.filter((photo) => !photo.isCloudAsset);
  const trimSavings = trimCandidates.reduce((sum, photo) => sum + estimateTrimSavings(photo), 0);

  return (
    <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
      <View style={styles.gamesHero}>
        <Text style={styles.eyebrow}>Games</Text>
        <Text style={styles.heroTitle}>Choose your cleanup game</Text>
        <Text style={styles.dashboardCopy}>
          Start with classic TrimSwipe, or use a smaller game when you want a different kind of decision.
        </Text>
      </View>

      <Pressable
        onPress={() => onStartGame({ sessionMode: "classic" })}
        style={styles.primaryGameCard}
      >
        <View style={styles.primaryGameBadge}>
          <Text style={styles.primaryGameBadgeText}>Main game</Text>
        </View>
        <Text style={styles.primaryGameTitle}>TrimSwipe</Text>
        <Text style={styles.primaryGameDetail}>Keep, trim, or delete one photo at a time.</Text>
      </Pressable>

      <View style={styles.gameGrid}>
        <GameModeCard
          title="This or That"
          detail="Pick one keeper from two similar photos."
          active={false}
          onPress={onOpenThisOrThat}
        />
        <GameModeCard
          title="Storage Budget"
          detail="Keep photos under a 50 MB budget."
          active={false}
          onPress={onOpenStorageBudget}
        />
        <GameModeCard
          title="Speed Round"
          detail="60 seconds, save what you can."
          active={settings.sessionMode === "time-attack"}
          onPress={() => onStartGame({ sessionMode: "time-attack" })}
        />
        <GameModeCard
          title="Memory Lane"
          detail="Older photos first, decide what stays."
          active={settings.targetMode === "old-only"}
          onPress={onOpenMemoryLane}
        />
      </View>

      <View style={styles.dashboardHero}>
        <View style={styles.dashboardHeroTop}>
          <View>
            <Text style={styles.eyebrow}>Review queue</Text>
            <Text style={styles.heroTitle}>Batch tools</Text>
          </View>
          <View style={styles.healthScore}>
            <Text style={styles.healthValue}>{queue.length}</Text>
            <Text style={styles.healthLabel}>left</Text>
          </View>
        </View>
        <Text style={styles.dashboardCopy}>
          Trim all local photos in the current deck, then keep swiping the rest. Deletes still require confirmation.
        </Text>
        <Text style={styles.mutedSmall}>{trimsRemaining}/{FREE_DAILY_TRIM_LIMIT} free trims left today</Text>
        <PrimaryButton
          label={busy ? "Trimming..." : `Trim ${trimCandidates.length} photos, save ~${formatMB(trimSavings)}`}
          onPress={onBulkTrim}
        />
      </View>

      <SectionTitle title="Current deck" detail={`${queue.length} remaining`} />
      {queue.length > 0 ? (
        queue.slice(0, 8).map((photo) => <QueuePhotoRow key={photo.id} photo={photo} />)
      ) : (
        <EmptyPanel title="No active deck" detail="Start a new round to fill the review queue." actionLabel="Start round" onAction={onStartRound} />
      )}

      <SectionTitle title="Recent actions" detail={`${actionLog.length} saved locally`} />
      {actionLog.length > 0 ? (
        actionLog.slice(0, 12).map((entry) => <ActionLogRow key={entry.id} entry={entry} />)
      ) : (
        <EmptyPanel title="No actions yet" detail="Your keep, trim, and delete history will appear here." />
      )}
    </ScrollView>
  );
}

function GameModeCard({
  title,
  detail,
  active,
  onPress,
}: {
  title: string;
  detail: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.gameCard, active && styles.gameCardActive]}>
      <Text style={[styles.gameTitle, active && styles.gameTitleActive]}>{title}</Text>
      <Text style={[styles.gameDetail, active && styles.gameDetailActive]}>{detail}</Text>
    </Pressable>
  );
}

function ThisOrThatScreen({
  settings,
  onBack,
  onConfirmOutcome,
}: {
  settings: NativeSettings;
  onBack: () => void;
  onConfirmOutcome: (kept: NativePhoto[], deleted: NativePhoto[]) => Promise<number>;
}) {
  const [pairs, setPairs] = useState<Array<[NativePhoto, NativePhoto]>>([]);
  const [index, setIndex] = useState(0);
  const [kept, setKept] = useState<NativePhoto[]>([]);
  const [deleted, setDeleted] = useState<NativePhoto[]>([]);
  const [loadingPairs, setLoadingPairs] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadPairs() {
    setLoadingPairs(true);
    try {
      const permission = await requestPhotoPermission();
      if (!permission.granted) {
        setPairs([]);
        return;
      }

      const photos = await loadPhotoRound(12, {
        ...settings,
        cardsPerRound: 12,
        targetMode: "similar",
        sessionMode: "classic",
      });
      const nextPairs: Array<[NativePhoto, NativePhoto]> = [];
      for (let i = 0; i + 1 < photos.length; i += 2) {
        nextPairs.push([photos[i], photos[i + 1]]);
      }
      setPairs(nextPairs);
      setIndex(0);
      setKept([]);
      setDeleted([]);
    } finally {
      setLoadingPairs(false);
    }
  }

  useEffect(() => {
    void loadPairs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pair = pairs[index];
  const freed = deleted.reduce((sum, photo) => sum + photo.sizeMB, 0);

  function pick(keepIndex: 0 | 1) {
    if (!pair) return;
    const keeper = pair[keepIndex];
    const loser = pair[keepIndex === 0 ? 1 : 0];
    setKept((current) => [...current, keeper]);
    setDeleted((current) => [...current, loser]);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIndex((current) => current + 1);
  }

  async function confirmDeletes() {
    setBusy(true);
    const count = await onConfirmOutcome(kept, deleted);
    setBusy(false);
    if (count > 0 || deleted.length === 0) void loadPairs();
  }

  if (loadingPairs) {
    return (
      <Centered>
        <ActivityIndicator color="#f97316" size="large" />
        <Text style={styles.muted}>Building This or That pairs...</Text>
      </Centered>
    );
  }

  if (!pair) {
    return (
      <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
        <MiniGameHeader title="This or That" detail="Round complete" onBack={onBack} />
        <View style={styles.dashboardHero}>
          <Text style={styles.heroTitle}>{deleted.length} photos ready</Text>
          <Text style={styles.dashboardCopy}>
            You picked {kept.length} keepers. Deleting the other choices would free about {formatMB(freed)}.
          </Text>
          <PrimaryButton label={busy ? "Deleting..." : `Delete losers, save ${formatMB(freed)}`} disabled={busy} onPress={confirmDeletes} />
          <SecondaryButton label="Play another round without deleting" onPress={() => void loadPairs()} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
      <MiniGameHeader title="This or That" detail={`${index + 1}/${pairs.length} pairs`} onBack={onBack} />
      <View style={styles.dashboardHero}>
        <Text style={styles.heroTitle}>Tap the photo to keep</Text>
        <Text style={styles.dashboardCopy}>The unpicked photo waits for final delete confirmation.</Text>
      </View>
      <View style={styles.thisThatRow}>
        <ChoicePhoto photo={pair[0]} label="A" onPress={() => pick(0)} />
        <ChoicePhoto photo={pair[1]} label="B" onPress={() => pick(1)} />
      </View>
      <Text style={styles.centerText}>Queued savings: {formatMB(freed)}</Text>
    </ScrollView>
  );
}

function StorageBudgetScreen({
  settings,
  onBack,
  onConfirmOutcome,
}: {
  settings: NativeSettings;
  onBack: () => void;
  onConfirmOutcome: (kept: NativePhoto[], deleted: NativePhoto[]) => Promise<number>;
}) {
  const budgetMB = 50;
  const [photos, setPhotos] = useState<NativePhoto[]>([]);
  const [keptIds, setKeptIds] = useState<Set<string>>(new Set());
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadBoard() {
    setLoadingPhotos(true);
    try {
      const permission = await requestPhotoPermission();
      if (!permission.granted) {
        setPhotos([]);
        return;
      }

      const next = await loadPhotoRound(12, {
        ...settings,
        cardsPerRound: 12,
        targetMode: "big-or-old",
        sessionMode: "classic",
      });
      setPhotos(next);
      setKeptIds(new Set());
    } finally {
      setLoadingPhotos(false);
    }
  }

  useEffect(() => {
    void loadBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keptPhotos = photos.filter((photo) => keptIds.has(photo.id));
  const deletePhotosFromBoard = photos.filter((photo) => !keptIds.has(photo.id));
  const usedMB = keptPhotos.reduce((sum, photo) => sum + photo.sizeMB, 0);
  const overBudget = usedMB > budgetMB;
  const deleteSavings = deletePhotosFromBoard.reduce((sum, photo) => sum + photo.sizeMB, 0);

  function toggle(photo: NativePhoto) {
    setKeptIds((current) => {
      const next = new Set(current);
      if (next.has(photo.id)) next.delete(photo.id);
      else next.add(photo.id);
      return next;
    });
  }

  async function lockBudget() {
    if (overBudget) {
      Alert.alert("Over budget", `Remove ${formatMB(usedMB - budgetMB)} from your kept photos before locking this board.`);
      return;
    }

    setBusy(true);
    const count = await onConfirmOutcome(keptPhotos, deletePhotosFromBoard);
    setBusy(false);
    if (count > 0 || deletePhotosFromBoard.length === 0) void loadBoard();
  }

  if (loadingPhotos) {
    return (
      <Centered>
        <ActivityIndicator color="#f97316" size="large" />
        <Text style={styles.muted}>Building a Storage Budget board...</Text>
      </Centered>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
      <MiniGameHeader title="Storage Budget" detail="Keep what fits" onBack={onBack} />
      <View style={styles.dashboardHero}>
        <View style={styles.dashboardHeroTop}>
          <View>
            <Text style={styles.eyebrow}>Budget</Text>
            <Text style={styles.heroTitle}>{formatMB(usedMB)} / {formatMB(budgetMB)}</Text>
          </View>
          <View style={styles.healthScore}>
            <Text style={styles.healthValue}>{keptPhotos.length}</Text>
            <Text style={styles.healthLabel}>kept</Text>
          </View>
        </View>
        <View style={styles.storageTrack}>
          <View
            style={[
              styles.storageFill,
              overBudget ? styles.storageFillDelete : styles.storageFillTrim,
              { width: progressWidth(Math.min(1, usedMB / budgetMB)) },
            ]}
          />
        </View>
        <Text style={styles.dashboardCopy}>
          Tap photos you want to keep. Everything outside the budget can be deleted after confirmation.
        </Text>
      </View>
      <View style={styles.budgetGrid}>
        {photos.map((photo) => (
          <BudgetPhotoTile key={photo.id} photo={photo} kept={keptIds.has(photo.id)} onPress={() => toggle(photo)} />
        ))}
      </View>
      <PrimaryButton
        label={busy ? "Deleting..." : `Lock budget, save ${formatMB(deleteSavings)}`}
        disabled={busy || photos.length === 0}
        onPress={lockBudget}
      />
    </ScrollView>
  );
}

function MemoryLaneScreen({
  settings,
  onBack,
  onConfirmOutcome,
}: {
  settings: NativeSettings;
  onBack: () => void;
  onConfirmOutcome: (kept: NativePhoto[], deleted: NativePhoto[]) => Promise<number>;
}) {
  const [photos, setPhotos] = useState<NativePhoto[]>([]);
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState<number | null>(null);
  const [options, setOptions] = useState<number[]>([]);
  const [kept, setKept] = useState<NativePhoto[]>([]);
  const [deleted, setDeleted] = useState<NativePhoto[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadMemories() {
    setLoadingPhotos(true);
    try {
      const permission = await requestPhotoPermission();
      if (!permission.granted) {
        setPhotos([]);
        return;
      }

      const next = await loadPhotoRound(8, {
        ...settings,
        cardsPerRound: 8,
        targetMode: "old-only",
        sessionMode: "classic",
      });
      setPhotos(next);
      setIndex(0);
      setGuess(null);
      setKept([]);
      setDeleted([]);
      setRevealed(false);
      setOptions(next[0] ? yearOptions(next[0].year) : []);
    } finally {
      setLoadingPhotos(false);
    }
  }

  useEffect(() => {
    void loadMemories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const photo = photos[index];
  const freed = deleted.reduce((sum, item) => sum + item.sizeMB, 0);

  function chooseYear(year: number) {
    setGuess(year);
    setRevealed(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function decide(keep: boolean) {
    if (!photo) return;
    if (keep) setKept((current) => [...current, photo]);
    else setDeleted((current) => [...current, photo]);

    const nextIndex = index + 1;
    setIndex(nextIndex);
    setGuess(null);
    setRevealed(false);
    setOptions(photos[nextIndex] ? yearOptions(photos[nextIndex].year) : []);
  }

  async function confirmDeletes() {
    setBusy(true);
    const count = await onConfirmOutcome(kept, deleted);
    setBusy(false);
    if (count > 0 || deleted.length === 0) void loadMemories();
  }

  if (loadingPhotos) {
    return (
      <Centered>
        <ActivityIndicator color="#f97316" size="large" />
        <Text style={styles.muted}>Finding older memories...</Text>
      </Centered>
    );
  }

  if (!photo) {
    return (
      <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
        <MiniGameHeader title="Memory Lane" detail="Round complete" onBack={onBack} />
        <View style={styles.dashboardHero}>
          <Text style={styles.heroTitle}>{kept.length} kept, {deleted.length} cleared</Text>
          <Text style={styles.dashboardCopy}>
            Deleting cleared memories would free about {formatMB(freed)}.
          </Text>
          <PrimaryButton label={busy ? "Deleting..." : `Delete cleared, save ${formatMB(freed)}`} disabled={busy} onPress={confirmDeletes} />
          <SecondaryButton label="Play another round without deleting" onPress={() => void loadMemories()} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
      <MiniGameHeader title="Memory Lane" detail={`${index + 1}/${photos.length} memories`} onBack={onBack} />
      <View style={styles.memoryCard}>
        <Image source={{ uri: photo.uri }} style={styles.memoryImage} contentFit="cover" />
        <View style={styles.photoShade} />
        <View style={styles.choiceFooter}>
          <Text style={styles.choiceTitle} numberOfLines={2}>{photo.title}</Text>
          <Text style={styles.choiceMeta}>{formatMB(photo.sizeMB)}</Text>
        </View>
      </View>

      {!revealed ? (
        <View style={styles.dashboardHero}>
          <Text style={styles.heroTitle}>What year was this?</Text>
          <View style={styles.yearGrid}>
            {options.map((year) => (
              <Pressable key={year} onPress={() => chooseYear(year)} style={styles.yearButton}>
                <Text style={styles.yearButtonText}>{year}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.dashboardHero}>
          <Text style={styles.eyebrow}>Actually</Text>
          <Text style={styles.heroTitle}>{photo.month} {photo.year}</Text>
          <Text style={styles.dashboardCopy}>
            You guessed {guess}. Now decide if this memory still earns its space.
          </Text>
          <View style={styles.actions}>
            <ActionButton label="Keep" tone="keep" onPress={() => decide(true)} />
            <ActionButton label="Clear" tone="delete" onPress={() => decide(false)} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function MiniGameHeader({ title, detail, onBack }: { title: string; detail: string; onBack: () => void }) {
  return (
    <View style={styles.miniGameHeader}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>
      <View style={styles.miniGameHeaderCopy}>
        <Text style={styles.eyebrow}>{detail}</Text>
        <Text style={styles.heroTitle}>{title}</Text>
      </View>
    </View>
  );
}

function ChoicePhoto({ photo, label, onPress }: { photo: NativePhoto; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.choicePhoto}>
      <Image source={{ uri: photo.uri }} style={styles.choiceImage} contentFit="cover" />
      <View style={styles.choiceShade} />
      <Text style={styles.choiceBadge}>{label}</Text>
      <View style={styles.choiceFooter}>
        <Text style={styles.choiceTitle} numberOfLines={2}>{photo.title}</Text>
        <Text style={styles.choiceMeta}>{formatMB(photo.sizeMB)}</Text>
      </View>
    </Pressable>
  );
}

function BudgetPhotoTile({
  photo,
  kept,
  onPress,
}: {
  photo: NativePhoto;
  kept: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.budgetTile, kept && styles.budgetTileKept]}>
      <Image source={{ uri: photo.uri }} style={styles.budgetImage} contentFit="cover" />
      <View style={styles.choiceShade} />
      <Text style={[styles.budgetStatus, kept && styles.budgetStatusKept]}>{kept ? "Keep" : "Cut"}</Text>
      <Text style={styles.budgetSize}>{formatMB(photo.sizeMB)}</Text>
    </Pressable>
  );
}

function QueuePhotoRow({ photo }: { photo: NativePhoto }) {
  return (
    <View style={styles.reviewRow}>
      <Image source={{ uri: photo.uri }} style={styles.reviewThumb} contentFit="cover" />
      <View style={styles.reviewCopy}>
        <Text style={styles.reviewTitle} numberOfLines={1}>
          {photo.title}
        </Text>
        <Text style={styles.mutedSmall}>
          {formatMB(photo.sizeMB)} - trim ~{formatMB(estimateTrimSavings(photo))}
        </Text>
      </View>
    </View>
  );
}

function ActionLogRow({ entry }: { entry: NativeActionLogEntry }) {
  return (
    <View style={styles.actionLogRow}>
      <View style={styles.actionLogDot} />
      <View style={styles.reviewCopy}>
        <Text style={styles.reviewTitle} numberOfLines={1}>
          {actionVerb(entry.action)} {entry.title}
        </Text>
        <Text style={styles.mutedSmall}>
          {entry.mbFreed > 0 ? `${formatMB(entry.mbFreed)} saved` : "No storage change"} - {entry.createdAt.slice(0, 10)}
        </Text>
      </View>
    </View>
  );
}

function EmptyPanel({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyPanel}>
      <Text style={styles.challengeTitle}>{title}</Text>
      <Text style={styles.muted}>{detail}</Text>
      {actionLabel && onAction ? <SecondaryButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

function SettingsScreen({
  settings,
  onChange,
  onReload,
}: {
  settings: NativeSettings;
  onChange: (patch: Partial<NativeSettings>) => void;
  onReload: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heroTitle}>Settings</Text>
      <SettingStepper
        label="Cards per round"
        value={settings.cardsPerRound}
        suffix="cards"
        min={5}
        max={30}
        step={1}
        onChange={(cardsPerRound) => onChange({ cardsPerRound })}
      />
      <Segmented
        label="Session mode"
        value={settings.sessionMode}
        options={[
          ["classic", "Classic"],
          ["endless", "Endless"],
          ["time-attack", "60 sec"],
        ]}
        onChange={(sessionMode) => onChange({ sessionMode })}
      />
      <Segmented
        label="Swipe focus"
        value={settings.targetMode}
        options={[
          ["big-or-old", "Big or old"],
          ["big-only", "Big"],
          ["old-only", "Old"],
          ["old-and-large", "Old + large"],
          ["similar", "Similar"],
          ["screenshots", "Screens"],
          ["mistakes", "Mistakes"],
          ["icloud", "iCloud"],
          ["balanced", "Balanced"],
        ]}
        onChange={(targetMode) => onChange({ targetMode })}
      />
      {settings.targetMode !== "balanced" ? (
        <>
          <SettingStepper
            label="Large threshold"
            value={settings.minSizeMB}
            suffix="MB"
            min={1}
            max={50}
            step={1}
            onChange={(minSizeMB) => onChange({ minSizeMB })}
          />
          <SettingStepper
            label="Old threshold"
            value={settings.minAgeYears}
            suffix="years"
            min={1}
            max={30}
            step={1}
            onChange={(minAgeYears) => onChange({ minAgeYears })}
          />
        </>
      ) : null}
      <SettingStepper
        label="Trim quality"
        value={Math.round(settings.trimQuality * 100)}
        suffix="%"
        min={65}
        max={98}
        step={1}
        onChange={(quality) => onChange({ trimQuality: quality / 100 })}
      />
      <BooleanSetting
        label="Larger controls"
        detail="Roomier buttons and key text for easier one-handed use."
        value={settings.largeText}
        onChange={(largeText) => onChange({ largeText })}
      />
      <BooleanSetting
        label="High contrast"
        detail="Deepens the app background and panel borders."
        value={settings.highContrast}
        onChange={(highContrast) => onChange({ highContrast })}
      />
      <PrimaryButton label="Reload with these settings" onPress={onReload} />
    </ScrollView>
  );
}

function BottomNav({ screen, onChange }: { screen: Screen; onChange: (screen: Screen) => void }) {
  const gamesActive =
    screen === "games" || screen === "this-or-that" || screen === "storage-budget" || screen === "memory-lane";

  return (
    <View style={styles.bottomNav}>
      <NavButton label="Swipe" active={screen === "swipe"} onPress={() => onChange("swipe")} />
      <NavButton label="Games" active={gamesActive} onPress={() => onChange("games")} />
      <NavButton label="Stats" active={screen === "stats"} onPress={() => onChange("stats")} />
      <NavButton label="Settings" active={screen === "settings"} onPress={() => onChange("settings")} />
    </View>
  );
}

function NavButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.navButton, active && styles.navButtonActive]}>
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  tone,
  onPress,
  large,
  disabled,
}: {
  label: string;
  tone: "keep" | "trim" | "delete";
  onPress: () => void;
  large?: boolean;
  disabled?: boolean;
}) {
  const toneStyle =
    tone === "keep" ? styles.actionKeep : tone === "trim" ? styles.actionTrim : styles.actionDelete;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, toneStyle, large && styles.actionButtonLarge, disabled && styles.actionButtonDisabled]}
    >
      <Text style={[styles.actionText, large && styles.actionTextLarge, disabled && styles.actionTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function PrimaryButton({
  label,
  danger,
  disabled,
  onPress,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, danger && styles.dangerButton, disabled && styles.primaryButtonDisabled]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.mutedSmall}>{label}</Text>
    </View>
  );
}

function SettingStepper({
  label,
  value,
  suffix,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.settingCard}>
      <View>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingValue}>
          {value} {suffix}
        </Text>
      </View>
      <View style={styles.stepper}>
        <Pressable
          style={styles.stepperButton}
          onPress={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
        >
          <Text style={styles.stepperText}>-</Text>
        </Pressable>
        <Pressable
          style={styles.stepperButton}
          onPress={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
        >
          <Text style={styles.stepperText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BooleanSetting({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.settingCard}>
      <View style={styles.booleanCopy}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.mutedSmall}>{detail}</Text>
      </View>
      <View style={[styles.toggleTrack, value && styles.toggleTrackActive]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobActive]} />
      </View>
    </Pressable>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.settingCardVertical}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.segmented}>
        {options.map(([option, optionLabel]) => (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.segment, value === option && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, value === option && styles.segmentTextActive]}>
              {optionLabel}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff7ed",
  },
  shell: {
    flex: 1,
    backgroundColor: "#fff7ed",
  },
  shellHighContrast: {
    backgroundColor: "#fffbeb",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 110,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
  },
  heroTitle: {
    color: "#1f2937",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0,
  },
  muted: {
    color: "#64748b",
    fontSize: 14,
  },
  mutedSmall: {
    color: "#64748b",
    fontSize: 12,
  },
  centerText: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  insightText: {
    color: "#c2410c",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    textAlign: "center",
  },
  swipeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 16,
  },
  swipeHeaderCopy: {
    flex: 1,
  },
  swipeTitle: {
    marginTop: 5,
    color: "#1f2937",
    fontSize: 18,
    fontWeight: "900",
  },
  swipeTitleLarge: {
    fontSize: 22,
  },
  swipeSubtitle: {
    marginTop: 5,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 17,
  },
  swipeStatusColumn: {
    alignItems: "flex-end",
    gap: 8,
  },
  queuePill: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#ffedd5",
    color: "#c2410c",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "900",
  },
  timerPill: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#fef3c7",
    color: "#b45309",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "900",
  },
  trimLimitPill: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#ecfdf5",
    color: "#15803d",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "900",
  },
  eyebrow: {
    color: "#f97316",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  trimBadge: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#fff7ed",
    color: "#c2410c",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "700",
  },
  warning: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: "#fff7ed",
    color: "#9a3412",
    padding: 12,
    fontSize: 12,
  },
  deck: {
    marginTop: 18,
    height: 492,
  },
  animatedCard: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  photoCard: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
  },
  swipeTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
  },
  keepTint: {
    backgroundColor: "rgba(34, 197, 94, 0.48)",
  },
  deleteTint: {
    backgroundColor: "rgba(239, 68, 68, 0.48)",
  },
  stackedCard: {
    transform: [{ scale: 0.96 }],
    opacity: 0.58,
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(31, 41, 55, 0.12)",
  },
  photoTop: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    color: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: "800",
  },
  photoBottom: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
  },
  photoTitle: {
    color: "#f8fafc",
    fontSize: 25,
    fontWeight: "900",
  },
  photoMeta: {
    marginTop: 4,
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
  },
  reasonRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  reason: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(248, 250, 252, 0.18)",
    color: "#f8fafc",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  actions: {
    marginTop: 20,
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    paddingVertical: 15,
    borderWidth: 1,
  },
  actionButtonLarge: {
    paddingVertical: 19,
  },
  actionButtonDisabled: {
    backgroundColor: "#f1f5f9",
    borderColor: "#cbd5e1",
    opacity: 0.75,
  },
  actionKeep: {
    backgroundColor: "#dcfce7",
    borderColor: "#22c55e",
  },
  actionTrim: {
    backgroundColor: "#ffedd5",
    borderColor: "#fb923c",
  },
  actionDelete: {
    backgroundColor: "#fee2e2",
    borderColor: "#ef4444",
  },
  actionText: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "900",
  },
  actionTextLarge: {
    fontSize: 17,
  },
  actionTextDisabled: {
    color: "#94a3b8",
  },
  reviewList: {
    marginTop: 18,
    marginBottom: 18,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 10,
    marginBottom: 8,
  },
  reviewThumb: {
    width: 58,
    height: 58,
    borderRadius: 14,
  },
  reviewCopy: {
    flex: 1,
  },
  reviewTitle: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "800",
  },
  actionLogRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 12,
  },
  actionLogDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#fb923c",
  },
  emptyPanel: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 18,
    gap: 10,
  },
  statGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  miniStat: {
    minWidth: "30%",
    flexGrow: 1,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 16,
  },
  miniStatValue: {
    color: "#1f2937",
    fontSize: 24,
    fontWeight: "900",
  },
  dashboardContent: {
    gap: 14,
  },
  gamesHero: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 18,
    gap: 8,
  },
  gameGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryGameCard: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "#f97316",
    padding: 20,
    gap: 8,
    shadowColor: "#fb923c",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 6,
  },
  primaryGameBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  primaryGameBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  primaryGameTitle: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
  },
  primaryGameDetail: {
    color: "#ffedd5",
    fontSize: 14,
    fontWeight: "800",
  },
  gameCard: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fed7aa",
    padding: 15,
    gap: 6,
  },
  gameCardActive: {
    backgroundColor: "#ffedd5",
    borderColor: "#fb923c",
  },
  gameTitle: {
    color: "#1f2937",
    fontSize: 15,
    fontWeight: "900",
  },
  gameTitleActive: {
    color: "#9a3412",
  },
  gameDetail: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  gameDetailActive: {
    color: "#9a3412",
  },
  miniGameHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  miniGameHeaderCopy: {
    flex: 1,
  },
  backButton: {
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: {
    color: "#c2410c",
    fontSize: 13,
    fontWeight: "900",
  },
  thisThatRow: {
    flexDirection: "row",
    gap: 10,
  },
  choicePhoto: {
    flex: 1,
    aspectRatio: 0.72,
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
  },
  choiceImage: {
    width: "100%",
    height: "100%",
  },
  choiceShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(31, 41, 55, 0.18)",
  },
  choiceBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    color: "#c2410c",
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "900",
  },
  choiceFooter: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
  },
  choiceTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  choiceMeta: {
    marginTop: 3,
    color: "#ffedd5",
    fontSize: 12,
    fontWeight: "800",
  },
  budgetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  budgetTile: {
    width: "31.8%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#fed7aa",
    opacity: 0.72,
  },
  budgetTileKept: {
    borderColor: "#22c55e",
    opacity: 1,
  },
  budgetImage: {
    width: "100%",
    height: "100%",
  },
  budgetStatus: {
    position: "absolute",
    top: 6,
    left: 6,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(254, 226, 226, 0.92)",
    color: "#b91c1c",
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: "900",
  },
  budgetStatusKept: {
    backgroundColor: "rgba(220, 252, 231, 0.92)",
    color: "#15803d",
  },
  budgetSize: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },
  memoryCard: {
    height: 420,
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
  },
  memoryImage: {
    width: "100%",
    height: "100%",
  },
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  yearButton: {
    minWidth: "47%",
    flexGrow: 1,
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#ffedd5",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    paddingVertical: 16,
  },
  yearButtonText: {
    color: "#9a3412",
    fontSize: 22,
    fontWeight: "900",
  },
  onboardingContent: {
    justifyContent: "center",
    gap: 14,
  },
  onboardingSteps: {
    gap: 10,
  },
  onboardingStep: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 16,
    gap: 6,
  },
  scanPanel: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 18,
    gap: 16,
  },
  scanHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  scanTotal: {
    marginTop: 3,
    color: "#1f2937",
    fontSize: 34,
    fontWeight: "900",
  },
  scanCapacity: {
    flexShrink: 1,
    color: "#9a3412",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "right",
  },
  scanMetricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  scanMetric: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 16,
    backgroundColor: "#fff7ed",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 13,
  },
  scanMetricValue: {
    color: "#1f2937",
    fontSize: 20,
    fontWeight: "900",
  },
  storageBars: {
    gap: 13,
  },
  storageBarBlock: {
    gap: 7,
  },
  storageTrack: {
    height: 13,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#ffedd5",
  },
  storageFill: {
    minWidth: 4,
    height: "100%",
    borderRadius: 999,
  },
  storageFillNow: {
    backgroundColor: "#fb923c",
  },
  storageFillTrim: {
    backgroundColor: "#22c55e",
  },
  storageFillDelete: {
    backgroundColor: "#ef4444",
  },
  scanFootnote: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
  },
  dashboardHero: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 18,
    gap: 16,
  },
  dashboardHeroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  healthScore: {
    minWidth: 74,
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#ffedd5",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  healthValue: {
    color: "#c2410c",
    fontSize: 27,
    fontWeight: "900",
  },
  healthLabel: {
    color: "#ea580c",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  dashboardCopy: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 21,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  levelCopy: {
    minWidth: 92,
  },
  levelTitle: {
    color: "#1f2937",
    fontSize: 18,
    fontWeight: "900",
  },
  levelProgress: {
    flex: 1,
    gap: 7,
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickAction: {
    flex: 1,
    minWidth: "30%",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 14,
    gap: 5,
  },
  quickActionLabel: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "900",
  },
  quickActionDetail: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },
  sectionTitleRow: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: "#1f2937",
    fontSize: 18,
    fontWeight: "900",
  },
  sectionDetail: {
    color: "#f97316",
    fontSize: 12,
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#ffedd5",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#f97316",
  },
  progressTrim: {
    backgroundColor: "#fb923c",
  },
  progressDelete: {
    backgroundColor: "#f87171",
  },
  challengeCard: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 16,
    gap: 11,
  },
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 16,
    gap: 14,
  },
  streakValue: {
    color: "#f97316",
    fontSize: 44,
    fontWeight: "900",
    lineHeight: 48,
  },
  streakDivider: {
    alignSelf: "stretch",
    width: StyleSheet.hairlineWidth,
    backgroundColor: "#fed7aa",
  },
  streakCopy: {
    flex: 1,
    gap: 5,
  },
  challengeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  challengeTitle: {
    flex: 1,
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "900",
  },
  challengeValue: {
    color: "#ea580c",
    fontSize: 16,
    fontWeight: "900",
  },
  impactPanel: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 16,
    gap: 15,
  },
  impactHeader: {
    gap: 3,
  },
  impactValue: {
    color: "#1f2937",
    fontSize: 30,
    fontWeight: "900",
  },
  impactRow: {
    gap: 8,
  },
  impactLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  impactLabel: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "800",
  },
  impactAmount: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "900",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 15,
  },
  metricValue: {
    color: "#1f2937",
    fontSize: 23,
    fontWeight: "900",
  },
  activityPanel: {
    height: 148,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 14,
  },
  activityDay: {
    flex: 1,
    alignItems: "center",
    gap: 7,
  },
  activityBarTrack: {
    width: "100%",
    height: 78,
    justifyContent: "flex-end",
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#ffedd5",
  },
  activityBar: {
    width: "100%",
    borderRadius: 999,
    backgroundColor: "#fb923c",
  },
  activityLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
  },
  activityValue: {
    color: "#1f2937",
    fontSize: 11,
    fontWeight: "900",
  },
  achievementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  achievementCard: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 14,
    gap: 9,
  },
  achievementUnlocked: {
    backgroundColor: "#ecfdf5",
    borderColor: "#86efac",
  },
  achievementStatus: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#ffedd5",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  achievementStatusText: {
    color: "#c2410c",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  achievementTitle: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "900",
  },
  settingCard: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  booleanCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTrack: {
    width: 54,
    height: 32,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#fed7aa",
    padding: 4,
  },
  toggleTrackActive: {
    backgroundColor: "#fb923c",
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#fff7ed",
  },
  toggleKnobActive: {
    transform: [{ translateX: 22 }],
    backgroundColor: "#ffffff",
  },
  settingCardVertical: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 16,
    gap: 12,
  },
  settingLabel: {
    color: "#9a3412",
    fontSize: 13,
    fontWeight: "700",
  },
  settingValue: {
    marginTop: 4,
    color: "#1f2937",
    fontSize: 20,
    fontWeight: "900",
  },
  stepper: {
    flexDirection: "row",
    gap: 8,
  },
  stepperButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#ffedd5",
  },
  stepperText: {
    color: "#c2410c",
    fontSize: 22,
    fontWeight: "900",
  },
  segmented: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  segment: {
    flex: 1,
    minWidth: "30%",
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#fff7ed",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  segmentActive: {
    backgroundColor: "#fb923c",
    borderColor: "#fb923c",
  },
  segmentText: {
    color: "#9a3412",
    fontSize: 12,
    fontWeight: "800",
  },
  segmentTextActive: {
    color: "#ffffff",
  },
  primaryButton: {
    width: "100%",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#f97316",
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  primaryButtonDisabled: {
    backgroundColor: "#fdba74",
    opacity: 0.72,
  },
  dangerButton: {
    backgroundColor: "#dc2626",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    width: "100%",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#fed7aa",
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: "#c2410c",
    fontSize: 14,
    fontWeight: "800",
  },
  bottomNav: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row",
    gap: 8,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fed7aa",
    padding: 8,
    shadowColor: "#fb923c",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 6,
  },
  navButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 11,
  },
  navButtonActive: {
    backgroundColor: "#fb923c",
  },
  navText: {
    color: "#9a3412",
    fontSize: 12,
    fontWeight: "900",
  },
  navTextActive: {
    color: "#ffffff",
  },
});
