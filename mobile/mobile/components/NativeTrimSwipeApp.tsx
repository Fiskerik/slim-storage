import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
  commitTrims,
  deletePhotos,
  estimateTrimSavings,
  loadRelatedPhotoPairs,
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
  type NativeTargetMode,
} from "../lib/native-store";
import { HomeDashboard } from "./HomeDashboard";
import { StatsDashboard } from "./StatsDashboard";
import { OnboardingCarousel } from "./OnboardingCarousel";
import { TrimScreen } from "./TrimScreen";
import { ShopScreen } from "./ShopScreen";
import { subscribeTokens, spendTokens, REWARDED_AD_TOKENS } from "../lib/tokens";
import { checkProStatus } from "../lib/purchases";
import { showRewardedAd, initAds } from "../lib/ads";

type Screen =
  | "games"
  | "swipe"
  | "this-or-that"
  | "storage-budget"
  | "memory-lane"
  | "stats"
  | "trim"
  | "shop"
  | "settings";

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
// Storage budget game: target a pool that totals 75-100 MB so user must pick ~50 MB to keep
const BUDGET_TARGET_POOL_MB = 90;
const BUDGET_KEEP_LIMIT_MB = 50;

function formatMB(value: number): string {
  return value >= 1024 ? `${(value / 1024).toFixed(2)} GB` : `${value.toFixed(1)} MB`;
}

function roundSettings(settings: NativeSettings): NativeSettings {
  return {
    ...settings,
    cardsPerRound: Math.min(30, Math.max(5, Math.round(settings.cardsPerRound) || 10)),
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

// ─── Animated ring for stats score ───────────────────────────────────────────

function AnimatedScoreRing({ score, size = 90 }: { score: number; size?: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: score,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [score]);

  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ position: "absolute", color: "#c2410c", fontSize: size * 0.28, fontWeight: "900" }}>
        {score}
      </Text>
      <Text style={{ position: "absolute", top: size * 0.6, color: "#ea580c", fontSize: 10, fontWeight: "800", textTransform: "uppercase" }}>
        score
      </Text>
    </View>
  );
}

// ─── Celebration sparkle animation ───────────────────────────────────────────

