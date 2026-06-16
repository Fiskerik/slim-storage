import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import {
  commitTrims,
  commitTrimsAndDeletes,
  deletePhotos,
  estimateTrimSavings,
  loadCleanupPlan,
  loadRelatedPhotoPairs,
  loadPhotoRound,
  requestPhotoPermission,
  scanPhotoLibrary,
  type NativeCleanupCategory,
  type NativeCleanupPlan,
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
import type { WeeklyRewardState } from "./HomeDashboard";
import { StatsDashboard } from "./StatsDashboard";
import { OnboardingCarousel } from "./OnboardingCarousel";
import { TrimScreen } from "./TrimScreen";
import { ShopScreen } from "./ShopScreen";
import { addTokens, subscribeTokens, spendTokens, DAILY_CLAIM_TOKENS } from "../lib/tokens";
import { checkProStatus } from "../lib/purchases";
import { showRewardedAd, showInterstitialAd, initAds } from "../lib/ads";
import { colors } from "../constants/design";
import {
  ensureCleanupNotifications,
  notifyCleanupProgress,
  registerCleanupBackgroundTask,
} from "../lib/progress-notifications";

type Screen =
  | "home"
  | "games"
  | "swipe"
  | "this-or-that"
  | "storage-budget"
  | "memory-lane"
  | "stats"
  | "trim"
  | "shop"
  | "cleanup-plan"
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

type ToastMessage = {
  id: number;
  title: string;
  detail?: string;
  tone?: "info" | "success" | "warning" | "error";
};

type ConfirmRequest = {
  id: number;
  title: string;
  detail: string;
  cancelLabel: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

const SWIPE_THRESHOLD = 110;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_REVIEW_TARGET = 10;
const WEEKLY_SAVINGS_TARGET_MB = 500;
const FOUR_K_VIDEO_MB_PER_MINUTE = 375;
const TIME_ATTACK_SECONDS = 60;
const SELECTION_GRACE_DAYS = 7;
const SEEN_PHOTO_LIMIT = 500;
const APP_STORE_URL =
  process.env.EXPO_PUBLIC_APP_STORE_URL ?? "https://apps.apple.com/app/id6764543618";
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
  if (settings.targetMode === "live-photos") return "Live Photos";
  if (settings.targetMode === "bursts") return "Bursts";
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

function qualifiesForDailyReward(day: NativeDailyStats): boolean {
  return day.trimmed > 0 || day.deleted > 0 || day.sessions > 0;
}

function weeklyRewardState(stats: NativeStats): WeeklyRewardState {
  const today = dateKey();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(new Date(), index - 6);
    const key = dateKey(date);
    const day = dailyFor(stats, key);
    return {
      key,
      label: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3),
      qualified: (stats.dailyRewardClaims[key] ?? 0) > 0,
      claimed: (stats.dailyRewardClaims[key] ?? 0) > 0,
      today: key === today,
    };
  });

  let streak = 0;
  let cursor = new Date();
  while ((stats.dailyRewardClaims[dateKey(cursor)] ?? 0) > 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  const claimedToday = (stats.dailyRewardClaims[today] ?? 0) > 0;
  return {
    days,
    canClaimToday: !claimedToday,
    claimedToday,
    rewardAmount: DAILY_CLAIM_TOKENS,
    streak: Math.min(7, streak),
  };
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
  const month = monthStats(stats);
  return [
    `I freed ${formatMB(month.mbFreed)} this month with TrimSwipe.`,
    `${stats.reviewed} photos reviewed, ${stats.trimmed} trimmed, ${stats.deleted} deleted.`,
    `This week: ${formatMB(week.mbFreed)} saved.`,
    APP_STORE_URL,
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
  const [screen, setScreen] = useState<Screen>("home");
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
  const [scanComplete, setScanComplete] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cleanupPlan, setCleanupPlan] = useState<NativeCleanupPlan | null>(null);
  const [cleanupPlanBusy, setCleanupPlanBusy] = useState(false);
  const sessionRef = useRef<SessionRecap>({ kept: 0, trimmed: 0, deleted: 0, freed: 0 });
  const pendingDeletesRef = useRef<NativePhoto[]>([]);
  const pendingTrimsRef = useRef<NativePhoto[]>([]);
  const [pendingTrims, setPendingTrims] = useState<NativePhoto[]>([]);
  const [tokenBalance, setTokenBalance] = useState<number>(10);
  const [isPro, setIsPro] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const cleanupCompletionsRef = useRef(0);
  const shareShotRef = useRef<View>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const settings = roundSettings(stats.settings);
  const top = queue[0];
  const next = queue[1];
  const trimCurrencyAvailable = isPro ? Number.MAX_SAFE_INTEGER : Math.max(0, tokenBalance);

  function showToast(title: string, detail?: string, tone: ToastMessage["tone"] = "info") {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), title, detail, tone });
    toastTimerRef.current = setTimeout(() => setToast(null), 3800);
  }

  function requestConfirmation({
    title,
    detail,
    cancelLabel = "Cancel",
    confirmLabel = "Apply",
    danger,
    onConfirm,
  }: {
    title: string;
    detail: string;
    cancelLabel?: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => Promise<number>;
  }): Promise<number> {
    return new Promise((resolve) => {
      const close = (value: number) => {
        setConfirmBusy(false);
        setConfirmRequest(null);
        resolve(value);
      };
      setConfirmBusy(false);
      setConfirmRequest({
        id: Date.now(),
        title,
        detail,
        cancelLabel,
        confirmLabel,
        danger,
        onCancel: () => close(0),
        onConfirm: async () => {
          setConfirmBusy(true);
          try {
            close(await onConfirm());
          } catch (err) {
            close(0);
            showToast("Apply failed", err instanceof Error ? err.message : "Please try again.", "error");
          }
        },
      });
    });
  }

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
    void registerCleanupBackgroundTask();
    void ensureCleanupNotifications();
    return () => unsub();
  }, []);

  async function handleWatchAd() {
    if (adBusy) return;
    setAdBusy(true);
    try {
      const got = await showRewardedAd();
      if (got > 0) {
        showToast("Tokens added", `+${got} tokens added.`, "success");
      } else {
        showToast("No ad available", "Please try again in a moment.", "warning");
      }
    } finally {
      setAdBusy(false);
    }
  }

  function maybeShowInterstitialAfterCleanup(appliedCount: number) {
    if (appliedCount <= 0 || isPro) return;
    cleanupCompletionsRef.current += 1;
    if (cleanupCompletionsRef.current < 2) return;
    cleanupCompletionsRef.current = 0;
    void showInterstitialAd();
  }

  async function claimWeeklyReward() {
    const reward = weeklyRewardState(stats);
    const today = dateKey();
    if (!reward.canClaimToday || reward.claimedToday) return;
    await addTokens(reward.rewardAmount, "grant");
    commitStats((current) => ({
      ...current,
      dailyRewardClaims: {
        ...current.dailyRewardClaims,
        [today]: reward.rewardAmount,
      },
    }));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast("Tokens claimed", `+${reward.rewardAmount} tokens added.`, "success");
  }


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
      const shot = shareShotRef.current
        ? await captureRef(shareShotRef.current, {
            format: "png",
            quality: 0.95,
            result: "tmpfile",
          })
        : null;
      await Share.share(
        shot
          ? { url: shot, message: progressShareText(stats) }
          : { message: progressShareText(stats) },
      );
      commitStats((current) => ({ ...current, shareCount: current.shareCount + 1 }));
    } catch (error) {
      console.log("[NativeTrimSwipe] Share failed", { error });
      await Share.share({ message: progressShareText(stats) }).catch(() => undefined);
    }
  }

  async function runLibraryScan() {
    setScanBusy(true);
    setScanComplete(false);
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
      await notifyCleanupProgress("TrimSwipe scan started", "Looking for easy storage wins.");
      const result = await scanPhotoLibrary(setScanProgress);
      setLibraryScan(result);
      setScanProgress(null);
      setScanComplete(true);
      await notifyCleanupProgress(
        "TrimSwipe scan ready",
        `Found about ${formatMB(result.trimSavingsMB + result.deleteSavingsMB + result.burstDeleteSavingsMB)} to review.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not scan the photo library";
      setScanError(message);
      setScanComplete(false);
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
    if (!isPro && tokenBalance - pendingTrimsRef.current.length <= 0) {
      showToast("Not enough tokens", "Claim daily tokens, watch an ad, or visit the shop.", "warning");
      return;
    }
    if (!canAttemptTrim(photo)) {
      showToast("Cannot trim this photo", "The original is not downloaded locally. Keep or delete it instead.", "warning");
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
    const chargeableTrims = isPro ? trims : trims.slice(0, tokenBalance);
    if (chargeableTrims.length < trims.length) {
      showToast("Not enough tokens", `${chargeableTrims.length}/${trims.length} selected trims can be applied.`, "warning");
    }

    if (chargeableTrims.length > 0) setTrimmingCount((count) => count + chargeableTrims.length);
    const totalActions = deletes.length + chargeableTrims.length;
    if (totalActions >= 5) {
      await notifyCleanupProgress("Cleanup started", `Applying ${totalActions} selected actions.`);
    }
    const batch = await commitTrimsAndDeletes(
      deletes,
      chargeableTrims,
      settings.trimQuality,
      settings.trimOutputMode === "replace",
    );
    if (chargeableTrims.length > 0) {
      setTrimmingCount((count) => Math.max(0, count - chargeableTrims.length));
    }
    const trimmedResults = batch.trimResults;
    const trimmedOkIds = new Set(trimmedResults.filter((r) => r.trimmed).map((r) => r.id));
    const deletedCount = batch.deletedCount;
    const deletedPhotos = batch.deletedPhotos;

    if (!isPro && trimmedOkIds.size > 0) {
      await spendTokens(trimmedOkIds.size);
    }
    const actualTrimSaved = trimmedResults.reduce(
      (sum, r, i) => (r.trimmed ? sum + (r.savedMB ?? estimateTrimSavings(chargeableTrims[i])) : sum),
      0,
    );

    // Commit stats for confirmed actions only.
    commitStats((current) => {
      const reviewed = deletedCount + trimmedOkIds.size;
      const deleteSaved = deletedPhotos.reduce((s, p) => s + p.sizeMB, 0);
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
      next = withRecentlySeenPhotos(next, [...deletedPhotos, ...chargeableTrims]);
      for (const p of deletedPhotos) {
        next = appendActionLog(next, createActionLogEntry(p, "delete", p.sizeMB));
      }
      for (const p of chargeableTrims.filter((tp) => trimmedOkIds.has(tp.id))) {
        next = appendActionLog(next, createActionLogEntry(p, "trim", estimateTrimSavings(p)));
      }
      return next;
    });

    // Recompute session recap to reflect actual outcomes.
    sessionRef.current = {
      kept: sessionRef.current.kept,
      trimmed: trimmedOkIds.size,
      deleted: deletedCount,
      freed: +(deletedPhotos.reduce((s, p) => s + p.sizeMB, 0) + actualTrimSaved).toFixed(2),
    };

    setLoading(false);
    if (deletedCount !== deletes.length || trimmedOkIds.size !== chargeableTrims.length) {
      showToast(
        "Some actions skipped",
        `${deletedCount}/${deletes.length} deleted and ${trimmedOkIds.size}/${chargeableTrims.length} trimmed. ${trimFailureSummary(trimmedResults)}`.trim(),
        "warning",
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
    if (totalActions >= 5) {
      await notifyCleanupProgress("Cleanup complete", `Saved about ${formatMB(sessionRef.current.freed)}.`);
    }
    maybeShowInterstitialAfterCleanup(deletedCount + trimmedOkIds.size);
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

  async function openCleanupCategory(category: NativeCleanupCategory) {
    setCleanupPlanBusy(true);
    setCleanupPlan(null);
    setScreen("cleanup-plan");
    try {
      const permission = await requestPhotoPermission();
      if (!permission.granted) {
        setPermissionDenied(true);
        showToast("Photo access needed", "Open iOS Settings to preview cleanup folders.", "warning");
        return;
      }
      setPermissionDenied(false);
      const avoidIds = recentSelectionIds(stats);
      if (category === "screenshots") {
        const [screens, duplicates, bursts] = await Promise.all([
          loadCleanupPlan("screenshots", 18, settings, { avoidIds }),
          loadCleanupPlan("duplicates", 18, settings, { avoidIds }),
          loadCleanupPlan("bursts", 18, settings, { avoidIds }),
        ]);
        const byId = new Map<string, NativePhoto>();
        [...screens.deleteCandidates, ...duplicates.deleteCandidates.slice(1), ...bursts.deleteCandidates.slice(1)]
          .forEach((photo) => byId.set(photo.id, photo));
        const deleteCandidates = [...byId.values()];
        setCleanupPlan({
          category: "screenshots",
          title: "One-tap cleanup",
          candidates: deleteCandidates,
          deleteCandidates,
          trimCandidates: [],
          estimatedDeleteSavingsMB: +deleteCandidates.reduce((sum, photo) => sum + photo.sizeMB, 0).toFixed(2),
          estimatedTrimSavingsMB: 0,
        });
        return;
      }

      const plan = await loadCleanupPlan(category, 24, settings, { avoidIds });
      if (category === "duplicates" || category === "bursts") {
        const deleteCandidates = plan.deleteCandidates.slice(1);
        setCleanupPlan({
          ...plan,
          deleteCandidates,
          estimatedDeleteSavingsMB: +deleteCandidates.reduce((sum, photo) => sum + photo.sizeMB, 0).toFixed(2),
        });
      } else {
        setCleanupPlan(plan);
      }
    } catch (error) {
      showToast("Preview failed", error instanceof Error ? error.message : "Could not build this cleanup folder.", "error");
    } finally {
      setCleanupPlanBusy(false);
    }
  }

  async function openDeepClean() {
    if (!isPro) {
      showToast("Deep Clean is Pro", "Lifetime Pro unlocks the guided full-library scan.", "info");
      setScreen("shop");
      return;
    }
    setCleanupPlanBusy(true);
    setCleanupPlan(null);
    setScreen("cleanup-plan");
    try {
      await runLibraryScan();
      const avoidIds = recentSelectionIds(stats);
      const [large, old, screenshots, duplicates, bursts] = await Promise.all([
        loadCleanupPlan("large", 18, settings, { avoidIds }),
        loadCleanupPlan("old", 18, settings, { avoidIds }),
        loadCleanupPlan("screenshots", 18, settings, { avoidIds }),
        loadCleanupPlan("duplicates", 18, settings, { avoidIds }),
        loadCleanupPlan("bursts", 18, settings, { avoidIds }),
      ]);
      const trimById = new Map<string, NativePhoto>();
      [...large.trimCandidates, ...old.trimCandidates].forEach((photo) => trimById.set(photo.id, photo));
      const deleteById = new Map<string, NativePhoto>();
      [...screenshots.deleteCandidates, ...duplicates.deleteCandidates.slice(1), ...bursts.deleteCandidates.slice(1)]
        .forEach((photo) => {
          if (!trimById.has(photo.id)) deleteById.set(photo.id, photo);
        });
      const trimCandidates = [...trimById.values()];
      const deleteCandidates = [...deleteById.values()];
      setCleanupPlan({
        category: "mistakes",
        title: "Deep Clean",
        candidates: [...deleteCandidates, ...trimCandidates],
        deleteCandidates,
        trimCandidates,
        estimatedDeleteSavingsMB: +deleteCandidates.reduce((sum, photo) => sum + photo.sizeMB, 0).toFixed(2),
        estimatedTrimSavingsMB: +trimCandidates.reduce((sum, photo) => sum + estimateTrimSavings(photo), 0).toFixed(2),
      });
    } catch (error) {
      showToast("Deep Clean failed", error instanceof Error ? error.message : "Could not build a Deep Clean preview.", "error");
    } finally {
      setCleanupPlanBusy(false);
    }
  }

  async function bulkTrimPhotos(photos: NativePhoto[]) {
    const available = isPro ? photos.length : tokenBalance;
    const candidates = photos.filter(canAttemptTrim).slice(0, available);
    if (available <= 0) {
      showToast("Not enough tokens", "Claim daily tokens, watch an ad, or visit the shop.", "warning");
      return;
    }
    if (candidates.length === 0) {
      showToast("Nothing local to trim", "This deck only has iCloud-only or unavailable photos.", "warning");
      return;
    }
    setBulkBusy(true);
    setTrimmingCount((count) => count + candidates.length);
    if (candidates.length >= 5) {
      await notifyCleanupProgress("Trim batch started", `Optimizing ${candidates.length} photos.`);
    }
    const results = await commitTrims(candidates, settings.trimQuality, settings.trimOutputMode === "replace").then((rs) =>
      candidates.map((p, i) => ({
        photo: p,
        trimmed: rs[i]?.trimmed === true,
        savedMB: rs[i]?.savedMB,
        error: rs[i]?.error,
      })),
    );
    const trimmed = results.filter((item) => item.trimmed).map((item) => item.photo);
    if (!isPro && trimmed.length > 0) await spendTokens(trimmed.length);
    const actualSaved = results.reduce(
      (sum, item) =>
        item.trimmed ? sum + (item.savedMB ?? estimateTrimSavings(item.photo)) : sum,
      0,
    );
    sessionRef.current.trimmed += trimmed.length;
    sessionRef.current.freed += actualSaved;
    commitStats((current) => {
      const attempted = results.map((item) => item.photo);
      const next = withDailyActivity(
        { ...current, reviewed: current.reviewed + trimmed.length, trimmed: current.trimmed + trimmed.length, mbFreed: +(current.mbFreed + actualSaved).toFixed(2), trimMbFreed: +(current.trimMbFreed + actualSaved).toFixed(2) },
        { reviewed: trimmed.length, trimmed: trimmed.length, mbFreed: actualSaved, trimMbFreed: actualSaved },
      );
      return trimmed.reduce((sf, photo) => appendActionLog(sf, createActionLogEntry(photo, "trim", estimateTrimSavings(photo))), withRecentlySeenPhotos(next, attempted));
    });
    setQueue((current) => {
      const trimmedIds = new Set(trimmed.map((photo) => photo.id));
      const rest = current.filter((photo) => !trimmedIds.has(photo.id));
      finishIfNeeded(rest);
      return rest;
    });
    setTrimmingCount((count) => Math.max(0, count - candidates.length));
    setBulkBusy(false);
    if (candidates.length >= 5) {
      await notifyCleanupProgress("Trim batch complete", `Optimized ${trimmed.length} photos.`);
    }
    maybeShowInterstitialAfterCleanup(trimmed.length);
    if (trimmed.length !== candidates.length) {
      showToast("Trim incomplete", `${trimmed.length}/${candidates.length} photos trimmed. ${trimFailureSummary(results.map((item) => ({ id: item.photo.id, trimmed: item.trimmed, error: item.error })))}`.trim(), "warning");
    }
  }

  async function confirmThisOrThatOutcome(
    kept: NativePhoto[],
    deleted: NativePhoto[],
    toTrim: NativePhoto[],
  ): Promise<number> {
    const available = isPro ? toTrim.length : tokenBalance;
    const trimCandidates = toTrim.filter(canAttemptTrim).slice(0, available);
    if (trimCandidates.length < toTrim.length) {
      showToast(
        "Not enough tokens",
        `${trimCandidates.length}/${toTrim.length} selected trims can be applied. Cloud-only photos cannot be trimmed until downloaded.`,
        "warning",
      );
      return 0;
    }

    return requestConfirmation({
      title: "Apply This or That choices?",
      detail: `Delete ${deleted.length} and trim ${toTrim.length} photo${deleted.length + toTrim.length === 1 ? "" : "s"}.`,
      danger: deleted.length > 0,
      onConfirm: async () => {
            const deleteResult = deleted.length > 0 ? await deletePhotos(deleted.map((photo) => photo.id)) : { deleted: 0 };
            const deletedPhotos = deleted.slice(0, deleteResult.deleted);
            setTrimmingCount((count) => count + trimCandidates.length);
            const results = await commitTrims(trimCandidates, settings.trimQuality, settings.trimOutputMode === "replace").then((rs) => trimCandidates.map((p, i) => ({ trimmed: rs[i]?.trimmed === true, savedMB: rs[i]?.savedMB, error: rs[i]?.error })));
            setTrimmingCount((count) => Math.max(0, count - trimCandidates.length));
            const trimmed = trimCandidates.filter((_, index) => results[index]?.trimmed);
            if (!isPro && trimmed.length > 0) await spendTokens(trimmed.length);
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
              showToast(
                "Apply incomplete",
                `${deleteResult.deleted}/${deleted.length} deleted and ${trimmed.length}/${trimCandidates.length} trimmed. ${trimFailureSummary(results.map((result, index) => ({ id: trimCandidates[index]?.id ?? String(index), trimmed: result.trimmed, error: result.error })))}`.trim(),
                "warning",
              );
            }
            console.log("[NativeTrimSwipe] This-or-That trim result", {
              requested: trimCandidates.length,
              trimmed: trimmed.length,
            });
            maybeShowInterstitialAfterCleanup(reviewed.length);
            return reviewed.length;
          },
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

    return requestConfirmation({
      title: "Apply your budget choices?",
      detail: `Delete ${deleted.length} and trim ${toTrim.length} photo${deleted.length + toTrim.length === 1 ? "" : "s"} for about ${formatMB(deleteSavings + trimSavings)} saved.`,
      danger: deleted.length > 0,
      onConfirm: async () => {
              const deleteResult = deleted.length > 0 ? await deletePhotos(deleted.map((photo) => photo.id)) : { deleted: 0 };
              const deletedPhotos = deleted.slice(0, deleteResult.deleted);
              setTrimmingCount((count) => count + toTrim.length);
              const trimResults = await commitTrims(toTrim, settings.trimQuality, settings.trimOutputMode === "replace").then((rs) => toTrim.map((p, i) => ({ trimmed: rs[i]?.trimmed === true, savedMB: rs[i]?.savedMB, error: rs[i]?.error })));
              setTrimmingCount((count) => Math.max(0, count - toTrim.length));
              const trimmedPhotos = toTrim.filter((_, index) => trimResults[index]?.trimmed);
              if (!isPro && trimmedPhotos.length > 0) await spendTokens(trimmedPhotos.length);
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
                showToast(
                  "Budget partly applied",
                  `${deleteResult.deleted}/${deleted.length} deleted and ${trimmedPhotos.length}/${toTrim.length} trimmed. ${trimFailureSummary(trimResults.map((result, index) => ({ id: toTrim[index]?.id ?? String(index), trimmed: result.trimmed, error: result.error })))}`.trim(),
                  "warning",
                );
              }
              maybeShowInterstitialAfterCleanup(deletedPhotos.length + trimmedPhotos.length);
              return deletedPhotos.length + trimmedPhotos.length + kept.length;
            },
    });
  }

  async function confirmMemoryLaneOutcome(
    kept: NativePhoto[],
    deleted: NativePhoto[],
    toTrim: NativePhoto[],
  ): Promise<number> {
    const deleteSavings = deleted.reduce((sum, photo) => sum + photo.sizeMB, 0);
    const trimSavings = toTrim.reduce((sum, photo) => sum + estimateTrimSavings(photo), 0);

    return requestConfirmation({
      title: "Apply Memory Lane choices?",
      detail: `Delete ${deleted.length} and trim ${toTrim.length} photo${deleted.length + toTrim.length === 1 ? "" : "s"} for about ${formatMB(deleteSavings + trimSavings)} saved.`,
      danger: deleted.length > 0,
      onConfirm: async () => {
              const deleteResult = deleted.length > 0 ? await deletePhotos(deleted.map((photo) => photo.id)) : { deleted: 0 };
              const deletedPhotos = deleted.slice(0, deleteResult.deleted);
              setTrimmingCount((count) => count + toTrim.length);
              const trimResults = await commitTrims(toTrim, settings.trimQuality, settings.trimOutputMode === "replace").then((rs) => toTrim.map((p, i) => ({ trimmed: rs[i]?.trimmed === true, savedMB: rs[i]?.savedMB, error: rs[i]?.error })));
              setTrimmingCount((count) => Math.max(0, count - toTrim.length));
              const trimmedPhotos = toTrim.filter((_, index) => trimResults[index]?.trimmed);
              if (!isPro && trimmedPhotos.length > 0) await spendTokens(trimmedPhotos.length);
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
                showToast(
                  "Memory Lane partly applied",
                  `${deleteResult.deleted}/${deleted.length} deleted and ${trimmedPhotos.length}/${toTrim.length} trimmed. ${trimFailureSummary(trimResults.map((result, index) => ({ id: toTrim[index]?.id ?? String(index), trimmed: result.trimmed, error: result.error })))}`.trim(),
                  "warning",
                );
              }
              maybeShowInterstitialAfterCleanup(deletedPhotos.length + trimmedPhotos.length);
              return reviewed.length;
            },
    });
  }

  async function handleSingleTrimComplete(photo: NativePhoto, savedMB: number) {
    if (!isPro) await spendTokens(1);
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
    maybeShowInterstitialAfterCleanup(1);
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
  const weeklyReward = weeklyRewardState(stats);
  const potentialFromScan = libraryScan
    ? libraryScan.trimSavingsMB + libraryScan.deleteSavingsMB
    : Math.max(stats.mbFreed * 2, 500);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View
        ref={shareShotRef}
        collapsable={false}
        style={[styles.shell, settings.highContrast && styles.shellHighContrast]}
      >
        {!statsLoaded ? (
          <Centered>
            <ActivityIndicator color="#f97316" size="large" />
            <Text style={styles.muted}>Preparing TrimSwipe...</Text>
          </Centered>
        ) : !stats.onboardingComplete ? (
          <OnboardingCarousel onDone={completeOnboarding} />
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
            pendingTrims={pendingTrims}
            trimmingCount={trimmingCount}
            timeLeft={timeLeft}
            largeControls={settings.largeText}
            tokens={tokenBalance}
            trimsRemaining={trimCurrencyAvailable}
            trimLimit={trimCurrencyAvailable}
            onAction={handleAction}
            onReload={loadRound}
            onOpenSettings={() => Linking.openSettings()}
            onConfirmActions={confirmActions}
            onCancelPending={cancelPendingActions}
            onShare={shareProgress}
          />
        ) : screen === "stats" ? (
          <StatsDashboard
            stats={stats}
            onShare={shareProgress}
          />
        ) : screen === "this-or-that" ? (
          <ThisOrThatScreen
            settings={settings}
            tokens={tokenBalance}
            onBack={() => setScreen("games")}
            onConfirmOutcome={confirmThisOrThatOutcome}
          />
        ) : screen === "storage-budget" ? (
          <StorageBudgetScreen
            settings={settings}
            tokens={tokenBalance}
            trimsRemaining={trimCurrencyAvailable}
            avoidIds={recentSelectionIds(stats)}
            onBack={() => setScreen("games")}
            onToast={showToast}
            onConfirmOutcome={confirmStorageBudgetOutcome}
          />
        ) : screen === "memory-lane" ? (
          <MemoryLaneScreen
            settings={settings}
            tokens={tokenBalance}
            avoidIds={recentSelectionIds(stats)}
            trimsRemaining={trimCurrencyAvailable}
            onBack={() => setScreen("games")}
            onConfirmOutcome={confirmMemoryLaneOutcome}
          />
        ) : screen === "trim" ? (
          <TrimScreen
            settings={settings}
            trimsRemaining={trimCurrencyAvailable}
            trimLimit={trimCurrencyAvailable}
            avoidIds={recentSelectionIds(stats)}
            isPro={isPro}
            onBack={() => setScreen("games")}
            onTrimmed={handleSingleTrimComplete}
          />
        ) : screen === "cleanup-plan" ? (
          <CleanupPlanScreen
            plan={cleanupPlan}
            loading={cleanupPlanBusy}
            isPro={isPro}
            onBack={() => setScreen("home")}
            onConfirm={async (deletes, trims) => {
              await confirmActions(deletes, trims);
              setCleanupPlan(null);
              setScreen("swipe");
            }}
            onOpenShop={() => setScreen("shop")}
          />
        ) : screen === "shop" ? (
          <ShopScreen onBack={() => setScreen("games")} onToast={showToast} />
        ) : screen === "games" ? (
          <GamesScreen
            stats={stats}
            settings={settings}
            queue={queue}
            tokens={tokenBalance}
            onStartGame={startGame}
            onOpenThisOrThat={() => setScreen("this-or-that")}
            onOpenStorageBudget={() => setScreen("storage-budget")}
            onOpenMemoryLane={() => setScreen("memory-lane")}
          />
        ) : screen === "home" ? (
          <HomeDashboard
            stats={stats}
            today={todayStats}
            queue={queue}
            recentPhotos={recentPhotosForHero}
            totalFreedMB={stats.mbFreed}
            potentialMB={potentialFromScan}
            scan={libraryScan}
            scanBusy={scanBusy}
            scanComplete={scanComplete}
            scanInProgressText={scanProgress?.total ? `Scanning ${scanProgress.scanned}/${scanProgress.total}` : scanProgress ? `Scanning ${scanProgress.scanned}` : undefined}
            tokens={tokenBalance}
            isPro={isPro}
            adBusy={adBusy}
            weeklyReward={weeklyReward}
            onStartSwipe={() => { setScreen("swipe"); void loadRound(); }}
            onOpenTrim={() => setScreen("trim")}
            onOpenGames={() => setScreen("games")}
            onOpenShop={() => setScreen("shop")}
            onWatchAd={handleWatchAd}
            onQuickScan={runLibraryScan}
            onDeepClean={openDeepClean}
            onOptimizeStorage={() => {
              showToast("Open Settings", "Go to Photos > Optimize iPhone Storage.", "info");
              void Linking.openSettings();
            }}
            onClaimWeeklyReward={claimWeeklyReward}
            onPickCategory={openCleanupCategory}
            onShare={shareProgress}
          />
        ) : (
          <SettingsScreen settings={settings} samplePhoto={top ?? queue[0]} onChange={updateSettings} onReload={loadRound} />
        )}

        {statsLoaded && stats.onboardingComplete ? <BottomNav screen={screen} onChange={setScreen} /> : null}
        <ConfirmSheet request={confirmRequest} busy={confirmBusy} />
        <Toast toast={toast} />
      </View>
    </SafeAreaView>
  );
}

function canAttemptTrim(photo: NativePhoto): boolean {
  const source = photo.localUri || photo.uri;
  return !photo.isCloudAsset && Boolean(source) && !source.startsWith("ph://");
}

function CleanupPlanScreen({
  plan,
  loading,
  isPro,
  onBack,
  onConfirm,
  onOpenShop,
}: {
  plan: NativeCleanupPlan | null;
  loading: boolean;
  isPro: boolean;
  onBack: () => void;
  onConfirm: (deletes: NativePhoto[], trims: NativePhoto[]) => Promise<void> | void;
  onOpenShop: () => void;
}) {
  if (loading) {
    return (
      <Centered>
        <ActivityIndicator color="#f97316" size="large" />
        <Text style={styles.heroTitle}>Building preview</Text>
        <Text style={styles.centerText}>Finding the photos that will make the biggest dent.</Text>
      </Centered>
    );
  }

  if (!plan) {
    return (
      <Centered>
        <Text style={styles.heroTitle}>No cleanup preview</Text>
        <Text style={styles.centerText}>Run a scan or pick another smart folder.</Text>
        <PrimaryButton label="Back home" onPress={onBack} />
      </Centered>
    );
  }

  const trimMB = plan.estimatedTrimSavingsMB;
  const deleteMB = plan.estimatedDeleteSavingsMB;
  const total = trimMB + deleteMB;
  const bestKept =
    (plan.category === "duplicates" || plan.category === "bursts") && plan.candidates.length > 0
      ? plan.candidates[0]
      : null;
  const deepCleanLocked = plan.title === "Deep Clean" && !isPro;

  if (deepCleanLocked) {
    return (
      <Centered>
        <Text style={styles.heroTitle}>Deep Clean is Pro</Text>
        <Text style={styles.centerText}>Lifetime Pro unlocks the guided full-library scan and auto-action preview.</Text>
        <PrimaryButton label="Open Lifetime Pro" onPress={onOpenShop} />
        <SecondaryButton label="Back home" onPress={onBack} />
      </Centered>
    );
  }

  return (
    <ConfirmActionsReview
      title={plan.title}
      detail={
        bestKept
          ? `Best kept: ${bestKept.title}. Review the rest before applying.`
          : `Preview ${plan.deleteCandidates.length + plan.trimCandidates.length} actions before anything changes.`
      }
      beforeAfter={
        <>
          <View style={styles.beforeAfterCard}>
            <Text style={styles.beforeAfterLabel}>Before</Text>
            <Text style={styles.beforeAfterValueRed}>+{formatMB(deleteMB)} clutter</Text>
          </View>
          <View style={styles.beforeAfterCard}>
            <Text style={styles.beforeAfterLabel}>After</Text>
            <Text style={styles.beforeAfterValueGreen}>Save ~{formatMB(total)}</Text>
          </View>
        </>
      }
      deletes={plan.deleteCandidates}
      trims={plan.trimCandidates}
      onConfirm={onConfirm}
      onCancel={onBack}
    />
  );
}


// ─── Swipe Screen ─────────────────────────────────────────────────────────────

function SwipeScreen({
  top, next, queueCount, loading, error, permissionDenied, permissionLimited,
  settings, recap, pendingDeletes, pendingTrims, trimmingCount, timeLeft, largeControls, tokens,
  trimsRemaining, trimLimit, onAction, onReload, onOpenSettings,
  onConfirmActions, onCancelPending, onShare,
}: {
  top?: NativePhoto; next?: NativePhoto; queueCount: number; loading: boolean;
  error: string | null; permissionDenied: boolean; permissionLimited: boolean;
  settings: NativeSettings; recap: SessionRecap | null; pendingDeletes: NativePhoto[];
  pendingTrims: NativePhoto[];
  trimmingCount: number; timeLeft: number; largeControls: boolean; tokens: number; trimsRemaining: number;
  trimLimit: number; onAction: (photo: NativePhoto, action: Action) => void;
  onReload: () => void; onOpenSettings: () => void;
  onConfirmActions: (deletes: NativePhoto[], trims: NativePhoto[]) => Promise<void> | void;
  onCancelPending: () => void;
  onShare: () => void;
}) {
  const [fullPhoto, setFullPhoto] = useState<NativePhoto | null>(null);

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
  if ((pendingDeletes.length > 0 || pendingTrims.length > 0) && !top) {
    return (
      <ConfirmActionsReview
        deletes={pendingDeletes}
        trims={pendingTrims}
        onConfirm={(d, t) => onConfirmActions(d, t)}
        onCancel={onCancelPending}
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
          <Text style={[styles.swipeTitle, largeControls && styles.swipeTitleLarge]}>{targetLabel(settings)}</Text>
          <Text style={styles.swipeSubtitle}>{sessionModeLabel(settings.sessionMode)} mode. A cleaner set of photos, one quick decision at a time.</Text>
        </View>
        <View style={styles.swipeStatusColumn}>
          <TokenPill tokens={tokens} />
          <Text style={styles.queuePill}>{queueCount} left</Text>
          {settings.sessionMode === "time-attack" ? <Text style={styles.timerPill}>{timeLeft}s</Text> : null}
          {trimmingCount > 0 ? <Text style={styles.trimBadge}>Trimming {trimmingCount}</Text> : null}
        </View>
      </View>
      {permissionLimited ? <Text style={styles.warning}>Limited photo access is enabled. Some photos may be hidden.</Text> : null}
      <View style={styles.deck}>
        {next ? <PhotoCard photo={next} stacked /> : null}
        {top ? <SwipeablePhotoCard photo={top} onAction={(action) => onAction(top, action)} onOpenFull={() => setFullPhoto(top)} /> : null}
      </View>
      <View style={styles.actions}>
        <ActionButton label="Keep" tone="keep" large={largeControls} onPress={() => top && onAction(top, "keep")} />
        <ActionButton label={trimsRemaining > 0 ? "Trim" : "Limit hit"} tone="trim" large={largeControls} disabled={trimsRemaining <= 0} onPress={() => top && onAction(top, "trim")} />
        <ActionButton label="Delete" tone="delete" large={largeControls} onPress={() => top && onAction(top, "delete")} />
      </View>
      <FullPhotoModal photo={fullPhoto} onClose={() => setFullPhoto(null)} />
    </View>
  );
}

function trimFailureSummary(
  results: Array<{ id: string; trimmed: boolean; error?: string }>,
): string {
  const failed = results.filter((result) => !result.trimmed);
  if (failed.length === 0) return "";
  const reasons = new Set(
    failed
      .map((result) => result.error)
      .filter((reason): reason is string => Boolean(reason)),
  );
  if (reasons.size === 0) return `${failed.length} photo${failed.length === 1 ? "" : "s"} could not be trimmed.`;
  return [...reasons].slice(0, 2).join(" ");
}

function SwipeablePhotoCard({ photo, onAction, onOpenFull }: { photo: NativePhoto; onAction: (action: Action) => void; onOpenFull: () => void }) {
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
      <PhotoCard photo={photo} onOpenFull={onOpenFull} />
      <Animated.View pointerEvents="none" style={[styles.swipeTint, styles.keepTint, { opacity: keepOpacity }]} />
      <Animated.View pointerEvents="none" style={[styles.swipeTint, styles.deleteTint, { opacity: deleteOpacity }]} />
    </Animated.View>
  );
}

function PhotoCard({ photo, stacked, onOpenFull }: { photo: NativePhoto; stacked?: boolean; onOpenFull?: () => void }) {
  const Wrapper = onOpenFull ? Pressable : View;
  return (
    <Wrapper onLongPress={onOpenFull} delayLongPress={350} style={[styles.photoCard, stacked && styles.stackedCard]}>
      <Image source={{ uri: photo.uri }} style={styles.photoImage} resizeMode="cover" />
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
    </Wrapper>
  );
}

// Lets the user deselect any items they no longer want to delete or trim
// before applying the actions in a single batch (one iOS confirmation).
function ConfirmActionsReview({
  title = "Confirm actions",
  detail,
  beforeAfter,
  deletes,
  trims,
  onConfirm,
  onCancel,
}: {
  title?: string;
  detail?: string;
  beforeAfter?: ReactNode;
  deletes: NativePhoto[];
  trims: NativePhoto[];
  onConfirm: (deletes: NativePhoto[], trims: NativePhoto[]) => void;
  onCancel: () => void;
}) {
  const [deleteList, setDeleteList] = useState<NativePhoto[]>(deletes);
  const [trimList, setTrimList] = useState<NativePhoto[]>(trims);
  const [selectedDeletes, setSelectedDeletes] = useState<Set<string>>(
    () => new Set(deletes.map((p) => p.id)),
  );
  const [selectedTrims, setSelectedTrims] = useState<Set<string>>(
    () => new Set(trims.map((p) => p.id)),
  );

  const chosenDeletes = deleteList.filter((p) => selectedDeletes.has(p.id));
  const chosenTrims = trimList.filter((p) => selectedTrims.has(p.id));
  const deleteMB = chosenDeletes.reduce((s, p) => s + p.sizeMB, 0);
  const trimMB = chosenTrims.reduce((s, p) => s + estimateTrimSavings(p), 0);
  const total = deleteMB + trimMB;
  const nothingSelected = chosenDeletes.length + chosenTrims.length === 0;

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  function moveToDelete(photo: NativePhoto) {
    setTrimList((current) => current.filter((item) => item.id !== photo.id));
    setDeleteList((current) =>
      current.some((item) => item.id === photo.id) ? current : [...current, photo],
    );
    setSelectedTrims((current) => {
      const next = new Set(current);
      next.delete(photo.id);
      return next;
    });
    setSelectedDeletes((current) => new Set(current).add(photo.id));
  }

  function moveToTrim(photo: NativePhoto) {
    setDeleteList((current) => current.filter((item) => item.id !== photo.id));
    setTrimList((current) =>
      current.some((item) => item.id === photo.id) ? current : [...current, photo],
    );
    setSelectedDeletes((current) => {
      const next = new Set(current);
      next.delete(photo.id);
      return next;
    });
    setSelectedTrims((current) => new Set(current).add(photo.id));
  }

  function renderRow(photo: NativePhoto, selected: boolean, onToggle: () => void, hint: string, move: "delete" | "trim") {
    return (
      <Pressable key={photo.id} onPress={onToggle} style={styles.reviewRow}>
        <Image source={{ uri: photo.uri }} style={[styles.reviewThumb, !selected && { opacity: 0.4 }]} resizeMode="cover" />
        <View style={styles.reviewCopy}>
          <Text style={[styles.reviewTitle, !selected && { textDecorationLine: "line-through", color: "#9ca3af" }]} numberOfLines={1}>
            {photo.title}
          </Text>
          <Text style={styles.mutedSmall}>{hint}</Text>
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            if (move === "delete") moveToDelete(photo);
            else moveToTrim(photo);
          }}
          hitSlop={8}
          style={styles.reviewMoveButton}
        >
          <Ionicons
            name={move === "delete" ? "trash-outline" : "cut-outline"}
            size={18}
            color={move === "delete" ? "#dc2626" : "#c2410c"}
          />
        </Pressable>
        <View style={[styles.checkbox, selected && styles.checkboxOn]}>
          {selected ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.content}>
      <Text style={styles.heroTitle}>{title}</Text>
      {detail ? <Text style={styles.centerText}>{detail}</Text> : null}
      {beforeAfter ? <View style={styles.beforeAfterRow}>{beforeAfter}</View> : null}
      <Text style={styles.muted}>
        Tap rows to deselect. Use the bin/scissors to move photos between Delete and Trim. {chosenDeletes.length} to delete - {chosenTrims.length} to trim - ~{formatMB(total)} saved.
      </Text>
      <ScrollView style={styles.reviewList} contentContainerStyle={styles.reviewListContent}>
        {trimList.length > 0 ? (
          <Text style={[styles.eyebrow, { marginBottom: 6 }]}>Trim ({chosenTrims.length}/{trimList.length})</Text>
        ) : null}
        {trimList.map((photo) =>
          renderRow(
            photo,
            selectedTrims.has(photo.id),
            () => toggle(selectedTrims, setSelectedTrims, photo.id),
            `Trim - saves ~${estimateTrimSavings(photo).toFixed(1)} MB`,
            "delete",
          ),
        )}
        {deleteList.length > 0 ? (
          <Text style={[styles.eyebrow, { marginTop: trimList.length > 0 ? 14 : 0, marginBottom: 6 }]}>
            Delete ({chosenDeletes.length}/{deleteList.length})
          </Text>
        ) : null}
        {deleteList.map((photo) =>
          renderRow(
            photo,
            selectedDeletes.has(photo.id),
            () => toggle(selectedDeletes, setSelectedDeletes, photo.id),
            `Delete - frees ${photo.sizeMB.toFixed(1)} MB`,
            "trim",
          ),
        )}
      </ScrollView>
      <PrimaryButton
        label={nothingSelected ? "Nothing selected" : `Apply · save ${formatMB(total)}`}
        danger={chosenDeletes.length > 0}
        disabled={nothingSelected}
        onPress={() => onConfirm(chosenDeletes, chosenTrims)}
      />
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
          <Text style={styles.challengeTitle}>{today.trimmed} trims today</Text>
          <Text style={styles.mutedSmall}>Use your top-right balance for trims.</Text>
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

function GamesScreen({ stats, settings, queue, tokens, onStartGame, onOpenThisOrThat, onOpenStorageBudget, onOpenMemoryLane }: {
  stats: NativeStats; settings: NativeSettings; queue: NativePhoto[]; tokens: number; onStartGame: (patch: Partial<NativeSettings>) => void;
  onOpenThisOrThat: () => void; onOpenStorageBudget: () => void; onOpenMemoryLane: () => void;
}) {
  const today = dailyFor(stats, dateKey());
  const heroPhotos = queue.slice(0, 3);
  const gameThumbs = queue.slice(3, 7);
  const todayLabel = today.mbFreed > 0 ? `${formatMB(today.mbFreed)} today` : "Ready to clean";
  return (
    <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
      <View style={styles.gamesVisualHero}>
        <View style={styles.gameTopRow}>
          <View style={styles.gamesHeroCopy}>
            <Text style={styles.eyebrow}>Games</Text>
            <Text style={styles.heroTitle}>Choose how to clean</Text>
            <Text style={styles.dashboardCopy}>{todayLabel} · {stats.reviewed} photos reviewed</Text>
          </View>
          <TokenPill tokens={tokens} />
        </View>
        <View style={styles.heroPhotoStrip}>
          {heroPhotos.length > 0 ? (
            heroPhotos.map((photo, index) => (
              <Image
                key={photo.id}
                source={{ uri: photo.uri }}
                style={[styles.heroPhoto, index === 1 && styles.heroPhotoRaised]}
                resizeMode="cover"
              />
            ))
          ) : (
            <View style={styles.heroPhotoFallback}>
              <Ionicons name="images-outline" size={34} color="#ffffff" />
            </View>
          )}
        </View>
        <View style={styles.gamesStatsRow}>
          <GameMetric icon="eye-outline" value={today.reviewed} label="Reviewed" />
          <GameMetric icon="cut-outline" value={today.trimmed} label="Trimmed" />
          <GameMetric icon="trash-outline" value={today.deleted} label="Deleted" />
        </View>
      </View>
      <Pressable onPress={() => onStartGame({ sessionMode: "classic" })} style={styles.primaryGameVisualCard}>
        <View style={styles.primaryGameText}>
          <View style={styles.primaryGameBadge}><Text style={styles.primaryGameBadgeText}>Main game</Text></View>
          <Text style={styles.primaryGameTitle}>TrimSwipe</Text>
          <Text style={styles.primaryGameDetail}>Swipe left, up, or right.</Text>
        </View>
        <View style={styles.primaryGameIcons}>
          <Ionicons name="checkmark-circle" size={30} color="#ffffff" />
          <Ionicons name="cut" size={30} color="#ffffff" />
          <Ionicons name="trash" size={30} color="#ffffff" />
        </View>
      </Pressable>
      <View style={styles.gameGrid}>
        <VisualGameCard icon="git-compare-outline" title="This or That" detail="Pick the keeper" thumb={gameThumbs[0]?.uri} onPress={onOpenThisOrThat} />
        <VisualGameCard icon="speedometer-outline" title="Storage Budget" detail="Stay under 50 MB" thumb={gameThumbs[1]?.uri} onPress={onOpenStorageBudget} />
        <VisualGameCard icon="timer-outline" title="Speed Round" detail="60 seconds" thumb={gameThumbs[2]?.uri} active={settings.sessionMode === "time-attack"} onPress={() => onStartGame({ sessionMode: "time-attack" })} />
        <VisualGameCard icon="calendar-outline" title="Memory Lane" detail="Old photos first" thumb={gameThumbs[3]?.uri} active={settings.targetMode === "old-only"} onPress={onOpenMemoryLane} />
      </View>
    </ScrollView>
  );
}

function GameMetric({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: number; label: string }) {
  return (
    <View style={styles.gameMetric}>
      <Ionicons name={icon} size={16} color="#f97316" />
      <Text style={styles.gameMetricValue}>{value}</Text>
      <Text style={styles.gameMetricLabel}>{label}</Text>
    </View>
  );
}

function VisualGameCard({ icon, title, detail, thumb, active, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  thumb?: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.visualGameCard, active && styles.visualGameCardActive]}>
      <View style={styles.visualGameImageWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.visualGameImage} resizeMode="cover" />
        ) : (
          <View style={styles.visualGameFallback}>
            <Ionicons name={icon} size={28} color="#f97316" />
          </View>
        )}
        <View style={styles.visualGameIcon}>
          <Ionicons name={icon} size={16} color="#ffffff" />
        </View>
      </View>
      <View style={styles.gameCopy}>
        <Text style={[styles.gameTitle, active && styles.gameTitleActive]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.gameDetail, active && styles.gameDetailActive]} numberOfLines={1}>{detail}</Text>
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
        <Image source={{ uri: photo.uri }} style={styles.loserThumbImage} resizeMode="cover" />
        <Text style={styles.loserThumbText}>{tone === "delete" ? formatMB(photo.sizeMB) : `~${formatMB(estimateTrimSavings(photo))}`}</Text>
      </Pressable>
    </Animated.View>
  );
}

function ThisOrThatScreen({ settings, tokens, onBack, onConfirmOutcome }: {
  settings: NativeSettings; tokens: number; onBack: () => void;
  onConfirmOutcome: (kept: NativePhoto[], deleted: NativePhoto[], toTrim: NativePhoto[]) => Promise<number>;
}) {
  const [pairs, setPairs] = useState<[NativePhoto, NativePhoto][]>([]);
  const [index, setIndex] = useState(0);
  const [kept, setKept] = useState<NativePhoto[]>([]);
  const [deleted, setDeleted] = useState<NativePhoto[]>([]);
  const [loserModes, setLoserModes] = useState<Record<string, "delete" | "trim">>({});
  const [loadingPairs, setLoadingPairs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fullPhoto, setFullPhoto] = useState<NativePhoto | null>(null);

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
        <MiniGameHeader title="This or That" detail="Round complete" tokens={tokens} onBack={onBack} />
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
      <MiniGameHeader title="This or That" detail={`${index + 1}/${pairs.length} pairs`} tokens={tokens} onBack={onBack} />
      <View style={styles.dashboardHero}>
        <Text style={styles.heroTitle}>Tap the photo to keep</Text>
        <Text style={styles.dashboardCopy}>The unpicked photo waits for final delete confirmation.</Text>
      </View>
      <View style={styles.thisThatRow}>
        <ChoicePhoto photo={pair[0]} label="A" onPress={() => pick(0)} onLongPress={() => setFullPhoto(pair[0])} />
        <ChoicePhoto photo={pair[1]} label="B" onPress={() => pick(1)} onLongPress={() => setFullPhoto(pair[1])} />
      </View>
      <Text style={styles.centerText}>Queued savings: {formatMB(deleteFreed)}</Text>
      <FullPhotoModal photo={fullPhoto} onClose={() => setFullPhoto(null)} />
    </ScrollView>
  );
}

// ─── Storage Budget (FIX 3) ───────────────────────────────────────────────────

function StorageBudgetScreen({ settings, tokens, trimsRemaining, avoidIds, onBack, onToast, onConfirmOutcome }: {
  settings: NativeSettings; tokens: number; trimsRemaining: number; avoidIds: string[]; onBack: () => void;
  onToast: (title: string, detail?: string, tone?: ToastMessage["tone"]) => void;
  onConfirmOutcome: (kept: NativePhoto[], deleted: NativePhoto[], toTrim: NativePhoto[]) => Promise<number>;
}) {
  const [photos, setPhotos] = useState<NativePhoto[]>([]);
  const [keptIds, setKeptIds] = useState<Set<string>>(new Set());
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [fullPhoto, setFullPhoto] = useState<NativePhoto | null>(null);
  const [step, setStep] = useState<"select" | "unkept" | "kept">("select");
  const [unkeptAction, setUnkeptAction] = useState<"delete" | "trim">("delete");
  const [keptAction, setKeptAction] = useState<"keep" | "trim">("keep");

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
      setStep("select");
      setUnkeptAction("delete");
      setKeptAction("keep");
    } finally { setLoadingPhotos(false); }
  }

  useEffect(() => { void loadBoard(); }, []);

  const keptPhotos = photos.filter((photo) => keptIds.has(photo.id));
  const notKeptPhotos = photos.filter((photo) => !keptIds.has(photo.id));
  const unkeptTrimCandidates = notKeptPhotos.filter(canAttemptTrim);
  const keptTrimCandidates = keptPhotos.filter(canAttemptTrim);
  const plannedUnkeptTrims = unkeptAction === "trim" ? unkeptTrimCandidates.slice(0, trimsRemaining) : [];
  const remainingAfterUnkept = Math.max(0, trimsRemaining - plannedUnkeptTrims.length);
  const plannedKeptTrims = keptAction === "trim" ? keptTrimCandidates.slice(0, remainingAfterUnkept) : [];
  const plannedKeptTrimIds = new Set(plannedKeptTrims.map((photo) => photo.id));
  const keptAsIs = keptPhotos.filter((photo) => !plannedKeptTrimIds.has(photo.id));
  const toDelete = unkeptAction === "delete" ? notKeptPhotos : notKeptPhotos.filter((photo) => !canAttemptTrim(photo));
  const toTrim = [...plannedUnkeptTrims, ...plannedKeptTrims];
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
      onToast("Over budget", `Remove ${formatMB(usedMB - BUDGET_KEEP_LIMIT_MB)} from your kept photos before continuing.`, "warning");
      return;
    }
    setStep("unkept");
  }

  async function applyBudgetPlan() {
    setBusy(true);
    const count = await onConfirmOutcome(keptAsIs, toDelete, toTrim);
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
        <MiniGameHeader title="Storage Budget" detail="Keep what fits" tokens={tokens} onBack={onBack} />
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
          Tap photos you want to keep. Then choose what happens to unkept photos and kept photos.
        </Text>
        <Text style={styles.mutedSmall}>
          Pool: {formatMB(totalPoolMB)} total
        </Text>
      </View>
      {step === "select" ? (
        <>
          <View style={styles.budgetGrid}>
            {photos.map((photo) => (
              <BudgetPhotoTile key={photo.id} photo={photo} kept={keptIds.has(photo.id)} onPress={() => toggle(photo)} onLongPress={() => setFullPhoto(photo)} />
            ))}
          </View>
          <PrimaryButton
            label={busy ? "Applying..." : `Continue with ${keptPhotos.length} kept`}
            disabled={busy || photos.length === 0}
            onPress={lockBudget}
          />
        </>
      ) : step === "unkept" ? (
        <BudgetDecisionStep
          title="Unkept photos"
          detail={`${notKeptPhotos.length} photos outside your keep set`}
          options={[
            { key: "delete", label: "Delete", detail: `Free ${formatMB(notKeptPhotos.reduce((sum, photo) => sum + photo.sizeMB, 0))}` },
            { key: "trim", label: "Trim", detail: `Try to save ~${formatMB(unkeptTrimCandidates.reduce((sum, photo) => sum + estimateTrimSavings(photo), 0))}` },
          ]}
          value={unkeptAction}
          onChange={(value) => setUnkeptAction(value as "delete" | "trim")}
          onBack={() => setStep("select")}
          onNext={() => setStep("kept")}
        />
      ) : (
        <BudgetDecisionStep
          title="Kept photos"
          detail={`${keptPhotos.length} selected photos`}
          options={[
            { key: "keep", label: "Keep", detail: "Leave originals as they are" },
            { key: "trim", label: "Trim", detail: `Try to save ~${formatMB(keptTrimCandidates.reduce((sum, photo) => sum + estimateTrimSavings(photo), 0))}` },
          ]}
          value={keptAction}
          onChange={(value) => setKeptAction(value as "keep" | "trim")}
          onBack={() => setStep("unkept")}
          onNext={applyBudgetPlan}
          nextLabel={busy ? "Applying..." : `Apply, save ~${formatMB(deleteSavings + trimSavings)}`}
          disabled={busy}
        />
      )}
      </Animated.ScrollView>
      <FullPhotoModal photo={fullPhoto} onClose={() => setFullPhoto(null)} />
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

function MemoryLaneScreen({ settings, tokens, avoidIds, trimsRemaining, onBack, onConfirmOutcome }: {
  settings: NativeSettings; tokens: number; avoidIds: string[]; trimsRemaining: number; onBack: () => void;
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
  const [fullPhoto, setFullPhoto] = useState<NativePhoto | null>(null);
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
        <MiniGameHeader title="Memory Lane" detail="Round complete" tokens={tokens} onBack={onBack} />
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
      <MiniGameHeader title="Memory Lane" detail={`${index + 1}/${photos.length} memories`} tokens={tokens} onBack={onBack} />
      <Pressable onLongPress={() => setFullPhoto(photo)} delayLongPress={350} style={[styles.memoryCard, { borderColor: cardBorderColor, borderWidth: revealed ? 3 : StyleSheet.hairlineWidth }]}>
        <Image source={{ uri: photo.uri }} style={styles.memoryImage} resizeMode="cover" />
        <View style={styles.photoShade} />
        <View style={styles.choiceFooter}>
          <Text style={styles.choiceTitle} numberOfLines={2}>{photo.title}</Text>
          <Text style={styles.choiceMeta}>{formatMB(photo.sizeMB)}</Text>
        </View>
        <CelebrationBurst visible={showCelebration} />
      </Pressable>

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
            <ActionButton label={toTrim.length >= trimsRemaining ? "No tokens" : canAttemptTrim(photo) ? "Trim" : "Unavailable"} tone="trim" disabled={toTrim.length >= trimsRemaining || !canAttemptTrim(photo)} onPress={() => decide("trim")} />
            <ActionButton label="Clear" tone="delete" onPress={() => decide("delete")} />
          </View>
        </View>
      )}
      <FullPhotoModal photo={fullPhoto} onClose={() => setFullPhoto(null)} />
    </ScrollView>
  );
}

// ─── Shared mini components ───────────────────────────────────────────────────

function MiniGameHeader({ title, detail, tokens, onBack }: { title: string; detail: string; tokens: number; onBack: () => void }) {
  return (
    <View style={styles.miniGameHeader}>
      <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backButtonText}>Back</Text></Pressable>
      <View style={styles.miniGameHeaderCopy}>
        <Text style={styles.eyebrow}>{detail}</Text>
        <Text style={styles.heroTitle}>{title}</Text>
      </View>
      <TokenPill tokens={tokens} />
    </View>
  );
}

function TokenPill({ tokens }: { tokens: number }) {
  return (
    <View style={styles.tokenPill}>
      <Ionicons name="flash" size={14} color="#92400e" />
      <Text style={styles.tokenPillText}>{tokens}</Text>
    </View>
  );
}

function BudgetDecisionStep({
  title,
  detail,
  options,
  value,
  onChange,
  onBack,
  onNext,
  nextLabel = "Continue",
  disabled,
}: {
  title: string;
  detail: string;
  options: Array<{ key: string; label: string; detail: string }>;
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  disabled?: boolean;
}) {
  return (
    <View style={styles.budgetDecisionCard}>
      <Text style={styles.eyebrow}>{detail}</Text>
      <Text style={styles.budgetDecisionTitle}>{title}</Text>
      <View style={styles.budgetChoiceRow}>
        {options.map((option) => {
          const selected = value === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => onChange(option.key)}
              style={[styles.budgetChoice, selected && styles.budgetChoiceSelected]}
            >
              <Text style={[styles.budgetChoiceTitle, selected && styles.budgetChoiceTitleSelected]}>
                {option.label}
              </Text>
              <Text style={styles.budgetChoiceDetail}>{option.detail}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.budgetDecisionActions}>
        <SecondaryButton label="Back" onPress={onBack} />
        <PrimaryButton label={nextLabel} disabled={disabled} onPress={onNext} />
      </View>
    </View>
  );
}

function ConfirmSheet({ request, busy }: { request: ConfirmRequest | null; busy: boolean }) {
  if (!request) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={request.onCancel}>
      <View style={styles.confirmBackdrop}>
        <View style={styles.confirmSheet}>
          <View style={styles.confirmIcon}>
            <Ionicons name={request.danger ? "trash" : "checkmark"} size={24} color={request.danger ? "#dc2626" : "#c2410c"} />
          </View>
          <Text style={styles.confirmTitle}>{request.title}</Text>
          <Text style={styles.confirmDetail}>{request.detail}</Text>
          <View style={styles.confirmActions}>
            <SecondaryButton label={request.cancelLabel} onPress={request.onCancel} />
            <PrimaryButton label={busy ? "Applying..." : request.confirmLabel} danger={request.danger} disabled={busy} onPress={request.onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Toast({ toast }: { toast: ToastMessage | null }) {
  if (!toast) return null;
  const icon =
    toast.tone === "success"
      ? "checkmark-circle"
      : toast.tone === "error"
        ? "alert-circle"
        : toast.tone === "warning"
          ? "warning"
          : "information-circle";
  return (
    <View pointerEvents="none" style={styles.toastWrap}>
      <View style={[styles.toast, toast.tone === "success" && styles.toastSuccess, toast.tone === "warning" && styles.toastWarning, toast.tone === "error" && styles.toastError]}>
        <Ionicons name={icon} size={18} color="#1f2937" />
        <View style={{ flex: 1 }}>
          <Text style={styles.toastTitle}>{toast.title}</Text>
          {toast.detail ? <Text style={styles.toastDetail}>{toast.detail}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function ChoicePhoto({ photo, label, onPress, onLongPress }: { photo: NativePhoto; label: string; onPress: () => void; onLongPress: () => void }) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350} style={styles.choicePhoto}>
      <Image source={{ uri: photo.uri }} style={styles.choiceImage} resizeMode="cover" />
      <View style={styles.choiceShade} />
      <Text style={styles.choiceBadge}>{label}</Text>
      <View style={styles.choiceFooter}>
        <Text style={styles.choiceTitle} numberOfLines={2}>{photo.title}</Text>
        <Text style={styles.choiceMeta}>{formatMB(photo.sizeMB)}</Text>
      </View>
    </Pressable>
  );
}

function BudgetPhotoTile({ photo, kept, onPress, onLongPress }: { photo: NativePhoto; kept: boolean; onPress: () => void; onLongPress: () => void }) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350} style={[styles.budgetTile, kept && styles.budgetTileKept]}>
      <Image source={{ uri: photo.uri }} style={styles.budgetImage} resizeMode="cover" />
      <View style={styles.choiceShade} />
      <Text style={[styles.budgetStatus, kept && styles.budgetStatusKept]}>{kept ? "Keep" : "Cut"}</Text>
      <Text style={styles.budgetSize}>{formatMB(photo.sizeMB)}</Text>
    </Pressable>
  );
}

function FullPhotoModal({ photo, onClose }: { photo: NativePhoto | null; onClose: () => void }) {
  return (
    <Modal visible={photo !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.fullPhotoOverlay}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.fullPhotoClose}>
          <Ionicons name="close" size={24} color={colors.white} />
        </Pressable>
        {photo ? (
          <>
            <Image source={{ uri: photo.uri }} style={styles.fullPhotoImage} resizeMode="contain" />
            <View style={styles.fullPhotoCaption}>
              <Text style={styles.fullPhotoTitle} numberOfLines={1}>{photo.title}</Text>
              <Text style={styles.fullPhotoMeta}>{photo.month} {photo.year} - {formatMB(photo.sizeMB)}</Text>
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

function QueuePhotoRow({ photo }: { photo: NativePhoto }) {
  return (
    <View style={styles.reviewRow}>
      <Image source={{ uri: photo.uri }} style={styles.reviewThumb} resizeMode="cover" />
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
        {photo ? <Image source={{ uri: photo.uri }} style={styles.qualityThumb} resizeMode="cover" /> : null}
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
      <Segmented
        label="Trim output"
        value={settings.trimOutputMode}
        options={[["replace", "Replace originals"], ["save-new", "Save as new"]]}
        onChange={(trimOutputMode) => onChange({ trimOutputMode })}
      />
      <QualityPreview photo={samplePhoto} currentQuality={settings.trimQuality} />
      <BooleanSetting label="Larger controls" detail="Roomier buttons and key text for easier one-handed use." value={settings.largeText} onChange={(largeText) => onChange({ largeText })} />
      <BooleanSetting label="High contrast" detail="Deepens the app background and panel borders." value={settings.highContrast} onChange={(highContrast) => onChange({ highContrast })} />
      <PrimaryButton label="Reload with these settings" onPress={onReload} />
    </ScrollView>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function BottomNav({ screen, onChange }: { screen: Screen; onChange: (screen: Screen) => void }) {
  const gamesActive = screen === "games" || screen === "swipe" || screen === "this-or-that" || screen === "storage-budget" || screen === "memory-lane";
  return (
    <View style={styles.bottomNav}>
      <NavButton label="Home" active={screen === "home"} onPress={() => onChange("home")} />
      <NavButton label="Games" active={gamesActive} onPress={() => onChange("games")} />
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
  toastWrap: { position: "absolute", top: 58, left: 18, right: 18, zIndex: 1000 },
  toast: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#fed7aa", padding: 14, shadowColor: "#1f2937", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  toastSuccess: { borderColor: "#86efac", backgroundColor: "#f0fdf4" },
  toastWarning: { borderColor: "#fdba74", backgroundColor: "#fff7ed" },
  toastError: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  toastTitle: { color: "#1f2937", fontSize: 13, fontWeight: "900" },
  toastDetail: { marginTop: 2, color: "#64748b", fontSize: 12, lineHeight: 16, fontWeight: "600" },
  confirmBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "rgba(31, 41, 55, 0.34)" },
  confirmSheet: { width: "100%", maxWidth: 420, borderRadius: 26, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#fed7aa", padding: 20, gap: 12, shadowColor: "#1f2937", shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 16 }, elevation: 8 },
  confirmIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#ffedd5", borderWidth: 1, borderColor: "#fed7aa" },
  confirmTitle: { color: "#111827", fontSize: 21, fontWeight: "900" },
  confirmDetail: { color: "#64748b", fontSize: 13, lineHeight: 19, fontWeight: "700" },
  confirmActions: { marginTop: 4, gap: 10 },

  // Swipe
  swipeHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14, borderRadius: 22, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 16 },
  swipeHeaderCopy: { flex: 1 },
  swipeTitle: { marginTop: 5, color: "#1f2937", fontSize: 18, fontWeight: "900" },
  swipeTitleLarge: { fontSize: 22 },
  swipeSubtitle: { marginTop: 5, color: "#64748b", fontSize: 12, lineHeight: 17 },
  swipeStatusColumn: { alignItems: "flex-end", gap: 8 },
  queuePill: { overflow: "hidden", borderRadius: 999, backgroundColor: "#ffedd5", color: "#c2410c", paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: "900" },
  timerPill: { overflow: "hidden", borderRadius: 999, backgroundColor: "#fef3c7", color: "#b45309", paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: "900" },
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
  reviewMoveButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#fff7ed", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa" },
  checkbox: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: "#d1d5db",
    alignItems: "center", justifyContent: "center", backgroundColor: "#fff",
  },
  checkboxOn: { backgroundColor: "#f97316", borderColor: "#f97316" },
  checkboxMark: { color: "#fff", fontWeight: "900", fontSize: 14 },
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
  gamesVisualHero: { overflow: "hidden", borderRadius: 24, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 18, gap: 14 },
  gamesHeroCopy: { flex: 1, gap: 4 },
  gameTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  heroPhotoStrip: { height: 118, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  heroPhoto: { width: "31%", height: 104, borderRadius: 18, backgroundColor: "#ffedd5", borderWidth: 3, borderColor: "#ffffff" },
  heroPhotoRaised: { height: 118, transform: [{ translateY: -4 }] },
  heroPhotoFallback: { flex: 1, height: 112, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#fb923c" },
  gamesStatsRow: { flexDirection: "row", gap: 8 },
  gameMetric: { flex: 1, alignItems: "center", borderRadius: 16, backgroundColor: "#fff7ed", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", paddingVertical: 10, gap: 2 },
  gameMetricValue: { color: "#1f2937", fontSize: 20, fontWeight: "900" },
  gameMetricLabel: { color: "#64748b", fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  homeStatRow: { flexDirection: "row", gap: 8 },
  homeStat: { flex: 1, borderRadius: 16, backgroundColor: "#fff7ed", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 12 },
  homeStatValue: { color: "#c2410c", fontSize: 22, fontWeight: "900" },
  scanQuickCard: { borderRadius: 20, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 16 },
  scanQuickCopy: { flex: 1, gap: 3 },
  scanMiniButton: { alignSelf: "center", borderRadius: 16, backgroundColor: "#f97316", paddingHorizontal: 16, paddingVertical: 11 },
  scanMiniButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  gameGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  primaryGameCard: { width: "100%", borderRadius: 24, backgroundColor: "#f97316", padding: 20, gap: 8, shadowColor: "#fb923c", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 6 },
  primaryGameVisualCard: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 24, backgroundColor: "#f97316", padding: 20, gap: 14, shadowColor: "#fb923c", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 6 },
  primaryGameText: { flex: 1, gap: 8 },
  primaryGameIcons: { flexDirection: "row", gap: 7 },
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
  visualGameCard: { width: "48%", overflow: "hidden", borderRadius: 20, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#fed7aa", padding: 9, gap: 9 },
  visualGameCardActive: { backgroundColor: "#ffedd5", borderColor: "#fb923c" },
  visualGameImageWrap: { position: "relative", height: 94, overflow: "hidden", borderRadius: 16, backgroundColor: "#fff7ed" },
  visualGameImage: { width: "100%", height: "100%" },
  visualGameFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: "#fff7ed" },
  visualGameIcon: { position: "absolute", right: 8, top: 8, width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "rgba(249, 115, 22, 0.92)" },

  // Mini game shared
  miniGameHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  miniGameHeaderCopy: { flex: 1 },
  tokenPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, backgroundColor: "#fef3c7", borderWidth: StyleSheet.hairlineWidth, borderColor: "#f59e0b", paddingHorizontal: 10, paddingVertical: 7 },
  tokenPillText: { color: "#92400e", fontSize: 13, fontWeight: "900" },
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
  budgetDecisionCard: { gap: 14, borderRadius: 22, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#fed7aa", padding: 16 },
  budgetDecisionTitle: { color: "#1f2937", fontSize: 21, fontWeight: "900" },
  budgetChoiceRow: { gap: 10 },
  budgetChoice: { borderRadius: 18, borderWidth: 1, borderColor: "#fed7aa", backgroundColor: "#fff7ed", padding: 14 },
  budgetChoiceSelected: { borderColor: "#f97316", backgroundColor: "#ffedd5" },
  budgetChoiceTitle: { color: "#1f2937", fontSize: 15, fontWeight: "900" },
  budgetChoiceTitleSelected: { color: "#c2410c" },
  budgetChoiceDetail: { marginTop: 3, color: "#64748b", fontSize: 12, fontWeight: "700" },
  budgetDecisionActions: { gap: 10 },

  fullPhotoOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.96)", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  fullPhotoClose: { position: "absolute", top: 54, right: 22, zIndex: 2, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  fullPhotoImage: { width: "100%", height: "78%" },
  fullPhotoCaption: { position: "absolute", left: 20, right: 20, bottom: 38, borderRadius: 18, backgroundColor: "rgba(15, 23, 42, 0.72)", padding: 14 },
  fullPhotoTitle: { color: "#ffffff", fontSize: 16, fontWeight: "900" },
  fullPhotoMeta: { marginTop: 3, color: "#cbd5e1", fontSize: 12, fontWeight: "700" },

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
  bottomNav: { position: "absolute", left: 14, right: 14, bottom: 14, flexDirection: "row", gap: 8, borderRadius: 30, backgroundColor: "rgba(255, 255, 255, 0.98)", borderWidth: 1, borderColor: "#f59e0b", padding: 8, shadowColor: "#fb923c", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 22, elevation: 8 },
  navButton: { flex: 1, alignItems: "center", borderRadius: 16, paddingVertical: 11 },
  navButtonActive: { backgroundColor: "#fb923c" },
  navText: { color: "#9a3412", fontSize: 12, fontWeight: "900" },
  navTextActive: { color: "#ffffff" },
});