function CelebrationBurst({ visible }: { visible: boolean }) {
  const particles = useRef(
    Array.from({ length: 8 }, () => ({
      anim: new Animated.Value(0),
      angle: Math.random() * Math.PI * 2,
      color: ["#f97316", "#22c55e", "#f59e0b", "#3b82f6", "#ec4899"][Math.floor(Math.random() * 5)],
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;
    Animated.stagger(
      30,
      particles.map((p) =>
        Animated.timing(p.anim, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      )
    ).start(() => {
      particles.forEach((p) => p.anim.setValue(0));
    });
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.map((p, i) => {
        const tx = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * 60] });
        const ty = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(p.angle) * 60] });
        const op = p.anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: p.color,
              opacity: op,
              transform: [{ translateX: tx }, { translateY: ty }],
            }}
          />
        );
      })}
    </View>
  );
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
  const pendingTrimsRef = useRef<NativePhoto[]>([]);
  const [pendingTrims, setPendingTrims] = useState<NativePhoto[]>([]);
  const [tokenBalance, setTokenBalance] = useState<number>(10);
  const [isPro, setIsPro] = useState(false);
  const [adBusy, setAdBusy] = useState(false);

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
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const unsub = subscribeTokens((s) => setTokenBalance(s.tokens));
    void checkProStatus().then(setIsPro).catch(() => {});
    void initAds().catch(() => {});
    return () => unsub();
  }, []);

  async function handleWatchAd() {
    if (adBusy) return;
    setAdBusy(true);
    try {
      const got = await showRewardedAd();
      if (got > 0) {
        Alert.alert("Thanks!", `+${got} Trim Tokens added.`);
      } else {
        Alert.alert("No ad available", "Please try again in a moment.");
      }
    } finally {
      setAdBusy(false);
    }
  }

  void REWARDED_AD_TOKENS; // silence unused if only used in handler
  void spendTokens; // exported for future swipe/trim wiring


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
    // FIX 1: Guard against NaN cardsPerRound before calling MediaLibrary
    const safeCount = Math.max(1, Math.round(activeSettings.cardsPerRound) || 10);
    setLoading(true);
    setError(null);
    setRecap(null);
    setPendingDeletes([]);
    setPendingTrims([]);
    setTimeLeft(activeSettings.sessionMode === "time-attack" ? TIME_ATTACK_SECONDS : 0);
    pendingDeletesRef.current = [];
    pendingTrimsRef.current = [];
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
      const photos = await loadPhotoRound(safeCount, activeSettings, {
        avoidIds: recentSelectionIds(stats),
      });
      setQueue(photos);
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
      withDailyActivity({ ...current, sessions: current.sessions + 1 }, { sessions: 1 }),
    );
    if (pendingDeletesRef.current.length > 0 || pendingTrimsRef.current.length > 0) return;
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
          withRecentlySeenPhotos(
            withDailyActivity({ ...current, reviewed: current.reviewed + 1, kept: current.kept + 1 }, { reviewed: 1, kept: 1 }),
            [photo],
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
      // Stats commit happens in confirmActions so users can deselect items.
      advance();
      return;
    }
    if (trimsRemainingToday - pendingTrimsRef.current.length <= 0) {
      Alert.alert("Daily trim limit reached", `Free accounts can trim ${FREE_DAILY_TRIM_LIMIT} photos per day. Keep reviewing or delete photos today, and trims reset tomorrow.`);
      return;
    }
    const estimated = estimateTrimSavings(photo);
    session.trimmed += 1;
    session.freed += estimated;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Defer the actual trim to the end-of-set confirmation step so users
    // aren't interrupted with iOS delete dialogs after every swipe.
    pendingTrimsRef.current = [...pendingTrimsRef.current, photo];
    setPendingTrims(pendingTrimsRef.current);
    advance();
  }

  async function confirmActions(deletes: NativePhoto[], trims: NativePhoto[]) {
    setLoading(true);
    const requestedTrimIds = new Set(trims.map((p) => p.id));
    const requestedDeleteIds = new Set(deletes.map((p) => p.id));

    let deletedCount = 0;
    if (deletes.length > 0) {
      const res = await deletePhotos(deletes.map((p) => p.id));
      deletedCount = res.deleted;
    }

    let trimmedResults: Array<{ id: string; trimmed: boolean; savedMB?: number }> = [];
    if (trims.length > 0) {
      trimmedResults = await commitTrims(trims, settings.trimQuality);
    }
    const trimmedOkIds = new Set(trimmedResults.filter((r) => r.trimmed).map((r) => r.id));
    const actualTrimSaved = trimmedResults.reduce(
      (sum, r, i) => (r.trimmed ? sum + (r.savedMB ?? estimateTrimSavings(trims[i])) : sum),
      0,
    );

    // Commit stats for confirmed actions only.
    commitStats((current) => {
      const reviewed = deletedCount + trimmedOkIds.size;
      const deleteSaved = deletes.slice(0, deletedCount).reduce((s, p) => s + p.sizeMB, 0);
      let next = withDailyActivity(
        {
          ...current,
          reviewed: current.reviewed + reviewed,
          deleted: current.deleted + deletedCount,
          trimmed: current.trimmed + trimmedOkIds.size,
          mbFreed: +(current.mbFreed + deleteSaved + actualTrimSaved).toFixed(2),
          deleteMbFreed: +(current.deleteMbFreed + deleteSaved).toFixed(2),
          trimMbFreed: +(current.trimMbFreed + actualTrimSaved).toFixed(2),
        },
        {
          reviewed,
          deleted: deletedCount,
          trimmed: trimmedOkIds.size,
          mbFreed: deleteSaved + actualTrimSaved,
          deleteMbFreed: deleteSaved,
          trimMbFreed: actualTrimSaved,
        },
      );
      next = withRecentlySeenPhotos(next, [...deletes.slice(0, deletedCount), ...trims.filter((p) => trimmedOkIds.has(p.id))]);
      for (const p of deletes.slice(0, deletedCount)) {
        next = appendActionLog(next, createActionLogEntry(p, "delete", p.sizeMB));
      }
      for (const p of trims.filter((tp) => trimmedOkIds.has(tp.id))) {
        next = appendActionLog(next, createActionLogEntry(p, "trim", estimateTrimSavings(p)));
      }
      return next;
    });

    // Recompute session recap to reflect actual outcomes.
    sessionRef.current = {
      kept: sessionRef.current.kept,
      trimmed: trimmedOkIds.size,
      deleted: deletedCount,
      freed: +(deletes.slice(0, deletedCount).reduce((s, p) => s + p.sizeMB, 0) + actualTrimSaved).toFixed(2),
    };

    setLoading(false);
    if (deletedCount !== deletes.length || trimmedOkIds.size !== trims.length) {
      Alert.alert(
        "Some actions skipped",
        `${deletedCount}/${deletes.length} deleted and ${trimmedOkIds.size}/${trims.length} trimmed.`,
      );
    }
    // Clear any items the user deselected from the pending queues too.
    pendingDeletesRef.current = pendingDeletesRef.current.filter(
      (p) => !requestedDeleteIds.has(p.id),
    );
    pendingTrimsRef.current = pendingTrimsRef.current.filter(
      (p) => !requestedTrimIds.has(p.id),
    );
    setPendingDeletes(pendingDeletesRef.current);
    setPendingTrims(pendingTrimsRef.current);
    setRecap({ ...sessionRef.current });
  }

  function cancelPendingActions() {
    pendingDeletesRef.current = [];
    pendingTrimsRef.current = [];
    setPendingDeletes([]);
    setPendingTrims([]);
    // Reset session totals since none of the pending actions were applied.
    sessionRef.current = {
      kept: sessionRef.current.kept,
      trimmed: 0,
      deleted: 0,
      freed: 0,
    };
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
      Alert.alert("Daily trim limit reached", `Free accounts can trim ${FREE_DAILY_TRIM_LIMIT} photos per day.`);
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
        { ...current, reviewed: current.reviewed + candidates.length, trimmed: current.trimmed + candidates.length, mbFreed: +(current.mbFreed + estimated).toFixed(2), trimMbFreed: +(current.trimMbFreed + estimated).toFixed(2) },
        { reviewed: candidates.length, trimmed: candidates.length, mbFreed: estimated, trimMbFreed: estimated },
      );
      return candidates.reduce((sf, photo) => appendActionLog(sf, createActionLogEntry(photo, "trim", estimateTrimSavings(photo))), withRecentlySeenPhotos(next, candidates));
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

  async function confirmThisOrThatOutcome(
    kept: NativePhoto[],
    deleted: NativePhoto[],
    toTrim: NativePhoto[],
  ): Promise<number> {
    const available = Math.max(0, FREE_DAILY_TRIM_LIMIT - dailyFor(stats, dateKey()).trimmed);
    const trimCandidates = toTrim.filter((photo) => !photo.isCloudAsset).slice(0, available);
    if (trimCandidates.length < toTrim.length) {
      Alert.alert(
        "Not enough trims available",
        `You have ${available}/${FREE_DAILY_TRIM_LIMIT} free trims left today. Cloud-only photos also cannot be trimmed until downloaded.`,
      );
      return 0;
    }

    return new Promise((resolve) => {
      Alert.alert("Apply This or That choices?", `Delete ${deleted.length} and trim ${toTrim.length} photo${deleted.length + toTrim.length === 1 ? "" : "s"}.`, [
        { text: "Cancel", style: "cancel", onPress: () => resolve(0) },
        {
          text: "Apply",
          onPress: async () => {
            const deleteResult = deleted.length > 0 ? await deletePhotos(deleted.map((photo) => photo.id)) : { deleted: 0 };
            const deletedPhotos = deleted.slice(0, deleteResult.deleted);
            setTrimmingCount((count) => count + trimCandidates.length);
            const results = await Promise.all(trimCandidates.map((photo) => trimPhoto(photo, settings.trimQuality)));
            setTrimmingCount((count) => Math.max(0, count - trimCandidates.length));
            const trimmed = trimCandidates.filter((_, index) => results[index]?.trimmed);
            const trimmedIds = new Set(trimmed.map((photo) => photo.id));
            const actualTrimSavings = trimCandidates.reduce(
              (sum, photo, index) =>
                results[index]?.trimmed ? sum + (results[index]?.savedMB ?? estimateTrimSavings(photo)) : sum,
              0,
            );
            const deleteSavings = deletedPhotos.reduce((sum, photo) => sum + photo.sizeMB, 0);
            const reviewed = [...kept, ...deletedPhotos, ...trimmed];
            const reviewedForCooldown = [...kept, ...deleted, ...toTrim];
            if (reviewed.length > 0) {
              commitStats((current) => {
                const next = withDailyActivity(
                  {
                    ...current,
                    reviewed: current.reviewed + reviewed.length,
                    kept: current.kept + kept.length,
                    deleted: current.deleted + deletedPhotos.length,
                    trimmed: current.trimmed + trimmed.length,
                    mbFreed: +(current.mbFreed + deleteSavings + actualTrimSavings).toFixed(2),
                    deleteMbFreed: +(current.deleteMbFreed + deleteSavings).toFixed(2),
                    trimMbFreed: +(current.trimMbFreed + actualTrimSavings).toFixed(2),
                  },
                  {
                    reviewed: reviewed.length,
                    kept: kept.length,
                    deleted: deletedPhotos.length,
                    trimmed: trimmed.length,
                    mbFreed: deleteSavings + actualTrimSavings,
                    deleteMbFreed: deleteSavings,
                    trimMbFreed: actualTrimSavings,
                  },
                );
                const withCooldown = withRecentlySeenPhotos(next, reviewedForCooldown);
                return reviewed.reduce((sf, photo) => {
                  const isDeleted = deletedPhotos.some((item) => item.id === photo.id);
                  const isTrimmed = trimmedIds.has(photo.id);
                  return appendActionLog(
                    sf,
                    createActionLogEntry(
                      photo,
                      isDeleted ? "delete" : isTrimmed ? "trim" : "keep",
                      isDeleted ? photo.sizeMB : isTrimmed ? estimateTrimSavings(photo) : 0,
                    ),
                  );
                }, withCooldown);
              });
            }
            if (deleteResult.deleted !== deleted.length || trimmed.length !== trimCandidates.length) {
              Alert.alert("Apply incomplete", `${deleteResult.deleted}/${deleted.length} deleted and ${trimmed.length}/${trimCandidates.length} trimmed.`);
            }
            console.log("[NativeTrimSwipe] This-or-That trim result", {
              requested: trimCandidates.length,
              trimmed: trimmed.length,
            });
            resolve(reviewed.length);
          },
        },
      ]);
    });
  }

  async function confirmStorageBudgetOutcome(
    kept: NativePhoto[],
    deleted: NativePhoto[],
    toTrim: NativePhoto[],
  ): Promise<number> {
    const deleteSavings = deleted.reduce((sum, photo) => sum + photo.sizeMB, 0);
    const trimSavings = toTrim.reduce((sum, photo) => sum + estimateTrimSavings(photo), 0);
    if (kept.length + deleted.length + toTrim.length === 0) return 0;

    return new Promise((resolve) => {
      Alert.alert(
        "Apply your budget choices?",
        `Delete ${deleted.length} and trim ${toTrim.length} photo${deleted.length + toTrim.length === 1 ? "" : "s"} for about ${formatMB(deleteSavings + trimSavings)} saved.`,
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(0) },
          {
            text: "Apply",
            onPress: async () => {
              const deleteResult = deleted.length > 0 ? await deletePhotos(deleted.map((photo) => photo.id)) : { deleted: 0 };
              const deletedPhotos = deleted.slice(0, deleteResult.deleted);
              setTrimmingCount((count) => count + toTrim.length);
              const trimResults = await Promise.all(toTrim.map((photo) => trimPhoto(photo, settings.trimQuality)));
              setTrimmingCount((count) => Math.max(0, count - toTrim.length));
              const trimmedPhotos = toTrim.filter((_, index) => trimResults[index]?.trimmed);
              const trimmedIds = new Set(trimmedPhotos.map((photo) => photo.id));
              const actualTrimSavings = toTrim.reduce(
                (sum, photo, index) =>
                  trimResults[index]?.trimmed ? sum + (trimResults[index]?.savedMB ?? estimateTrimSavings(photo)) : sum,
                0,
              );
              const actualDeleteSavings = deletedPhotos.reduce((sum, photo) => sum + photo.sizeMB, 0);
              const reviewed = [...kept, ...deletedPhotos, ...trimmedPhotos];
              const reviewedForCooldown = [...kept, ...deleted, ...toTrim];

              commitStats((current) => {
                const next = withDailyActivity(
                  {
                    ...current,
                    reviewed: current.reviewed + reviewed.length,
                    kept: current.kept + kept.length,
                    deleted: current.deleted + deletedPhotos.length,
                    trimmed: current.trimmed + trimmedPhotos.length,
                    mbFreed: +(current.mbFreed + actualDeleteSavings + actualTrimSavings).toFixed(2),
                    deleteMbFreed: +(current.deleteMbFreed + actualDeleteSavings).toFixed(2),
                    trimMbFreed: +(current.trimMbFreed + actualTrimSavings).toFixed(2),
                  },
                  {
                    reviewed: reviewed.length,
                    kept: kept.length,
                    deleted: deletedPhotos.length,
                    trimmed: trimmedPhotos.length,
                    mbFreed: actualDeleteSavings + actualTrimSavings,
                    deleteMbFreed: actualDeleteSavings,
                    trimMbFreed: actualTrimSavings,
                  },
                );
                const withCooldown = withRecentlySeenPhotos(next, reviewedForCooldown);
                return reviewed.reduce((sf, photo) => {
                  const action: Action = deletedPhotos.some((item) => item.id === photo.id)
                    ? "delete"
                    : trimmedIds.has(photo.id)
                      ? "trim"
                      : "keep";
                  const mbFreed = action === "delete" ? photo.sizeMB : action === "trim" ? estimateTrimSavings(photo) : 0;
                  return appendActionLog(sf, createActionLogEntry(photo, action, mbFreed));
                }, withCooldown);
              });

              if (deleteResult.deleted !== deleted.length || trimmedPhotos.length !== toTrim.length) {
                Alert.alert(
                  "Budget partly applied",
                  `${deleteResult.deleted}/${deleted.length} deleted and ${trimmedPhotos.length}/${toTrim.length} trimmed.`,
                );
              }
              resolve(deletedPhotos.length + trimmedPhotos.length + kept.length);
            },
          },
        ],
      );
    });
  }

  async function confirmMemoryLaneOutcome(
    kept: NativePhoto[],
    deleted: NativePhoto[],
    toTrim: NativePhoto[],
  ): Promise<number> {
    const deleteSavings = deleted.reduce((sum, photo) => sum + photo.sizeMB, 0);
    const trimSavings = toTrim.reduce((sum, photo) => sum + estimateTrimSavings(photo), 0);

    return new Promise((resolve) => {
      Alert.alert(
        "Apply Memory Lane choices?",
        `Delete ${deleted.length} and trim ${toTrim.length} photo${deleted.length + toTrim.length === 1 ? "" : "s"} for about ${formatMB(deleteSavings + trimSavings)} saved.`,
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(0) },
          {
            text: "Apply",
            onPress: async () => {
              const deleteResult = deleted.length > 0 ? await deletePhotos(deleted.map((photo) => photo.id)) : { deleted: 0 };
              const deletedPhotos = deleted.slice(0, deleteResult.deleted);
              setTrimmingCount((count) => count + toTrim.length);
              const trimResults = await Promise.all(toTrim.map((photo) => trimPhoto(photo, settings.trimQuality)));
              setTrimmingCount((count) => Math.max(0, count - toTrim.length));
              const trimmedPhotos = toTrim.filter((_, index) => trimResults[index]?.trimmed);
              const trimmedIds = new Set(trimmedPhotos.map((photo) => photo.id));
              const actualTrimSavings = toTrim.reduce(
                (sum, photo, index) =>
                  trimResults[index]?.trimmed ? sum + (trimResults[index]?.savedMB ?? estimateTrimSavings(photo)) : sum,
                0,
              );
              const actualDeleteSavings = deletedPhotos.reduce((sum, photo) => sum + photo.sizeMB, 0);
              const reviewed = [...kept, ...deletedPhotos, ...trimmedPhotos];
              const reviewedForCooldown = [...kept, ...deleted, ...toTrim];

              commitStats((current) => {
                const next = withDailyActivity(
                  {
                    ...current,
                    reviewed: current.reviewed + reviewed.length,
                    kept: current.kept + kept.length,
                    deleted: current.deleted + deletedPhotos.length,
                    trimmed: current.trimmed + trimmedPhotos.length,
                    mbFreed: +(current.mbFreed + actualDeleteSavings + actualTrimSavings).toFixed(2),
                    deleteMbFreed: +(current.deleteMbFreed + actualDeleteSavings).toFixed(2),
                    trimMbFreed: +(current.trimMbFreed + actualTrimSavings).toFixed(2),
                  },
                  {
                    reviewed: reviewed.length,
                    kept: kept.length,
                    deleted: deletedPhotos.length,
                    trimmed: trimmedPhotos.length,
                    mbFreed: actualDeleteSavings + actualTrimSavings,
                    deleteMbFreed: actualDeleteSavings,
                    trimMbFreed: actualTrimSavings,
                  },
                );
                const withCooldown = withRecentlySeenPhotos(next, reviewedForCooldown);
                return reviewed.reduce((sf, photo) => {
                  const action: Action = deletedPhotos.some((item) => item.id === photo.id)
                    ? "delete"
                    : trimmedIds.has(photo.id)
                      ? "trim"
                      : "keep";
                  const mbFreed = action === "delete" ? photo.sizeMB : action === "trim" ? estimateTrimSavings(photo) : 0;
                  return appendActionLog(sf, createActionLogEntry(photo, action, mbFreed));
                }, withCooldown);
              });

              if (deleteResult.deleted !== deleted.length || trimmedPhotos.length !== toTrim.length) {
                Alert.alert(
                  "Memory Lane partly applied",
                  `${deleteResult.deleted}/${deleted.length} deleted and ${trimmedPhotos.length}/${toTrim.length} trimmed.`,
                );
              }
              resolve(reviewed.length);
            },
          },
        ],
      );
    });
  }

  function handleSingleTrimComplete(photo: NativePhoto, savedMB: number) {
    sessionRef.current.trimmed += 1;
    sessionRef.current.freed += savedMB;
    commitStats((current) =>
      appendActionLog(
        withRecentlySeenPhotos(
          withDailyActivity(
            {
              ...current,
              reviewed: current.reviewed + 1,
              trimmed: current.trimmed + 1,
              mbFreed: +(current.mbFreed + savedMB).toFixed(2),
              trimMbFreed: +(current.trimMbFreed + savedMB).toFixed(2),
            },
            { reviewed: 1, trimmed: 1, mbFreed: savedMB, trimMbFreed: savedMB },
          ),
          [photo],
        ),
        createActionLogEntry(photo, "trim", savedMB),
      ),
    );
  }

  function pickCategoryStart(key: "large" | "old" | "screenshots" | "similar") {
    const map: Record<typeof key, NativeTargetMode> = {
      large: "big-only",
      old: "old-only",
      screenshots: "screenshots",
      similar: "similar",
    };
    startGame({ targetMode: map[key], sessionMode: "classic" });
  }

  const todayStats = dailyFor(stats, dateKey());
  const recentPhotosForHero: NativePhoto[] = queue.slice(0, 3);
  const potentialFromScan = libraryScan
    ? libraryScan.trimSavingsMB + libraryScan.deleteSavingsMB
    : Math.max(stats.mbFreed * 2, 500);

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
          <OnboardingCarousel
            scan={libraryScan}
            scanBusy={scanBusy}
            scanError={scanError}
            scanProgress={scanProgress}
            permissionDenied={permissionDenied}
            permissionLimited={permissionLimited}
            onScan={runLibraryScan}
            onDone={completeOnboarding}
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
          <StatsDashboard
            stats={stats}
            onStartRound={() => { setScreen("swipe"); void loadRound(); }}
            onOpenSettings={() => setScreen("settings")}
            onShare={shareProgress}
          />
        ) : screen === "this-or-that" ? (
          <ThisOrThatScreen
            settings={settings}
            onBack={() => setScreen("games")}
            onConfirmOutcome={confirmThisOrThatOutcome}
          />
        ) : screen === "storage-budget" ? (
          <StorageBudgetScreen
            settings={settings}
            trimsRemaining={trimsRemainingToday}
            avoidIds={recentSelectionIds(stats)}
            onBack={() => setScreen("games")}
            onConfirmOutcome={confirmStorageBudgetOutcome}
          />
        ) : screen === "memory-lane" ? (
          <MemoryLaneScreen
            settings={settings}
            avoidIds={recentSelectionIds(stats)}
            trimsRemaining={trimsRemainingToday}
            onBack={() => setScreen("games")}
            onConfirmOutcome={confirmMemoryLaneOutcome}
          />
        ) : screen === "trim" ? (
          <TrimScreen
            settings={settings}
            trimsRemaining={trimsRemainingToday}
            trimLimit={FREE_DAILY_TRIM_LIMIT}
            avoidIds={recentSelectionIds(stats)}
            onBack={() => setScreen("games")}
            onTrimmed={handleSingleTrimComplete}
          />
        ) : screen === "shop" ? (
          <ShopScreen onBack={() => setScreen("games")} />
        ) : screen === "games" ? (
          <HomeDashboard
            stats={stats}
            today={todayStats}
            queue={queue}
            recentPhotos={recentPhotosForHero}
            totalFreedMB={stats.mbFreed}
            potentialMB={potentialFromScan}
            scanBusy={scanBusy}
            tokens={tokenBalance}
            isPro={isPro}
            adBusy={adBusy}
            onStartSwipe={() => { setScreen("swipe"); void loadRound(); }}
            onOpenTrim={() => setScreen("trim")}
            onOpenGames={() => setScreen("this-or-that")}
            onOpenShop={() => setScreen("shop")}
            onWatchAd={handleWatchAd}
            onQuickScan={runLibraryScan}
            onPickCategory={pickCategoryStart}
            onShare={shareProgress}
          />
        ) : (
          <SettingsScreen settings={settings} samplePhoto={top ?? queue[0]} onChange={updateSettings} onReload={loadRound} />
        )}

        {statsLoaded && stats.onboardingComplete ? <BottomNav screen={screen} onChange={setScreen} /> : null}
      </View>
    </SafeAreaView>
  );
}


// ─── Swipe Screen ─────────────────────────────────────────────────────────────

function SwipeScreen({
  top, next, queueCount, loading, error, permissionDenied, permissionLimited,
  settings, recap, pendingDeletes, trimmingCount, timeLeft, largeControls,
  trimsRemaining, trimLimit, onAction, onReload, onOpenSettings,
  onConfirmDeletes, onUndoDeletes, onShare,
}: {
  top?: NativePhoto; next?: NativePhoto; queueCount: number; loading: boolean;
  error: string | null; permissionDenied: boolean; permissionLimited: boolean;
  settings: NativeSettings; recap: SessionRecap | null; pendingDeletes: NativePhoto[];
  trimmingCount: number; timeLeft: number; largeControls: boolean; trimsRemaining: number;
  trimLimit: number; onAction: (photo: NativePhoto, action: Action) => void;
  onReload: () => void; onOpenSettings: () => void;
  onConfirmDeletes: (photos: NativePhoto[]) => void; onUndoDeletes: () => void;
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
        <Text style={styles.centerText}>TrimSwipe needs photo access to build your cleanup deck.</Text>
        <PrimaryButton label="Open iOS Settings" onPress={onOpenSettings} />
        <SecondaryButton label="Try again" onPress={onReload} />
      </Centered>
    );
  }
  if (pendingDeletes.length > 0 && !top) {
    return <DeleteReview photos={pendingDeletes} onConfirm={() => onConfirmDeletes(pendingDeletes)} onCancel={onUndoDeletes} />;
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
          <Text style={[styles.swipeTitle, largeControls && styles.swipeTitleLarge]}>{targetLabel(settings)}</Text>
          <Text style={styles.swipeSubtitle}>{sessionModeLabel(settings.sessionMode)} mode. A cleaner set of photos, one quick decision at a time.</Text>
        </View>
        <View style={styles.swipeStatusColumn}>
          <Text style={styles.queuePill}>{queueCount} left</Text>
          <Text style={styles.trimLimitPill}>{trimsRemaining}/{trimLimit} trims</Text>
          {settings.sessionMode === "time-attack" ? <Text style={styles.timerPill}>{timeLeft}s</Text> : null}
          {trimmingCount > 0 ? <Text style={styles.trimBadge}>Trimming {trimmingCount}</Text> : null}
        </View>
      </View>
      {permissionLimited ? <Text style={styles.warning}>Limited photo access is enabled. Some photos may be hidden.</Text> : null}
      <View style={styles.deck}>
        {next ? <PhotoCard photo={next} stacked /> : null}
        {top ? <SwipeablePhotoCard photo={top} onAction={(action) => onAction(top, action)} /> : null}
      </View>
      <View style={styles.actions}>
        <ActionButton label="Keep" tone="keep" large={largeControls} onPress={() => top && onAction(top, "keep")} />
        <ActionButton label={trimsRemaining > 0 ? "Trim" : "Limit hit"} tone="trim" large={largeControls} disabled={trimsRemaining <= 0} onPress={() => top && onAction(top, "trim")} />
        <ActionButton label="Delete" tone="delete" large={largeControls} onPress={() => top && onAction(top, "delete")} />
      </View>
    </View>
  );
}

function SwipeablePhotoCard({ photo, onAction }: { photo: NativePhoto; onAction: (action: Action) => void }) {
  const pan = useRef(new Animated.ValueXY()).current;
  useEffect(() => { pan.setValue({ x: 0, y: 0 }); }, [pan, photo.id]);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -SWIPE_THRESHOLD && Math.abs(gesture.dy) > Math.abs(gesture.dx)) { onAction("trim"); return; }
          if (gesture.dx > SWIPE_THRESHOLD) { onAction("delete"); return; }
          if (gesture.dx < -SWIPE_THRESHOLD) { onAction("keep"); return; }
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true, tension: 70, friction: 8 }).start();
        },
      }),
    [onAction, pan],
  );
  const rotate = pan.x.interpolate({ inputRange: [-180, 0, 180], outputRange: ["-12deg", "0deg", "12deg"] });
  const keepOpacity = pan.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, -20, 0], outputRange: [0.38, 0.14, 0], extrapolate: "clamp" });
  const deleteOpacity = pan.x.interpolate({ inputRange: [0, 20, SWIPE_THRESHOLD], outputRange: [0, 0.14, 0.38], extrapolate: "clamp" });
  return (
    <Animated.View {...panResponder.panHandlers} style={[styles.animatedCard, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] }]}>
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
        <Text style={styles.photoTitle} numberOfLines={1}>{photo.title}</Text>
        <Text style={styles.photoMeta}>{photo.month} {photo.year} - {photo.device}</Text>
        <View style={styles.reasonRow}>
          {photo.cleanupReasons.map((reason) => <Text key={reason} style={styles.reason}>{reason}</Text>)}
          {photo.isCloudAsset ? <Text style={styles.reason}>iCloud</Text> : null}
        </View>
      </View>
    </View>
  );
}

// FIX 2: Add proper bottom padding so delete list isn't obscured by nav bar
function DeleteReview({ photos, onConfirm, onCancel }: { photos: NativePhoto[]; onConfirm: () => void; onCancel: () => void }) {
  const total = photos.reduce((sum, photo) => sum + photo.sizeMB, 0);
  return (
    <View style={styles.content}>
      <Text style={styles.heroTitle}>Confirm deletion</Text>
      <Text style={styles.muted}>{photos.length} photo{photos.length === 1 ? "" : "s"} will move to Recently Deleted.</Text>
      <ScrollView style={styles.reviewList} contentContainerStyle={styles.reviewListContent}>
        {photos.map((photo) => (
          <View key={photo.id} style={styles.reviewRow}>
            <Image source={{ uri: photo.uri }} style={styles.reviewThumb} contentFit="cover" />
            <View style={styles.reviewCopy}>
              <Text style={styles.reviewTitle} numberOfLines={1}>{photo.title}</Text>
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
  const trimShare = recap.freed > 0 ? Math.min(1, (recap.trimmed * 3) / Math.max(1, total)) : 0;
  const deleteShare = recap.freed > 0 ? Math.min(1, (recap.deleted * 3) / Math.max(1, total)) : 0;
  const insight = recap.deleted > recap.trimmed
    ? "Deletes did the heavy lifting this round."
    : recap.trimmed > 0
      ? "Trims quietly reclaimed space without losing memories."
      : "A light pass still keeps the camera roll intentional.";
  return (
    <Centered>
      <View style={styles.recapBadge}>
        <Text style={styles.recapBadgeIcon}>✓</Text>
      </View>
      <Text style={styles.heroTitle}>Set complete</Text>
      <Text style={styles.centerText}>You reviewed {total} photos and freed about {formatMB(recap.freed)}.</Text>
      <Text style={styles.insightText}>{insight}</Text>
      <View style={styles.recapImpactCard}>
        <Text style={styles.eyebrow}>Round impact</Text>
        <Text style={styles.recapImpactValue}>{formatMB(recap.freed)}</Text>
        <ImpactRow label="Trim momentum" value={`${recap.trimmed} photos`} progress={trimShare} tone="trim" />
        <ImpactRow label="Delete momentum" value={`${recap.deleted} photos`} progress={deleteShare} tone="delete" />
      </View>
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

// ─── Stats Screen (FIX 5: visual redesign) ───────────────────────────────────

function StatsScreen({ stats, onStartRound, onOpenSettings, onShare }: {
  stats: NativeStats; onStartRound: () => void; onOpenSettings: () => void; onShare: () => void;
}) {
  const today = dailyFor(stats, dateKey());
  const week = sumDays(stats, 7);
  const streak = currentStreak(stats);
  const trimsInARow = trimStreak(stats);
  const health = storageHealthScore(stats, week, streak);
  const level = levelInfo(stats);
  const videoText = stats.mbFreed > 0
    ? `≈ ${Math.max(1, Math.round(stats.mbFreed / FOUR_K_VIDEO_MB_PER_MINUTE))} min of 4K video reclaimed`
    : "Start reviewing to build your impact story.";

  const achievements: Achievement[] = [
    { title: "Daily rhythm", detail: `${today.reviewed}/${DAILY_REVIEW_TARGET} today`, progress: clampProgress(today.reviewed, DAILY_REVIEW_TARGET), unlocked: today.reviewed >= DAILY_REVIEW_TARGET },
    { title: "Weekly saver", detail: `${formatMB(week.mbFreed)} / ${formatMB(WEEKLY_SAVINGS_TARGET_MB)}`, progress: clampProgress(week.mbFreed, WEEKLY_SAVINGS_TARGET_MB), unlocked: week.mbFreed >= WEEKLY_SAVINGS_TARGET_MB },
    { title: "Metadata master", detail: `${stats.trimmed}/50 trims`, progress: clampProgress(stats.trimmed, 50), unlocked: stats.trimmed >= 50 },
    { title: "Heavy hitter", detail: `${formatMB(stats.mbFreed)} / 1 GB`, progress: clampProgress(stats.mbFreed, 1024), unlocked: stats.mbFreed >= 1024 },
  ];

  return (
    <ScrollView contentContainerStyle={styles.statsContent}>
      {/* Hero health card */}
      <View style={styles.statsHero}>
        <View style={styles.statsHeroLeft}>
          <Text style={styles.eyebrow}>Storage Health</Text>
          <Text style={styles.statsHeroTitle}>{health < 60 ? "Needs work" : health < 80 ? "Getting there" : "Looking great"}</Text>
          <Text style={styles.statsHeroCopy}>{videoText}</Text>
          <View style={styles.levelRowInline}>
            <Text style={styles.levelLabel}>Lv {level.level} · {level.title}</Text>
          </View>
          <View style={styles.levelBarTrack}>
            <View style={[styles.levelBarFill, { width: progressWidth(level.progress) }]} />
          </View>
          <Text style={styles.mutedSmall}>{level.next}</Text>
        </View>
        <AnimatedScoreRing score={health} size={88} />
      </View>

      {/* Quick action strip */}
      <View style={styles.statsActionStrip}>
        <Pressable onPress={onStartRound} style={styles.statsActionBtn}>
          <Text style={styles.statsActionIcon}>▶</Text>
          <Text style={styles.statsActionLabel}>Start round</Text>
        </Pressable>
        <Pressable onPress={onOpenSettings} style={styles.statsActionBtn}>
          <Text style={styles.statsActionIcon}>⚙</Text>
          <Text style={styles.statsActionLabel}>Tune focus</Text>
        </Pressable>
        <Pressable onPress={onShare} style={styles.statsActionBtn}>
          <Text style={styles.statsActionIcon}>↑</Text>
          <Text style={styles.statsActionLabel}>Share</Text>
        </Pressable>
      </View>

      {/* Impact summary */}
      <View style={styles.impactSummaryRow}>
        <ImpactPill label="Freed" value={formatMB(stats.mbFreed)} accent="#f97316" />
        <ImpactPill label="Reviewed" value={String(stats.reviewed)} accent="#3b82f6" />
        <ImpactPill label="Deleted" value={String(stats.deleted)} accent="#ef4444" />
        <ImpactPill label="Trimmed" value={String(stats.trimmed)} accent="#22c55e" />
      </View>

      {/* Streak + today */}
      <View style={styles.streakRow}>
        <View style={styles.streakHalf}>
          <Text style={styles.eyebrow}>Streak</Text>
          <Text style={styles.streakBigNum}>{streak}</Text>
          <Text style={styles.mutedSmall}>days active</Text>
        </View>
        <View style={styles.streakDivider} />
        <View style={styles.streakHalf}>
          <Text style={styles.eyebrow}>Today</Text>
          <Text style={styles.streakBigNum}>{today.reviewed}</Text>
          <Text style={styles.mutedSmall}>photos reviewed</Text>
        </View>
      </View>

      {/* Activity bar chart */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Last 7 days</Text>
      </View>
      <ActivityBars stats={stats} />

      {/* Challenges */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Challenges</Text>
        {streak > 0 ? <Text style={styles.sectionBadge}>{streak}-day streak 🔥</Text> : null}
      </View>
      <ChallengeCard title="Clean 10 photos today" value={`${today.reviewed}/${DAILY_REVIEW_TARGET}`} detail={`${today.trimmed + today.deleted} cleaned, ${formatMB(today.mbFreed)} reclaimed`} progress={clampProgress(today.reviewed, DAILY_REVIEW_TARGET)} />
      <ChallengeCard title="Save 500 MB this week" value={formatMB(week.mbFreed)} detail={`${week.reviewed} reviewed across 7 days`} progress={clampProgress(week.mbFreed, WEEKLY_SAVINGS_TARGET_MB)} />

      {/* Trim savings grid */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Trim savings</Text>
        <Text style={styles.sectionDetail}>week / month / year</Text>
      </View>
      <View style={styles.metricGrid}>
        <MetricCard label="Today" value={formatMB(today.trimMbFreed)} />
        <MetricCard label="This week" value={formatMB(week.trimMbFreed)} />
        <MetricCard label="This month" value={formatMB(monthStats(stats).trimMbFreed)} />
        <MetricCard label="This year" value={formatMB(yearStats(stats).trimMbFreed)} />
      </View>

      {/* Trim streak */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>TrimStreak</Text>
        {trimsInARow > 0 ? <Text style={styles.sectionDetail}>{trimsInARow} days active</Text> : null}
      </View>
      <View style={styles.streakCard}>
        <Text style={styles.streakValue}>{trimsInARow}</Text>
        <View style={styles.streakDivider} />
        <View style={styles.streakCopy}>
          <Text style={styles.challengeTitle}>{today.trimmed}/{FREE_DAILY_TRIM_LIMIT} trims today</Text>
          <Text style={styles.mutedSmall}>Free trims reset daily.</Text>
        </View>
      </View>

      {/* Badges */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Badges</Text>
      </View>
      <AchievementGrid achievements={achievements} />
    </ScrollView>
  );
}

function ImpactPill({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={[styles.impactPill, { borderColor: accent + "33" }]}>
      <Text style={[styles.impactPillValue, { color: accent }]}>{value}</Text>
      <Text style={styles.impactPillLabel}>{label}</Text>
    </View>
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

function QuickActionButton({ label, detail, onPress }: { label: string; detail: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.quickAction}>
      <Text style={styles.quickActionLabel}>{label}</Text>
      <Text style={styles.quickActionDetail} numberOfLines={1}>{detail}</Text>
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

function ChallengeCard({ title, value, detail, progress }: { title: string; value: string; detail: string; progress: number }) {
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
  return (
    <View style={styles.impactPanel}>
      <View style={styles.impactHeader}>
        <Text style={styles.impactValue}>{formatMB(total)}</Text>
        <Text style={styles.mutedSmall}>Total estimated reclaimed</Text>
      </View>
      <ImpactRow label="Trim" value={formatMB(trimMB)} progress={total > 0 ? trimMB / total : 0} tone="trim" />
      <ImpactRow label="Delete" value={formatMB(deleteMB)} progress={total > 0 ? deleteMB / total : 0} tone="delete" />
    </View>
  );
}

function ImpactRow({ label, value, progress, tone }: { label: string; value: string; progress: number; tone: "trim" | "delete" }) {
  return (
    <View style={styles.impactRow}>
      <View style={styles.impactLabelRow}>
        <Text style={styles.impactLabel}>{label}</Text>
        <Text style={styles.impactAmount}>{value}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, tone === "trim" ? styles.progressTrim : styles.progressDelete, { width: progressWidth(progress) }]} />
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
    return { key, label: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3), stats: dailyFor(stats, key) };
  });
  const maxReviewed = Math.max(1, ...days.map((day) => day.stats.reviewed));
  return (
    <View style={styles.activityPanel}>
      {days.map((day) => (
        <View key={day.key} style={styles.activityDay}>
          <View style={styles.activityBarTrack}>
            <View style={[styles.activityBar, { height: percentValue(Math.max(8, (day.stats.reviewed / maxReviewed) * 100)) }]} />
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
        <View key={achievement.title} style={[styles.achievementCard, achievement.unlocked && styles.achievementUnlocked]}>
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

// ─── Onboarding ───────────────────────────────────────────────────────────────

function OnboardingScreen({ scan, scanBusy, scanError, scanProgress, permissionDenied, permissionLimited, onScan, onDone, onOpenSettings }: {
  scan: NativeLibraryScan | null; scanBusy: boolean; scanError: string | null;
  scanProgress: NativeLibraryScanProgress | null; permissionDenied: boolean; permissionLimited: boolean;
  onScan: () => void; onDone: () => void; onOpenSettings: () => void;
}) {
  const progressText = scanProgress?.total ? `Scanning ${scanProgress.scanned}/${scanProgress.total} photos...` : scanProgress ? `Scanning ${scanProgress.scanned} photos...` : "Scanning...";
  return (
    <ScrollView contentContainerStyle={[styles.content, styles.onboardingContent]}>
      <View style={styles.dashboardHero}>
        <Text style={styles.eyebrow}>Welcome</Text>
        <Text style={styles.heroTitle}>See what your camera roll is costing.</Text>
        <Text style={styles.dashboardCopy}>Start with a scan. TrimSwipe estimates your photo storage, how much trimming can save, and how much space likely duplicates or bad shots could free if deleted.</Text>
        {permissionLimited ? <Text style={styles.warning}>Limited photo access is enabled.</Text> : null}
        {scanError ? <Text style={styles.warning}>{scanError}</Text> : null}
        <PrimaryButton label={scanBusy ? progressText : scan ? "Scan again" : "Scan photo library"} disabled={scanBusy} onPress={onScan} />
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
  const capacityMB = scan.deviceCapacityMB && scan.deviceCapacityMB > 0 ? scan.deviceCapacityMB : Math.max(1, scan.totalSizeMB);
  const afterTrimMB = Math.max(0, scan.totalSizeMB - scan.trimSavingsMB);
  const afterDeleteMB = Math.max(0, scan.totalSizeMB - scan.deleteSavingsMB);
  const capacityLabel = scan.deviceCapacityMB ? `${formatMB(scan.deviceCapacityMB)} device capacity` : "Photo library size used as scale";
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
        <StorageBar label="Photo library now" detail={`${formatMB(scan.totalSizeMB)} allocated`} valueMB={scan.totalSizeMB} capacityMB={capacityMB} tone="now" />
        <StorageBar label="After Trim" detail={`${formatMB(scan.trimSavingsMB)} estimated savings`} valueMB={afterTrimMB} capacityMB={capacityMB} tone="trim" />
        <StorageBar label="After Delete" detail={`${formatMB(scan.deleteSavingsMB)} from duplicates and likely mistakes`} valueMB={afterDeleteMB} capacityMB={capacityMB} tone="delete" />
      </View>
      <Text style={styles.scanFootnote}>Delete estimate includes {scan.duplicateRemovalCount} duplicate candidates and {scan.mistakeCount} likely blurry, dark, or accidental photos.</Text>
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

function StorageBar({ label, detail, valueMB, capacityMB, tone }: { label: string; detail: string; valueMB: number; capacityMB: number; tone: "now" | "trim" | "delete" }) {
  const fillStyle = tone === "trim" ? styles.storageFillTrim : tone === "delete" ? styles.storageFillDelete : styles.storageFillNow;
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

// ─── Games Screen ─────────────────────────────────────────────────────────────

function GamesScreen({ stats, settings, queue, actionLog, busy, trimsRemaining, scan, scanBusy, scanProgress, onScan, onStartGame, onOpenThisOrThat, onOpenStorageBudget, onOpenMemoryLane, onBulkTrim, onStartRound }: {
  stats: NativeStats; settings: NativeSettings; queue: NativePhoto[]; actionLog: NativeActionLogEntry[];
  busy: boolean; trimsRemaining: number; scan: NativeLibraryScan | null; scanBusy: boolean;
  scanProgress: NativeLibraryScanProgress | null; onScan: () => void; onStartGame: (patch: Partial<NativeSettings>) => void;
  onOpenThisOrThat: () => void; onOpenStorageBudget: () => void; onOpenMemoryLane: () => void;
  onBulkTrim: () => void; onStartRound: () => void;
}) {
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const today = dailyFor(stats, dateKey());
  const trimCandidates = queue.filter((photo) => !photo.isCloudAsset);
  const trimSavings = trimCandidates.reduce((sum, photo) => sum + estimateTrimSavings(photo), 0);
  const deletionActions = actionLog.filter((entry) => entry.action === "delete");
  const visibleActions = actionsExpanded ? deletionActions : deletionActions.slice(0, 3);
  const scanProgressText = scanProgress?.total ? `Scanning ${scanProgress.scanned}/${scanProgress.total}` : scanProgress ? `Scanning ${scanProgress.scanned}` : "Scanning";
  const scanSavingsLow = scan ? Math.max(0, scan.trimSavingsMB) : 0;
  const scanSavingsHigh = scan ? Math.max(scanSavingsLow, scan.trimSavingsMB + scan.deleteSavingsMB) : 0;
  return (
    <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
      <View style={styles.gamesHero}>
        <Text style={styles.eyebrow}>Home</Text>
        <Text style={styles.heroTitle}>{formatMB(today.mbFreed)} saved today</Text>
        <View style={styles.homeStatRow}>
          <HomeStat label="Reviewed" value={String(today.reviewed)} />
          <HomeStat label="Trimmed" value={String(today.trimmed)} />
          <HomeStat label="Deleted" value={String(today.deleted)} />
        </View>
        <Text style={styles.dashboardCopy}>TrimSwipe has saved {formatMB(stats.mbFreed)} total across {stats.reviewed} reviewed photos.</Text>
      </View>
      <View style={styles.scanQuickCard}>
        <View style={styles.dashboardHeroTop}>
          <View style={styles.scanQuickCopy}>
            <Text style={styles.eyebrow}>iPhone storage scan</Text>
            <Text style={styles.challengeTitle}>
              {scan ? `Save ${formatMB(scanSavingsLow)} - ${formatMB(scanSavingsHigh)}` : "Estimate your photo savings"}
            </Text>
            <Text style={styles.mutedSmall}>
              {scan ? `${scan.assetCount} photos scanned · Photos use ${formatMB(scan.totalSizeMB)}` : "Uses local photo metadata to estimate trim + delete potential."}
            </Text>
          </View>
          <Pressable disabled={scanBusy} onPress={onScan} style={[styles.scanMiniButton, scanBusy && styles.primaryButtonDisabled]}>
            <Text style={styles.scanMiniButtonText}>{scanBusy ? scanProgressText : scan ? "Rescan" : "Scan"}</Text>
          </Pressable>
        </View>
      </View>
      <Pressable onPress={() => onStartGame({ sessionMode: "classic" })} style={styles.primaryGameCard}>
        <View style={styles.primaryGameBadge}><Text style={styles.primaryGameBadgeText}>Main game</Text></View>
        <Text style={styles.primaryGameTitle}>TrimSwipe</Text>
        <Text style={styles.primaryGameDetail}>Keep, trim, or delete one photo at a time.</Text>
      </Pressable>
      <View style={styles.gameGrid}>
        <GameModeCard icon="A/B" title="This or That" detail="Pick one keeper from two similar photos." active={false} onPress={onOpenThisOrThat} />
        <GameModeCard icon="MB" title="Storage Budget" detail="Keep photos under a 50 MB budget." active={false} onPress={onOpenStorageBudget} />
        <GameModeCard icon="60" title="Speed Round" detail="60 seconds, save what you can." active={settings.sessionMode === "time-attack"} onPress={() => onStartGame({ sessionMode: "time-attack" })} />
        <GameModeCard icon="YR" title="Memory Lane" detail="Older photos first, decide what stays." active={settings.targetMode === "old-only"} onPress={onOpenMemoryLane} />
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
        <Text style={styles.dashboardCopy}>Trim all local photos in the current deck, then keep swiping the rest.</Text>
        <Text style={styles.mutedSmall}>{trimsRemaining}/{FREE_DAILY_TRIM_LIMIT} free trims left today</Text>
        <PrimaryButton label={busy ? "Trimming..." : `Trim ${trimCandidates.length} photos, save ~${formatMB(trimSavings)}`} onPress={onBulkTrim} />
      </View>
      <SectionTitle title="Current deck" detail={`${queue.length} remaining`} />
      {queue.length > 0 ? queue.slice(0, 8).map((photo) => <QueuePhotoRow key={photo.id} photo={photo} />) : <EmptyPanel title="No active deck" detail="Start a new round to fill the review queue." actionLabel="Start round" onAction={onStartRound} />}
      <SectionTitle title="Recent deletions" detail={`${deletionActions.length} saved locally`} />
      {visibleActions.length > 0 ? (
        <View style={styles.compactActionList}>
          {visibleActions.map((entry) => <ActionLogRow key={entry.id} entry={entry} compact />)}
          {deletionActions.length > 3 ? (
            <SecondaryButton label={actionsExpanded ? "Show fewer" : `Show ${deletionActions.length - 3} more`} onPress={() => setActionsExpanded((current) => !current)} />
          ) : null}
        </View>
      ) : <EmptyPanel title="No deletions yet" detail="Your locally saved deletions will appear here." />}
    </ScrollView>
  );
}

function HomeStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.homeStat}>
      <Text style={styles.homeStatValue}>{value}</Text>
      <Text style={styles.mutedSmall}>{label}</Text>
    </View>
  );
}

function GameModeCard({ icon, title, detail, active, onPress }: { icon: string; title: string; detail: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.gameCard, active && styles.gameCardActive]}>
      <View style={[styles.gameIcon, active && styles.gameIconActive]}>
        <Text style={[styles.gameIconText, active && styles.gameIconTextActive]}>{icon}</Text>
      </View>
      <View style={styles.gameCopy}>
        <Text style={[styles.gameTitle, active && styles.gameTitleActive]}>{title}</Text>
        <Text style={[styles.gameDetail, active && styles.gameDetailActive]}>{detail}</Text>
      </View>
    </Pressable>
  );
}

// ─── This or That ─────────────────────────────────────────────────────────────

function LoserColumn({ title, tone, photos, onMove }: { title: string; tone: "delete" | "trim"; photos: NativePhoto[]; onMove: (photo: NativePhoto) => void }) {
  const total = photos.reduce((sum, photo) => sum + (tone === "delete" ? photo.sizeMB : estimateTrimSavings(photo)), 0);
  return (
    <View style={[styles.loserColumn, tone === "delete" ? styles.loserColumnDelete : styles.loserColumnTrim]}>
      <Text style={tone === "delete" ? styles.deleteSummary : styles.trimSummary}>{title}</Text>
      <Text style={styles.mutedSmall}>{photos.length} photos · {tone === "delete" ? formatMB(total) : `~${formatMB(total)}`}</Text>
      <View style={styles.loserThumbGrid}>
        {photos.map((photo) => (
          <LoserThumb key={photo.id} photo={photo} tone={tone} onMove={() => onMove(photo)} />
        ))}
      </View>
    </View>
  );
}

function LoserThumb({ photo, tone, onMove }: { photo: NativePhoto; tone: "delete" | "trim"; onMove: () => void }) {
  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8,
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_, gesture) => {
          const shouldMove = tone === "delete" ? gesture.dx > 28 : gesture.dx < -28;
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true, tension: 80, friction: 8 }).start();
          if (shouldMove) onMove();
        },
      }),
    [onMove, pan, tone],
  );
  return (
    <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX: pan.x }, { translateY: pan.y }] }}>
      <Pressable onPress={onMove} style={styles.loserThumb}>
        <Image source={{ uri: photo.uri }} style={styles.loserThumbImage} contentFit="cover" />
        <Text style={styles.loserThumbText}>{tone === "delete" ? formatMB(photo.sizeMB) : `~${formatMB(estimateTrimSavings(photo))}`}</Text>
      </Pressable>
    </Animated.View>
  );
}

function ThisOrThatScreen({ settings, onBack, onConfirmOutcome }: {
  settings: NativeSettings; onBack: () => void;
  onConfirmOutcome: (kept: NativePhoto[], deleted: NativePhoto[], toTrim: NativePhoto[]) => Promise<number>;
}) {
  const [pairs, setPairs] = useState<[NativePhoto, NativePhoto][]>([]);
  const [index, setIndex] = useState(0);
  const [kept, setKept] = useState<NativePhoto[]>([]);
  const [deleted, setDeleted] = useState<NativePhoto[]>([]);
  const [loserModes, setLoserModes] = useState<Record<string, "delete" | "trim">>({});
  const [loadingPairs, setLoadingPairs] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadPairs() {
    setLoadingPairs(true);
    try {
      const permission = await requestPhotoPermission();
      if (!permission.granted) { setPairs([]); return; }
      const nextPairs = await loadRelatedPhotoPairs(6, {
        ...settings,
        cardsPerRound: 12,
        targetMode: "similar",
        sessionMode: "classic",
      });
      setPairs(nextPairs);
      setIndex(0); setKept([]); setDeleted([]); setLoserModes({});
    } finally { setLoadingPairs(false); }
  }

  useEffect(() => { void loadPairs(); }, []);
  const pair = pairs[index];
  const deleteLosers = deleted.filter((photo) => loserModes[photo.id] !== "trim");
  const trimLosers = deleted.filter((photo) => loserModes[photo.id] === "trim");
  const deleteFreed = deleteLosers.reduce((sum, photo) => sum + photo.sizeMB, 0);
  const trimFreed = trimLosers.reduce((sum, photo) => sum + estimateTrimSavings(photo), 0);
  const totalFreed = deleteFreed + trimFreed;

  function pick(keepIndex: 0 | 1) {
    if (!pair) return;
    const keeper = pair[keepIndex];
    const loser = pair[keepIndex === 0 ? 1 : 0];
    setKept((current) => [...current, keeper]);
    setDeleted((current) => [...current, loser]);
    setLoserModes((current) => ({ ...current, [loser.id]: "delete" }));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIndex((current) => current + 1);
  }

  function setLoserMode(photo: NativePhoto, mode: "delete" | "trim") {
    setLoserModes((current) => ({ ...current, [photo.id]: mode }));
  }

  async function confirmOutcome() {
    setBusy(true);
    const count = await onConfirmOutcome(kept, deleteLosers, trimLosers);
    setBusy(false);
    if (count > 0 || deleted.length === 0) void loadPairs();
  }

  if (loadingPairs) return <Centered><ActivityIndicator color="#f97316" size="large" /><Text style={styles.muted}>Building This or That pairs...</Text></Centered>;

  if (!pair) {
    return (
      <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
        <MiniGameHeader title="This or That" detail="Round complete" onBack={onBack} />
        <View style={styles.dashboardHero}>
          <Text style={styles.heroTitle}>{deleted.length} losers ready</Text>
          <Text style={styles.dashboardCopy}>Losers default to Delete. Move anything you still want to keep smaller into Trim before applying.</Text>
          <View style={styles.loserSummaryRow}>
            <Text style={styles.deleteSummary}>Delete {deleteLosers.length}: {formatMB(deleteFreed)}</Text>
            <Text style={styles.trimSummary}>Trim {trimLosers.length}: ~{formatMB(trimFreed)}</Text>
          </View>
          <View style={styles.loserColumns}>
            <LoserColumn title="Delete" tone="delete" photos={deleteLosers} onMove={(photo) => setLoserMode(photo, "trim")} />
            <LoserColumn title="Trim" tone="trim" photos={trimLosers} onMove={(photo) => setLoserMode(photo, "delete")} />
          </View>
          <PrimaryButton label={busy ? "Applying..." : `Apply, save ~${formatMB(totalFreed)}`} disabled={busy} onPress={confirmOutcome} />
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
      <Text style={styles.centerText}>Queued savings: {formatMB(deleteFreed)}</Text>
    </ScrollView>
  );
}

// ─── Storage Budget (FIX 3) ───────────────────────────────────────────────────

function StorageBudgetScreen({ settings, trimsRemaining, avoidIds, onBack, onConfirmOutcome }: {
  settings: NativeSettings; trimsRemaining: number; avoidIds: string[]; onBack: () => void;
  onConfirmOutcome: (kept: NativePhoto[], deleted: NativePhoto[], toTrim: NativePhoto[]) => Promise<number>;
}) {
  const [photos, setPhotos] = useState<NativePhoto[]>([]);
  const [keptIds, setKeptIds] = useState<Set<string>>(new Set());
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  // FIX 3: Load enough photos to total ~75-100 MB pool so user must make real choices
  async function loadBoard() {
    setLoadingPhotos(true);
    try {
      const permission = await requestPhotoPermission();
      if (!permission.granted) { setPhotos([]); return; }
      // Fetch a larger batch and pick photos until we have a pool totaling ~BUDGET_TARGET_POOL_MB
      const batch = await loadPhotoRound(
        24,
        { ...settings, cardsPerRound: 24, targetMode: "big-or-old", sessionMode: "classic" },
        { avoidIds },
      );
      // Sort by size desc, accumulate until we hit target pool size
      const sorted = [...batch].sort((a, b) => b.sizeMB - a.sizeMB);
      const pool: NativePhoto[] = [];
      let total = 0;
      for (const photo of sorted) {
        if (photo.sizeMB <= 0) continue;
        pool.push(photo);
        total += photo.sizeMB;
        if (total >= BUDGET_TARGET_POOL_MB) break;
      }
      // If we couldn't reach the target, just use what we have
      const finalPool = pool.length > 0 ? pool : sorted.slice(0, 12);
      setPhotos(finalPool);
      setKeptIds(new Set());
    } finally { setLoadingPhotos(false); }
  }

  useEffect(() => { void loadBoard(); }, []);

  const keptPhotos = photos.filter((photo) => keptIds.has(photo.id));
  const notKeptPhotos = photos.filter((photo) => !keptIds.has(photo.id));
  // Not-kept photos: delete those not local (cloud), trim those that are local (if tokens allow)
  const toDelete = notKeptPhotos.filter((photo) => photo.isCloudAsset || trimsRemaining <= 0);
  const toTrim = notKeptPhotos.filter((photo) => !photo.isCloudAsset && trimsRemaining > 0).slice(0, trimsRemaining);
  const usedMB = keptPhotos.reduce((sum, photo) => sum + photo.sizeMB, 0);
  const overBudget = usedMB > BUDGET_KEEP_LIMIT_MB;
  const deleteSavings = toDelete.reduce((sum, photo) => sum + photo.sizeMB, 0);
  const trimSavings = toTrim.reduce((sum, photo) => sum + estimateTrimSavings(photo), 0);
  const totalPoolMB = photos.reduce((sum, photo) => sum + photo.sizeMB, 0);
  const budgetScale = scrollY.interpolate({ inputRange: [0, 120], outputRange: [1, 0.82], extrapolate: "clamp" });
  const budgetTranslateY = scrollY.interpolate({ inputRange: [0, 120], outputRange: [0, -8], extrapolate: "clamp" });

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
      Alert.alert("Over budget", `Remove ${formatMB(usedMB - BUDGET_KEEP_LIMIT_MB)} from your kept photos before locking.`);
      return;
    }
    setBusy(true);
    const count = await onConfirmOutcome(keptPhotos, toDelete, toTrim);
    setBusy(false);
    if (count > 0 || toDelete.length === 0) void loadBoard();
  }

  if (loadingPhotos) return <Centered><ActivityIndicator color="#f97316" size="large" /><Text style={styles.muted}>Building a Storage Budget board...</Text></Centered>;

  return (
    <View style={styles.budgetShell}>
      <Animated.ScrollView
        contentContainerStyle={[styles.content, styles.dashboardContent, styles.budgetContentWithFloating]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <MiniGameHeader title="Storage Budget" detail="Keep what fits" onBack={onBack} />
      <View style={styles.dashboardHero}>
        <View style={styles.dashboardHeroTop}>
          <View>
            <Text style={styles.eyebrow}>Budget</Text>
            <Text style={styles.heroTitle}>{formatMB(usedMB)} / {formatMB(BUDGET_KEEP_LIMIT_MB)}</Text>
          </View>
          <View style={styles.healthScore}>
            <Text style={styles.healthValue}>{keptPhotos.length}</Text>
            <Text style={styles.healthLabel}>kept</Text>
          </View>
        </View>
        <View style={styles.storageTrack}>
          <View style={[styles.storageFill, overBudget ? styles.storageFillDelete : styles.storageFillTrim, { width: progressWidth(Math.min(1, usedMB / BUDGET_KEEP_LIMIT_MB)) }]} />
        </View>
        <Text style={styles.dashboardCopy}>
          Tap photos you want to keep. Everything outside the budget can be deleted after confirmation.
        </Text>
        <Text style={styles.mutedSmall}>
          Pool: {formatMB(totalPoolMB)} total · {toTrim.length > 0 ? `${toTrim.length} will be trimmed` : ""}
        </Text>
      </View>
      <View style={styles.budgetGrid}>
        {photos.map((photo) => (
          <BudgetPhotoTile key={photo.id} photo={photo} kept={keptIds.has(photo.id)} onPress={() => toggle(photo)} />
        ))}
      </View>
      <PrimaryButton
        label={busy ? "Applying..." : `Lock budget, save ${formatMB(deleteSavings + trimSavings)}`}
        disabled={busy || photos.length === 0}
        onPress={lockBudget}
      />
      </Animated.ScrollView>
      <Animated.View style={[styles.floatingBudget, { transform: [{ translateY: budgetTranslateY }, { scale: budgetScale }] }]}>
        <Text style={styles.floatingBudgetLabel}>Used</Text>
        <Text style={[styles.floatingBudgetValue, overBudget && styles.floatingBudgetOver]}>{formatMB(usedMB)} / {formatMB(BUDGET_KEEP_LIMIT_MB)}</Text>
        <View style={styles.floatingBudgetTrack}>
          <View style={[styles.floatingBudgetFill, overBudget ? styles.storageFillDelete : styles.storageFillTrim, { width: progressWidth(Math.min(1, usedMB / BUDGET_KEEP_LIMIT_MB)) }]} />
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Memory Lane (FIX 4) ──────────────────────────────────────────────────────

function MemoryLaneScreen({ settings, avoidIds, trimsRemaining, onBack, onConfirmOutcome }: {
  settings: NativeSettings; avoidIds: string[]; trimsRemaining: number; onBack: () => void;
  onConfirmOutcome: (kept: NativePhoto[], deleted: NativePhoto[], toTrim: NativePhoto[]) => Promise<number>;
}) {
  const [photos, setPhotos] = useState<NativePhoto[]>([]);
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState<number | null>(null);
  const [options, setOptions] = useState<number[]>([]);
  const [kept, setKept] = useState<NativePhoto[]>([]);
  const [deleted, setDeleted] = useState<NativePhoto[]>([]);
  const [toTrim, setToTrim] = useState<NativePhoto[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  // FIX 4: Celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  async function loadMemories() {
    setLoadingPhotos(true);
    try {
      const permission = await requestPhotoPermission();
      if (!permission.granted) { setPhotos([]); return; }
      const roundSize = Math.min(30, Math.max(5, Math.round(settings.cardsPerRound) || 10));
      const next = await loadPhotoRound(
        roundSize,
        { ...settings, cardsPerRound: roundSize, targetMode: "old-only", sessionMode: "classic" },
        { avoidIds },
      );
      setPhotos(next);
      setIndex(0); setGuess(null); setKept([]); setDeleted([]); setToTrim([]); setRevealed(false);
      setOptions(next[0] ? yearOptions(next[0].year) : []);
    } finally { setLoadingPhotos(false); }
  }

  useEffect(() => { void loadMemories(); }, []);

  const photo = photos[index];
  const freed = deleted.reduce((sum, item) => sum + item.sizeMB, 0);
  const trimFreed = toTrim.reduce((sum, item) => sum + estimateTrimSavings(item), 0);
  const isCorrect = guess !== null && photo && guess === photo.year;

  function chooseYear(year: number) {
    if (!photo) return;
    setGuess(year);
    setRevealed(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const correct = year === photo.year;
    if (correct) {
      setShowCelebration(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setShowCelebration(false), 800);
    }
    // Animate border colour
    Animated.sequence([
      Animated.timing(borderAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();
  }

  function decide(action: Action) {
    if (!photo) return;
    if (action === "keep") setKept((current) => [...current, photo]);
    else if (action === "trim") setToTrim((current) => [...current, photo]);
    else setDeleted((current) => [...current, photo]);
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setGuess(null);
    setRevealed(false);
    borderAnim.setValue(0);
    setOptions(photos[nextIndex] ? yearOptions(photos[nextIndex].year) : []);
  }

  async function confirmDeletes() {
    setBusy(true);
    const count = await onConfirmOutcome(kept, deleted, toTrim);
    setBusy(false);
    if (count > 0 || deleted.length + toTrim.length === 0) void loadMemories();
  }

  if (loadingPhotos) return <Centered><ActivityIndicator color="#f97316" size="large" /><Text style={styles.muted}>Finding older memories...</Text></Centered>;

  if (!photo) {
    return (
      <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
        <MiniGameHeader title="Memory Lane" detail="Round complete" onBack={onBack} />
        <View style={styles.dashboardHero}>
          <Text style={styles.heroTitle}>{kept.length} kept, {toTrim.length} trimmed, {deleted.length} cleared</Text>
          <Text style={styles.dashboardCopy}>
            {toTrim.length} marked to trim. Applying choices would save about {formatMB(freed + trimFreed)}.
          </Text>
          <PrimaryButton label={busy ? "Applying..." : `Apply choices, save ${formatMB(freed + trimFreed)}`} disabled={busy} onPress={confirmDeletes} />
          <SecondaryButton label="Play another round without deleting" onPress={() => void loadMemories()} />
        </View>
      </ScrollView>
    );
  }

  // FIX 4: Border color based on correct/wrong answer
  const cardBorderColor = !revealed ? "#fed7aa" : isCorrect ? "#22c55e" : "#ef4444";

  return (
    <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
      <MiniGameHeader title="Memory Lane" detail={`${index + 1}/${photos.length} memories`} onBack={onBack} />
      <View style={[styles.memoryCard, { borderColor: cardBorderColor, borderWidth: revealed ? 3 : StyleSheet.hairlineWidth }]}>
        <Image source={{ uri: photo.uri }} style={styles.memoryImage} contentFit="cover" />
        <View style={styles.photoShade} />
        <View style={styles.choiceFooter}>
          <Text style={styles.choiceTitle} numberOfLines={2}>{photo.title}</Text>
          <Text style={styles.choiceMeta}>{formatMB(photo.sizeMB)}</Text>
        </View>
        <CelebrationBurst visible={showCelebration} />
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
            You guessed {guess}.{isCorrect ? " 🎉 Correct!" : ` The actual year was ${photo.year}.`} Now decide if this memory still earns its space.
          </Text>
          <View style={styles.actions}>
            <ActionButton label="Keep" tone="keep" onPress={() => decide("keep")} />
            <ActionButton label={toTrim.length >= trimsRemaining ? "Trim limit" : "Trim"} tone="trim" disabled={toTrim.length >= trimsRemaining || photo.isCloudAsset} onPress={() => decide("trim")} />
            <ActionButton label="Clear" tone="delete" onPress={() => decide("delete")} />
          </View>
          <Text style={styles.mutedSmall}>{Math.max(0, trimsRemaining - toTrim.length)} trim tokens left</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Shared mini components ───────────────────────────────────────────────────

function MiniGameHeader({ title, detail, onBack }: { title: string; detail: string; onBack: () => void }) {
  return (
    <View style={styles.miniGameHeader}>
      <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backButtonText}>Back</Text></Pressable>
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

function BudgetPhotoTile({ photo, kept, onPress }: { photo: NativePhoto; kept: boolean; onPress: () => void }) {
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
        <Text style={styles.reviewTitle} numberOfLines={1}>{photo.title}</Text>
        <Text style={styles.mutedSmall}>{formatMB(photo.sizeMB)} - trim ~{formatMB(estimateTrimSavings(photo))}</Text>
      </View>
    </View>
  );
}

function ActionLogRow({ entry, compact }: { entry: NativeActionLogEntry; compact?: boolean }) {
  return (
    <View style={[styles.actionLogRow, compact && styles.actionLogRowCompact]}>
      <View style={styles.actionLogDot} />
      <View style={styles.reviewCopy}>
        <Text style={styles.reviewTitle} numberOfLines={1}>{actionVerb(entry.action)} {entry.title}</Text>
        <Text style={styles.mutedSmall}>{entry.mbFreed > 0 ? `${formatMB(entry.mbFreed)} saved` : "No storage change"} - {entry.createdAt.slice(0, 10)}</Text>
      </View>
    </View>
  );
}

function EmptyPanel({ title, detail, actionLabel, onAction }: { title: string; detail: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.emptyPanel}>
      <Text style={styles.challengeTitle}>{title}</Text>
      <Text style={styles.muted}>{detail}</Text>
      {actionLabel && onAction ? <SecondaryButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────

const FOCUS_OPTIONS: [NativeTargetMode, string, string][] = [
  ["big-or-old", "Big or old", "Large files and older photos"],
  ["big-only", "Big", "Largest files first"],
  ["old-only", "Old", "Older memories first"],
  ["old-and-large", "Old + large", "The heaviest old photos"],
  ["similar", "Similar", "Duplicates and near-duplicates"],
  ["screenshots", "Screens", "Screenshots and screen grabs"],
  ["mistakes", "Mistakes", "Likely blurry, dark, or accidental shots"],
  ["icloud", "iCloud", "Cloud-heavy or unavailable items"],
  ["balanced", "Balanced", "A mixed cleanup deck"],
];

function FocusDropdown({ value, onChange }: { value: NativeTargetMode; onChange: (value: NativeTargetMode) => void }) {
  const [open, setOpen] = useState(false);
  const selected = FOCUS_OPTIONS.find(([option]) => option === value) ?? FOCUS_OPTIONS[0];
  return (
    <View style={styles.settingCardVertical}>
      <Text style={styles.settingLabel}>Swipe focus</Text>
      <Pressable onPress={() => setOpen((current) => !current)} style={styles.dropdownButton}>
        <View style={styles.scanQuickCopy}>
          <Text style={styles.dropdownTitle}>{selected[1]}</Text>
          <Text style={styles.mutedSmall}>{selected[2]}</Text>
        </View>
        <Text style={styles.dropdownChevron}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.dropdownList}>
          {FOCUS_OPTIONS.map(([option, label, detail]) => (
            <Pressable
              key={option}
              onPress={() => {
                onChange(option);
                setOpen(false);
              }}
              style={[styles.dropdownOption, value === option && styles.dropdownOptionActive]}
            >
              <Text style={[styles.dropdownOptionTitle, value === option && styles.dropdownOptionTitleActive]}>{label}</Text>
              <Text style={styles.mutedSmall}>{detail}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function QualityPreview({ photo, currentQuality }: { photo?: NativePhoto; currentQuality: number }) {
  const baseSize = photo?.sizeMB ?? 4;
  const variants = [
    { label: "100%", quality: 1, color: "#94a3b8" },
    { label: "75%", quality: 0.75, color: "#fb923c" },
    { label: "50%", quality: 0.5, color: "#ef4444" },
  ];
  return (
    <View style={styles.qualityPreview}>
      <View style={styles.dashboardHeroTop}>
        <View style={styles.scanQuickCopy}>
          <Text style={styles.settingLabel}>Trim quality preview</Text>
          <Text style={styles.mutedSmall}>{photo ? photo.title : "Load a deck to preview with one of your photos."}</Text>
        </View>
        {photo ? <Image source={{ uri: photo.uri }} style={styles.qualityThumb} contentFit="cover" /> : null}
      </View>
      {variants.map((variant) => {
        const projectedSize = variant.quality === 1 ? baseSize : baseSize * (0.45 + variant.quality * 0.45);
        const saved = Math.max(0, baseSize - projectedSize);
        const active = Math.abs(currentQuality - variant.quality) < 0.08;
        return (
          <View key={variant.label} style={styles.qualityRow}>
            <Text style={[styles.qualityLabel, active && { color: variant.color }]}>{variant.label}</Text>
            <View style={styles.qualityTrack}>
              <View style={[styles.qualityFill, { width: progressWidth(projectedSize / baseSize), backgroundColor: variant.color }]} />
            </View>
            <Text style={styles.mutedSmall}>{formatMB(projectedSize)} · save {formatMB(saved)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function SettingsScreen({ settings, samplePhoto, onChange, onReload }: { settings: NativeSettings; samplePhoto?: NativePhoto; onChange: (patch: Partial<NativeSettings>) => void; onReload: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.settingsHero}>
        <Text style={styles.eyebrow}>Settings</Text>
        <Text style={styles.heroTitle}>Tune the cleanup feel</Text>
        <Text style={styles.dashboardCopy}>Keep the defaults simple, then adjust focus and trim quality when you want a sharper pass.</Text>
      </View>
      <SettingStepper label="Cards per round" value={settings.cardsPerRound} suffix="cards" min={5} max={30} step={1} onChange={(cardsPerRound) => onChange({ cardsPerRound })} />
      <Segmented label="Session mode" value={settings.sessionMode} options={[["classic", "Classic"], ["endless", "Endless"], ["time-attack", "60 sec"]]} onChange={(sessionMode) => onChange({ sessionMode })} />
      <FocusDropdown value={settings.targetMode} onChange={(targetMode) => onChange({ targetMode })} />
      {settings.targetMode !== "balanced" ? (
        <>
          <SettingStepper label="Large threshold" value={settings.minSizeMB} suffix="MB" min={1} max={50} step={1} onChange={(minSizeMB) => onChange({ minSizeMB })} />
          <SettingStepper label="Old threshold" value={settings.minAgeYears} suffix="years" min={1} max={30} step={1} onChange={(minAgeYears) => onChange({ minAgeYears })} />
        </>
      ) : null}
      <SettingStepper label="Trim quality" value={Math.round(settings.trimQuality * 100)} suffix="%" min={65} max={98} step={1} onChange={(quality) => onChange({ trimQuality: quality / 100 })} />
      <QualityPreview photo={samplePhoto} currentQuality={settings.trimQuality} />
      <BooleanSetting label="Larger controls" detail="Roomier buttons and key text for easier one-handed use." value={settings.largeText} onChange={(largeText) => onChange({ largeText })} />
      <BooleanSetting label="High contrast" detail="Deepens the app background and panel borders." value={settings.highContrast} onChange={(highContrast) => onChange({ highContrast })} />
      <PrimaryButton label="Reload with these settings" onPress={onReload} />
    </ScrollView>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function BottomNav({ screen, onChange }: { screen: Screen; onChange: (screen: Screen) => void }) {
  const gamesActive = screen === "games" || screen === "this-or-that" || screen === "storage-budget" || screen === "memory-lane";
  return (
    <View style={styles.bottomNav}>
      <NavButton label="Swipe" active={screen === "swipe"} onPress={() => onChange("swipe")} />
      <NavButton label="Home" active={gamesActive} onPress={() => onChange("games")} />
      <NavButton label="Shop" active={screen === "shop"} onPress={() => onChange("shop")} />
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

// ─── Reusable UI components ───────────────────────────────────────────────────

function ActionButton({ label, tone, onPress, large, disabled }: { label: string; tone: "keep" | "trim" | "delete"; onPress: () => void; large?: boolean; disabled?: boolean }) {
  const toneStyle = tone === "keep" ? styles.actionKeep : tone === "trim" ? styles.actionTrim : styles.actionDelete;
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.actionButton, toneStyle, large && styles.actionButtonLarge, disabled && styles.actionButtonDisabled]}>
      <Text style={[styles.actionText, large && styles.actionTextLarge, disabled && styles.actionTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, danger, disabled, onPress }: { label: string; danger?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.primaryButton, danger && styles.dangerButton, disabled && styles.primaryButtonDisabled]}>
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

function SettingStepper({ label, value, suffix, min, max, step, onChange }: { label: string; value: number; suffix: string; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <View style={styles.settingCard}>
      <View>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingValue}>{value} {suffix}</Text>
      </View>
      <View style={styles.stepper}>
        <Pressable style={styles.stepperButton} onPress={() => onChange(Math.max(min, +(value - step).toFixed(2)))}><Text style={styles.stepperText}>-</Text></Pressable>
        <Pressable style={styles.stepperButton} onPress={() => onChange(Math.min(max, +(value + step).toFixed(2)))}><Text style={styles.stepperText}>+</Text></Pressable>
      </View>
    </View>
  );
}

function BooleanSetting({ label, detail, value, onChange }: { label: string; detail: string; value: boolean; onChange: (value: boolean) => void }) {
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

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (value: T) => void }) {
  return (
    <View style={styles.settingCardVertical}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.segmented}>
        {options.map(([option, optionLabel]) => (
          <Pressable key={option} onPress={() => onChange(option)} style={[styles.segment, value === option && styles.segmentActive]}>
            <Text style={[styles.segmentText, value === option && styles.segmentTextActive]}>{optionLabel}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff7ed" },
  shell: { flex: 1, backgroundColor: "#fff7ed" },
  shellHighContrast: { backgroundColor: "#fffbeb" },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 110 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  heroTitle: { color: "#1f2937", fontSize: 28, fontWeight: "800" },
  muted: { color: "#64748b", fontSize: 14 },
  mutedSmall: { color: "#64748b", fontSize: 12 },
  centerText: { color: "#475569", fontSize: 15, lineHeight: 22, textAlign: "center" },
  insightText: { color: "#c2410c", fontSize: 14, fontWeight: "800", lineHeight: 20, textAlign: "center" },
  eyebrow: { color: "#f97316", fontSize: 11, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" },
  warning: { marginTop: 12, borderRadius: 14, backgroundColor: "#fff7ed", color: "#9a3412", padding: 12, fontSize: 12 },

  // Swipe
  swipeHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14, borderRadius: 22, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 16 },
  swipeHeaderCopy: { flex: 1 },
  swipeTitle: { marginTop: 5, color: "#1f2937", fontSize: 18, fontWeight: "900" },
  swipeTitleLarge: { fontSize: 22 },
  swipeSubtitle: { marginTop: 5, color: "#64748b", fontSize: 12, lineHeight: 17 },
  swipeStatusColumn: { alignItems: "flex-end", gap: 8 },
  queuePill: { overflow: "hidden", borderRadius: 999, backgroundColor: "#ffedd5", color: "#c2410c", paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: "900" },
  timerPill: { overflow: "hidden", borderRadius: 999, backgroundColor: "#fef3c7", color: "#b45309", paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: "900" },
  trimLimitPill: { overflow: "hidden", borderRadius: 999, backgroundColor: "#ecfdf5", color: "#15803d", paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: "900" },
  trimBadge: { overflow: "hidden", borderRadius: 999, backgroundColor: "#fff7ed", color: "#c2410c", paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: "700" },
  deck: { marginTop: 18, height: 492 },
  animatedCard: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  photoCard: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden", borderRadius: 24, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa" },
  swipeTint: { ...StyleSheet.absoluteFillObject, borderRadius: 24 },
  keepTint: { backgroundColor: "rgba(34, 197, 94, 0.48)" },
  deleteTint: { backgroundColor: "rgba(239, 68, 68, 0.48)" },
  stackedCard: { transform: [{ scale: 0.96 }], opacity: 0.58 },
  photoImage: { width: "100%", height: "100%" },
  photoShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(31, 41, 55, 0.12)" },
  photoTop: { position: "absolute", top: 14, left: 14, right: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(15, 23, 42, 0.72)", color: "#f8fafc", paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: "800" },
  photoBottom: { position: "absolute", left: 18, right: 18, bottom: 18 },
  photoTitle: { color: "#f8fafc", fontSize: 25, fontWeight: "900" },
  photoMeta: { marginTop: 4, color: "#cbd5e1", fontSize: 13, fontWeight: "600" },
  reasonRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reason: { overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(248, 250, 252, 0.18)", color: "#f8fafc", paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  actions: { marginTop: 20, flexDirection: "row", gap: 10 },
  actionButton: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 17, paddingVertical: 15, borderWidth: 1 },
  actionButtonLarge: { paddingVertical: 19 },
  actionButtonDisabled: { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1", opacity: 0.75 },
  actionKeep: { backgroundColor: "#dcfce7", borderColor: "#22c55e" },
  actionTrim: { backgroundColor: "#ffedd5", borderColor: "#fb923c" },
  actionDelete: { backgroundColor: "#fee2e2", borderColor: "#ef4444" },
  actionText: { color: "#1f2937", fontSize: 14, fontWeight: "900" },
  actionTextLarge: { fontSize: 17 },
  actionTextDisabled: { color: "#94a3b8" },

  // FIX 2: Delete review list - proper bottom padding so buttons aren't hidden
  reviewList: { marginTop: 18, marginBottom: 12, flex: 1 },
  reviewListContent: { paddingBottom: 16 },
  reviewRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, backgroundColor: "#ffffff", padding: 10, marginBottom: 8 },
  reviewThumb: { width: 58, height: 58, borderRadius: 14 },
  reviewCopy: { flex: 1 },
  reviewTitle: { color: "#1f2937", fontSize: 14, fontWeight: "800" },
  actionLogRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 12 },
  actionLogRowCompact: { padding: 8, marginBottom: 4, borderRadius: 14 },
  compactActionList: { gap: 4 },
  actionLogDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: "#fb923c" },
  emptyPanel: { borderRadius: 20, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 18, gap: 10 },
  statGrid: { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 10 },
  miniStat: { minWidth: "30%", flexGrow: 1, borderRadius: 18, backgroundColor: "#ffffff", padding: 16 },
  miniStatValue: { color: "#1f2937", fontSize: 24, fontWeight: "900" },
  recapBadge: { width: 74, height: 74, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "#ffedd5", borderWidth: 2, borderColor: "#fb923c", shadowColor: "#fb923c", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 4 },
  recapBadgeIcon: { color: "#c2410c", fontSize: 38, fontWeight: "900" },
  recapImpactCard: { width: "100%", borderRadius: 22, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 16, gap: 12 },
  recapImpactValue: { color: "#f97316", fontSize: 34, fontWeight: "900" },

  // Stats redesign
  statsContent: { gap: 14, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 120 },
  statsHero: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", borderRadius: 24, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 18, gap: 12 },
  statsHeroLeft: { flex: 1, gap: 6 },
  statsHeroTitle: { color: "#1f2937", fontSize: 24, fontWeight: "900" },
  statsHeroCopy: { color: "#64748b", fontSize: 12, lineHeight: 18 },
  levelRowInline: { marginTop: 4 },
  levelLabel: { color: "#f97316", fontSize: 12, fontWeight: "800" },
  levelBarTrack: { height: 6, borderRadius: 999, backgroundColor: "#ffedd5", marginTop: 4 },
  levelBarFill: { height: "100%", borderRadius: 999, backgroundColor: "#f97316" },
  statsActionStrip: { flexDirection: "row", gap: 10 },
  statsActionBtn: { flex: 1, alignItems: "center", borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", paddingVertical: 14, gap: 4 },
  statsActionIcon: { color: "#f97316", fontSize: 18, fontWeight: "900" },
  statsActionLabel: { color: "#1f2937", fontSize: 12, fontWeight: "800" },
  impactSummaryRow: { flexDirection: "row", gap: 8 },
  impactPill: { flex: 1, alignItems: "center", borderRadius: 18, backgroundColor: "#ffffff", borderWidth: 1, paddingVertical: 12, paddingHorizontal: 4 },
  impactPillValue: { fontSize: 16, fontWeight: "900" },
  impactPillLabel: { color: "#64748b", fontSize: 10, fontWeight: "700", marginTop: 2 },
  streakRow: { flexDirection: "row", borderRadius: 20, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", overflow: "hidden" },
  streakHalf: { flex: 1, alignItems: "center", padding: 16, gap: 4 },
  streakBigNum: { color: "#f97316", fontSize: 40, fontWeight: "900", lineHeight: 44 },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 6 },
  sectionBadge: { color: "#f97316", fontSize: 12, fontWeight: "700" },

  // Common section / dashboard
  dashboardContent: { gap: 14 },
  dashboardHero: { borderRadius: 24, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 18, gap: 16 },
  dashboardHeroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  dashboardCopy: { color: "#475569", fontSize: 14, lineHeight: 21 },
  healthScore: { minWidth: 74, alignItems: "center", borderRadius: 20, backgroundColor: "#ffedd5", paddingVertical: 10, paddingHorizontal: 12 },
  healthValue: { color: "#c2410c", fontSize: 27, fontWeight: "900" },
  healthLabel: { color: "#ea580c", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickAction: { flex: 1, minWidth: "30%", borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 14, gap: 5 },
  quickActionLabel: { color: "#1f2937", fontSize: 14, fontWeight: "900" },
  quickActionDetail: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  sectionTitleRow: { marginTop: 5, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  sectionTitle: { color: "#1f2937", fontSize: 18, fontWeight: "900" },
  sectionDetail: { color: "#f97316", fontSize: 12, fontWeight: "700" },
  progressTrack: { height: 8, overflow: "hidden", borderRadius: 999, backgroundColor: "#ffedd5" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: "#f97316" },
  progressTrim: { backgroundColor: "#fb923c" },
  progressDelete: { backgroundColor: "#f87171" },
  challengeCard: { borderRadius: 20, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 16, gap: 11 },
  streakCard: { flexDirection: "row", alignItems: "center", borderRadius: 20, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 16, gap: 14 },
  streakValue: { color: "#f97316", fontSize: 44, fontWeight: "900", lineHeight: 48 },
  streakDivider: { alignSelf: "stretch", width: StyleSheet.hairlineWidth, backgroundColor: "#fed7aa" },
  streakCopy: { flex: 1, gap: 5 },
  challengeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  challengeTitle: { flex: 1, color: "#1f2937", fontSize: 14, fontWeight: "900" },
  challengeValue: { color: "#ea580c", fontSize: 16, fontWeight: "900" },
  impactPanel: { borderRadius: 20, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 16, gap: 15 },
  impactHeader: { gap: 3 },
  impactValue: { color: "#1f2937", fontSize: 30, fontWeight: "900" },
  impactRow: { gap: 8 },
  impactLabelRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  impactLabel: { color: "#475569", fontSize: 13, fontWeight: "800" },
  impactAmount: { color: "#1f2937", fontSize: 13, fontWeight: "900" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { minWidth: "47%", flexGrow: 1, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 15 },
  metricValue: { color: "#1f2937", fontSize: 23, fontWeight: "900" },
  activityPanel: { height: 148, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8, borderRadius: 20, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 14 },
  activityDay: { flex: 1, alignItems: "center", gap: 7 },
  activityBarTrack: { width: "100%", height: 78, justifyContent: "flex-end", overflow: "hidden", borderRadius: 999, backgroundColor: "#ffedd5" },
  activityBar: { width: "100%", borderRadius: 999, backgroundColor: "#fb923c" },
  activityLabel: { color: "#64748b", fontSize: 10, fontWeight: "800" },
  activityValue: { color: "#1f2937", fontSize: 11, fontWeight: "900" },
  achievementGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  achievementCard: { minWidth: "47%", flexGrow: 1, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 14, gap: 9 },
  achievementUnlocked: { backgroundColor: "#ecfdf5", borderColor: "#86efac" },
  achievementStatus: { alignSelf: "flex-start", borderRadius: 999, backgroundColor: "#ffedd5", paddingHorizontal: 8, paddingVertical: 4 },
  achievementStatusText: { color: "#c2410c", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  achievementTitle: { color: "#1f2937", fontSize: 14, fontWeight: "900" },

  // Games
  gamesHero: { borderRadius: 24, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 18, gap: 8 },
  homeStatRow: { flexDirection: "row", gap: 8 },
  homeStat: { flex: 1, borderRadius: 16, backgroundColor: "#fff7ed", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 12 },
  homeStatValue: { color: "#c2410c", fontSize: 22, fontWeight: "900" },
  scanQuickCard: { borderRadius: 20, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 16 },
  scanQuickCopy: { flex: 1, gap: 3 },
  scanMiniButton: { alignSelf: "center", borderRadius: 16, backgroundColor: "#f97316", paddingHorizontal: 16, paddingVertical: 11 },
  scanMiniButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  gameGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  primaryGameCard: { width: "100%", borderRadius: 24, backgroundColor: "#f97316", padding: 20, gap: 8, shadowColor: "#fb923c", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 6 },
  primaryGameBadge: { alignSelf: "flex-start", borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.22)", paddingHorizontal: 10, paddingVertical: 5 },
  primaryGameBadgeText: { color: "#ffffff", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  primaryGameTitle: { color: "#ffffff", fontSize: 32, fontWeight: "900" },
  primaryGameDetail: { color: "#ffedd5", fontSize: 14, fontWeight: "800" },
  gameCard: { width: "48%", minHeight: 134, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#fed7aa", padding: 14, gap: 10 },
  gameCardActive: { backgroundColor: "#ffedd5", borderColor: "#fb923c" },
  gameIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#fff7ed", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa" },
  gameIconActive: { backgroundColor: "#fb923c", borderColor: "#fb923c" },
  gameIconText: { color: "#c2410c", fontSize: 13, fontWeight: "900" },
  gameIconTextActive: { color: "#ffffff" },
  gameCopy: { gap: 4 },
  gameTitle: { color: "#1f2937", fontSize: 15, fontWeight: "900" },
  gameTitleActive: { color: "#9a3412" },
  gameDetail: { color: "#64748b", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  gameDetailActive: { color: "#9a3412" },

  // Mini game shared
  miniGameHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  miniGameHeaderCopy: { flex: 1 },
  backButton: { borderRadius: 999, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", paddingHorizontal: 14, paddingVertical: 10 },
  backButtonText: { color: "#c2410c", fontSize: 13, fontWeight: "900" },

  // This or That
  thisThatRow: { flexDirection: "row", gap: 10 },
  choicePhoto: { flex: 1, aspectRatio: 0.72, overflow: "hidden", borderRadius: 22, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa" },
  choiceImage: { width: "100%", height: "100%" },
  choiceShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(31, 41, 55, 0.18)" },
  choiceBadge: { position: "absolute", top: 10, right: 10, overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.88)", color: "#c2410c", paddingHorizontal: 9, paddingVertical: 4, fontSize: 12, fontWeight: "900" },
  choiceFooter: { position: "absolute", left: 10, right: 10, bottom: 10 },
  choiceTitle: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  choiceMeta: { marginTop: 3, color: "#ffedd5", fontSize: 12, fontWeight: "800" },
  loserSummaryRow: { flexDirection: "row", gap: 8 },
  deleteSummary: { color: "#dc2626", fontSize: 13, fontWeight: "900" },
  trimSummary: { color: "#c2410c", fontSize: 13, fontWeight: "900" },
  loserColumns: { flexDirection: "row", gap: 10 },
  loserColumn: { flex: 1, minHeight: 170, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: 2, padding: 10, gap: 8 },
  loserColumnDelete: { borderColor: "#ef4444" },
  loserColumnTrim: { borderColor: "#fb923c" },
  loserThumbGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  loserThumb: { width: 56, height: 66, overflow: "hidden", borderRadius: 12, backgroundColor: "#111827" },
  loserThumbImage: { width: "100%", height: "100%" },
  loserThumbText: { position: "absolute", left: 3, right: 3, bottom: 3, overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(15,23,42,0.72)", color: "#ffffff", fontSize: 8, fontWeight: "900", textAlign: "center" },

  // Storage budget
  budgetShell: { flex: 1 },
  budgetContentWithFloating: { paddingTop: 78 },
  floatingBudget: { position: "absolute", top: 16, left: 20, right: 20, zIndex: 10, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.96)", borderWidth: 1, borderColor: "#fed7aa", padding: 12, shadowColor: "#fb923c", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 16, elevation: 5 },
  floatingBudgetLabel: { color: "#f97316", fontSize: 10, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  floatingBudgetValue: { marginTop: 2, color: "#1f2937", fontSize: 18, fontWeight: "900" },
  floatingBudgetOver: { color: "#dc2626" },
  floatingBudgetTrack: { marginTop: 7, height: 7, overflow: "hidden", borderRadius: 999, backgroundColor: "#ffedd5" },
  floatingBudgetFill: { height: "100%", borderRadius: 999 },
  budgetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  budgetTile: { width: "31.8%", aspectRatio: 1, overflow: "hidden", borderRadius: 16, backgroundColor: "#ffffff", borderWidth: 2, borderColor: "#fed7aa", opacity: 0.72 },
  budgetTileKept: { borderColor: "#22c55e", opacity: 1 },
  budgetImage: { width: "100%", height: "100%" },
  budgetStatus: { position: "absolute", top: 6, left: 6, overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(254, 226, 226, 0.92)", color: "#b91c1c", paddingHorizontal: 7, paddingVertical: 3, fontSize: 10, fontWeight: "900" },
  budgetStatusKept: { backgroundColor: "rgba(220, 252, 231, 0.92)", color: "#15803d" },
  budgetSize: { position: "absolute", left: 6, right: 6, bottom: 6, color: "#ffffff", fontSize: 11, fontWeight: "900" },

  // Memory Lane
  memoryCard: { height: 420, overflow: "hidden", borderRadius: 24, backgroundColor: "#ffffff" },
  memoryImage: { width: "100%", height: "100%" },
  yearGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  yearButton: { minWidth: "47%", flexGrow: 1, alignItems: "center", borderRadius: 18, backgroundColor: "#ffedd5", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", paddingVertical: 16 },
  yearButtonText: { color: "#9a3412", fontSize: 22, fontWeight: "900" },

  // Onboarding
  onboardingContent: { justifyContent: "center", gap: 14 },
  onboardingSteps: { gap: 10 },
  onboardingStep: { borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 16, gap: 6 },

  // Scan
  scanPanel: { borderRadius: 24, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 18, gap: 16 },
  scanHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  scanTotal: { marginTop: 3, color: "#1f2937", fontSize: 34, fontWeight: "900" },
  scanCapacity: { flexShrink: 1, color: "#9a3412", fontSize: 12, fontWeight: "800", lineHeight: 18, textAlign: "right" },
  scanMetricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  scanMetric: { minWidth: "47%", flexGrow: 1, borderRadius: 16, backgroundColor: "#fff7ed", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 13 },
  scanMetricValue: { color: "#1f2937", fontSize: 20, fontWeight: "900" },
  storageBars: { gap: 13 },
  storageBarBlock: { gap: 7 },
  storageTrack: { height: 13, overflow: "hidden", borderRadius: 999, backgroundColor: "#ffedd5" },
  storageFill: { minWidth: 4, height: "100%", borderRadius: 999 },
  storageFillNow: { backgroundColor: "#fb923c" },
  storageFillTrim: { backgroundColor: "#22c55e" },
  storageFillDelete: { backgroundColor: "#ef4444" },
  scanFootnote: { color: "#64748b", fontSize: 12, lineHeight: 18 },

  // Level progress
  levelRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  levelCopy: { minWidth: 92 },
  levelTitle: { color: "#1f2937", fontSize: 18, fontWeight: "900" },
  levelProgress: { flex: 1, gap: 7 },

  // Settings
  settingCard: { marginTop: 12, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  settingsHero: { borderRadius: 22, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 18, gap: 8 },
  booleanCopy: { flex: 1, gap: 4 },
  toggleTrack: { width: 54, height: 32, justifyContent: "center", borderRadius: 999, backgroundColor: "#fed7aa", padding: 4 },
  toggleTrackActive: { backgroundColor: "#fb923c" },
  toggleKnob: { width: 24, height: 24, borderRadius: 999, backgroundColor: "#fff7ed" },
  toggleKnobActive: { transform: [{ translateX: 22 }], backgroundColor: "#ffffff" },
  settingCardVertical: { marginTop: 12, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 16, gap: 12 },
  dropdownButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 16, backgroundColor: "#fff7ed", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 14, gap: 12 },
  dropdownTitle: { color: "#1f2937", fontSize: 17, fontWeight: "900" },
  dropdownChevron: { color: "#c2410c", fontSize: 14, fontWeight: "900" },
  dropdownList: { gap: 7 },
  dropdownOption: { borderRadius: 14, backgroundColor: "#fff7ed", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 12, gap: 3 },
  dropdownOptionActive: { backgroundColor: "#ffedd5", borderColor: "#fb923c" },
  dropdownOptionTitle: { color: "#1f2937", fontSize: 14, fontWeight: "900" },
  dropdownOptionTitleActive: { color: "#9a3412" },
  qualityPreview: { marginTop: 12, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 16, gap: 12 },
  qualityThumb: { width: 58, height: 58, borderRadius: 14 },
  qualityRow: { gap: 6 },
  qualityLabel: { color: "#1f2937", fontSize: 13, fontWeight: "900" },
  qualityTrack: { height: 8, overflow: "hidden", borderRadius: 999, backgroundColor: "#f1f5f9" },
  qualityFill: { height: "100%", borderRadius: 999 },
  settingLabel: { color: "#9a3412", fontSize: 13, fontWeight: "700" },
  settingValue: { marginTop: 4, color: "#1f2937", fontSize: 20, fontWeight: "900" },
  stepper: { flexDirection: "row", gap: 8 },
  stepperButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#ffedd5" },
  stepperText: { color: "#c2410c", fontSize: 22, fontWeight: "900" },
  segmented: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segment: { flex: 1, minWidth: "30%", alignItems: "center", borderRadius: 14, backgroundColor: "#fff7ed", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", paddingVertical: 10, paddingHorizontal: 8 },
  segmentActive: { backgroundColor: "#fb923c", borderColor: "#fb923c" },
  segmentText: { color: "#9a3412", fontSize: 12, fontWeight: "800" },
  segmentTextActive: { color: "#ffffff" },

  // Buttons
  primaryButton: { width: "100%", alignItems: "center", borderRadius: 18, backgroundColor: "#f97316", paddingVertical: 15, paddingHorizontal: 18 },
  primaryButtonDisabled: { backgroundColor: "#fdba74", opacity: 0.72 },
  dangerButton: { backgroundColor: "#dc2626" },
  primaryButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "900" },
  secondaryButton: { width: "100%", alignItems: "center", borderRadius: 18, borderWidth: 1, borderColor: "#fed7aa", backgroundColor: "#ffffff", paddingVertical: 14, paddingHorizontal: 18 },
  secondaryButtonText: { color: "#c2410c", fontSize: 14, fontWeight: "800" },

  // Nav
  bottomNav: { position: "absolute", left: 16, right: 16, bottom: 16, flexDirection: "row", gap: 8, borderRadius: 22, backgroundColor: "rgba(255, 255, 255, 0.96)", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 8, shadowColor: "#fb923c", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 6 },
  navButton: { flex: 1, alignItems: "center", borderRadius: 16, paddingVertical: 11 },
  navButtonActive: { backgroundColor: "#fb923c" },
  navText: { color: "#9a3412", fontSize: 12, fontWeight: "900" },
  navTextActive: { color: "#ffffff" },
});
