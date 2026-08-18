import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import { reloadAppAsync } from "expo";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  Image,
  I18nManager,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import {
  cleanupPreparedTrims,
  commitTrims,
  commitTrimsAndDeletes,
  deletePhotos,
  estimateTrimSavings,
  getPhotoPermissionStatus,
  getTrimStatus,
  loadCleanupPlan,
  loadDuplicatePhotoGroups,
  loadPhotoRound,
  prepareTrimPhoto,
  requestPhotoPermission,
  scanPhotoLibrary,
  type NativeCleanupCategory,
  type NativeCleanupPlan,
  type NativeLibraryScan,
  type NativeLibraryScanProgress,
  type NativePhoto,
  type NativePhotoPermission,
  type PreparedTrim,
} from "../lib/native-photo-source";
import { loadDailyCleanupPlan, type DailyCleanupPlan } from "../lib/daily-photo-cleanup";
import { loadQuickCleanupLibrary, type QuickCleanupLibrary } from "../lib/quick-cleanup-service";
import {
  clearQuickCleanupReviewCache,
  loadQuickCleanupReviewCache,
  saveQuickCleanupReviewCache,
} from "../lib/quick-cleanup-cache";
import { loadPhotoProtectionStore, savePhotoProtectionStore, setPhotoProtection as updatePhotoProtection, type PhotoProtectionStore } from "../lib/photo-protection";
import {
  loadNativePhotoReviewLedger,
  recordNativePhotoReview,
  recordNativePhotoTrim,
  saveNativePhotoReviewLedger,
  shouldExcludeReviewedPhoto,
  type NativePhotoReviewLedger,
} from "../lib/native-review-ledger";
import {
  DEFAULT_FREE_SPACE_PLAN,
  DEFAULT_NATIVE_STATS,
  EMPTY_DAILY_STATS,
  loadNativeStats,
  MAX_PHOTO_AGE_THRESHOLD_YEARS,
  MAX_PHOTO_SIZE_THRESHOLD_MB,
  saveNativeStats,
  type NativeActionLogEntry,
  type NativeActionType,
  type AppLanguage,
  type NativeBackgroundScanSchedule,
  type NativeDailyStats,
  type NativeSeenPhoto,
  type NativeSessionMode,
  type NativeSettings,
  type NativeStats,
  type NativeTargetMode,
  type NativeTrimKind,
} from "../lib/native-store";
import { APP_LANGUAGES, t } from "../lib/i18n";
import { HomeDashboard } from "./HomeDashboard";
import { DailyCleanupReview } from "./DailyCleanupReview";
import { QuickCleanupReview } from "./QuickCleanupReview";
import type { DailyRewardState } from "./HomeDashboard";
import { StatsDashboard } from "./StatsDashboard";
import { OnboardingCarousel } from "./OnboardingCarousel";
import { TrimScreen } from "./TrimScreen";
import { ShopScreen } from "./ShopScreen";
import { DuplicateClusterReview, type DuplicateCluster } from "./DuplicateClusterReview";
import { GameFilterSlider } from "./GameFilterSlider";
import { SwipeMidsetAdCard } from "./SwipeMidsetAdCard";
import { addTokens, subscribeTokens, spendTokens, DAILY_CLAIM_TOKENS } from "../lib/tokens";
import {
  getPurchaseAccessStatus,
  LIFETIME_PRODUCT_ID,
  MONTHLY_PRODUCT_ID,
  restorePurchasesPublic,
  YEARLY_PRODUCT_ID,
} from "../lib/purchases";
import { loadAccountSession, setAccountSignedIn } from "../lib/account-session";
import {
  initAds,
  loadSwipeMidsetNativeAd,
  openAdInspector,
  openAdsPrivacyOptions,
  showInterstitialAd,
  showRewardedAd,
  type LoadedSwipeMidsetNativeAd,
} from "../lib/ads";
import { colors, radius, spacing, type } from "../constants/design";
import { getNativeTheme, NATIVE_THEME_OPTIONS, type NativeThemePalette } from "../constants/themes";
import {
  ensureCleanupNotifications,
  notifyCleanupProgress,
  registerCleanupBackgroundTask,
} from "../lib/progress-notifications";
import {
  subscribeToReminderResponses,
  syncRemoteCleanupReminders,
} from "../lib/remote-reminders";
import {
  DAILY_TRIM_REMINDER_PROMPT_VERSION,
  getDailyTrimReminderPermission,
  reconcileDailyTrimReminder,
  requestDailyTrimReminderPermission,
  scheduleDailyTrimReminder,
  cancelDailyTrimReminder,
} from "../lib/daily-trim-reminder";
import { hasReachedMidset, shouldPresentMidsetAd } from "../lib/swipe-midset";

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
  | "automation"
  | "cleanup-plan"
  | "quick-cleanup"
  | "daily-cleanup"
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
const APP_VERSION =
  Constants.expoConfig?.version ??
  (Constants.manifest as { version?: string } | null)?.version ??
  "1.1.0";
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_REVIEW_TARGET = 10;
const WEEKLY_SAVINGS_TARGET_MB = 500;
const FOUR_K_VIDEO_MB_PER_MINUTE = 375;
const TIME_ATTACK_SECONDS = 60;
const SELECTION_GRACE_DAYS = 7;
const SEEN_PHOTO_LIMIT = 500;
const BULK_TRIM_LIMIT = 50;
const APP_STORE_URL =
  process.env.EXPO_PUBLIC_APP_STORE_URL ?? "https://apps.apple.com/app/id6764543618";
const GAME_IMAGES = {
  swipe: require("../assets/images/games/trimswipe.png") as ImageSourcePropType,
  choice: require("../assets/images/games/this-or-that.png") as ImageSourcePropType,
  budget: require("../assets/images/games/storage-budget.png") as ImageSourcePropType,
  speed: require("../assets/images/games/speed-round.png") as ImageSourcePropType,
  memory: require("../assets/images/games/memory-lane.png") as ImageSourcePropType,
} as const;
// Storage budget game: target a 60-75 MB pool so users make real choices against the 50 MB keep limit.
const BUDGET_MIN_POOL_MB = 60;
const BUDGET_MAX_POOL_MB = 75;
const BUDGET_KEEP_LIMIT_MB = 50;
const WEEKDAY_LABELS = [
  "ui.weekday-sun",
  "ui.weekday-mon",
  "ui.weekday-tue",
  "ui.weekday-wed",
  "ui.weekday-thu",
  "ui.weekday-fri",
  "ui.weekday-sat",
];
const REPORT_PERIODS = ["weekly", "monthly"] as const;
const FALLBACK_TARGET_MODES: NativeTargetMode[] = [
  "big-only",
  "old-only",
  "similar",
  "screenshots",
  "multibursts",
  "blurry",
  "balanced",
];

type ReportPeriod = (typeof REPORT_PERIODS)[number];

function formatMB(value: number): string {
  return value >= 1024 ? `${(value / 1024).toFixed(2)} GB` : `${value.toFixed(1)} MB`;
}

function formatScanProgress(progress: NativeLibraryScanProgress): string {
  if (progress.phase === "similarity") {
    const analyzed = progress.analyzed ?? 0;
    const total = progress.analysisTotal ?? 0;
    return total > 0 ? t("ui.scan-verifying", { analyzed, total }) : t("ui.verifying-similarity");
  }
  return progress.total
    ? t("ui.scan-progress", { scanned: progress.scanned, total: progress.total })
    : t("ui.scan-progress-count", { scanned: progress.scanned });
}

function cleanupPlanSavings(plan: NativeCleanupPlan): number {
  return plan.estimatedDeleteSavingsMB + plan.estimatedTrimSavingsMB;
}

function cleanupPlanActionCount(plan: NativeCleanupPlan): number {
  return plan.deleteCandidates.length + plan.trimCandidates.length;
}

function scheduleTimeLabel(times: string[]): string {
  return times.length === 1 ? times[0] : t("ui.times-per-day", { count: times.length });
}

function scheduleDaysLabel(days: number[]): string {
  if (days.length === 7) return t("ui.every-day");
  const ordered = [...days].sort((a, b) => a - b);
  if (ordered.join(",") === "1,2,3,4,5") return t("ui.weekdays");
  if (ordered.join(",") === "0,6") return t("ui.weekends");
  return ordered.map((day) => WEEKDAY_LABELS[day] ? t(WEEKDAY_LABELS[day]) : "").filter(Boolean).join(", ");
}

function localTimeKey(date = new Date()): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function lastRunMatches(schedule: NativeBackgroundScanSchedule, day: string, time: string): boolean {
  if (!schedule.lastRunAt) return false;
  const last = new Date(schedule.lastRunAt);
  if (Number.isNaN(last.getTime())) return false;
  return dateKey(last) === day && localTimeKey(last) === time;
}

function dueScheduleTime(schedule: NativeBackgroundScanSchedule, now = new Date()): string | null {
  if (!schedule.active || schedule.days.length === 0 || schedule.times.length === 0) return null;
  const day = dateKey(now);
  const time = localTimeKey(now);
  if (!schedule.days.includes(now.getDay())) return null;
  if (!schedule.times.includes(time)) return null;
  return lastRunMatches(schedule, day, time) ? null : time;
}

function shiftScheduleTime(time: string, minutes: number): string {
  const [hour = "0", minute = "0"] = time.split(":");
  const total = (Number(hour) * 60 + Number(minute) + minutes + 24 * 60) % (24 * 60);
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}

function uniqueSortedTimes(times: string[]): string[] {
  return [...new Set(times)].sort((a, b) => a.localeCompare(b)).slice(0, 5);
}

type ReportDashboardData = {
  title: string;
  rangeLabel: string;
  beforeTotal: number;
  afterTotal: number;
  periodStats: NativeDailyStats;
  trimPercent: number;
  deletePercent: number;
};

type BackgroundTrimResult = {
  requested: number;
  trimmed: number;
  failed: number;
  beforeMB: number;
  afterMB: number;
  savedMB: number;
};

function reportStatsForPeriod(stats: NativeStats, period: ReportPeriod): NativeDailyStats {
  return period === "weekly" ? sumDays(stats, 7) : monthStats(stats);
}

function reportDashboardData(stats: NativeStats, period: ReportPeriod): ReportDashboardData {
  const periodStats = reportStatsForPeriod(stats, period);
  const beforeTotal = Math.max(0, stats.mbFreed - periodStats.mbFreed);
  const afterTotal = stats.mbFreed;
  const title = period === "weekly" ? t("ui.weekly-report") : t("ui.monthly-report");
  const rangeLabel = period === "weekly" ? t("ui.last-7-days") : t("ui.this-month");
  const total = Math.max(1, periodStats.trimMbFreed + periodStats.deleteMbFreed);
  return {
    title,
    rangeLabel,
    beforeTotal,
    afterTotal,
    periodStats,
    trimPercent: Math.round((periodStats.trimMbFreed / total) * 100),
    deletePercent: Math.round((periodStats.deleteMbFreed / total) * 100),
  };
}

function cleanupReportText(stats: NativeStats, period: ReportPeriod): string {
  const data = reportDashboardData(stats, period);
  const { periodStats } = data;
  const title = period === "weekly" ? t("ui.weekly-trimswipe-report") : t("ui.monthly-trimswipe-report");
  return [
    title,
    "",
    t("ui.report-before", { value: formatMB(data.beforeTotal), period: period === "weekly" ? t("ui.week") : t("ui.month") }),
    t("ui.report-after", { value: formatMB(data.afterTotal) }),
    t("ui.report-progress", { period: period === "weekly" ? t("ui.week") : t("ui.month"), value: formatMB(periodStats.mbFreed), count: periodStats.reviewed }),
    t("ui.report-trimmed", { count: periodStats.trimmed, value: formatMB(periodStats.trimMbFreed) }),
    t("ui.report-deleted", { count: periodStats.deleted, value: formatMB(periodStats.deleteMbFreed) }),
    t("ui.report-kept", { count: periodStats.kept }),
  ].join("\n");
}

function cleanupReportHtml(stats: NativeStats, period: ReportPeriod): string {
  const data = reportDashboardData(stats, period);
  const { periodStats } = data;
  const trimWidth = Math.max(2, data.trimPercent);
  const deleteWidth = Math.max(2, data.deletePercent);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; padding: 32px; background: #f3f6f8; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; color: #1f2937; }
      .card { border-radius: 28px; background: #ffffff; border: 1px solid #cbd8e0; padding: 28px; }
      .eyebrow { color: #315f7d; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
      h1 { margin: 8px 0 4px; font-size: 36px; }
      .muted { color: #64748b; font-size: 15px; }
      .hero { margin-top: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .metric { border-radius: 20px; background: #f3f6f8; padding: 18px; border: 1px solid #cbd8e0; }
      .label { color: #274b61; font-size: 12px; font-weight: 700; text-transform: uppercase; }
      .value { margin-top: 6px; font-size: 30px; font-weight: 700; }
      .big { margin-top: 18px; border-radius: 24px; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; }
      .big .value { color: #16a34a; font-size: 44px; }
      .bar { height: 14px; border-radius: 999px; background: #e5ebef; overflow: hidden; display: flex; margin-top: 14px; }
      .trim { width: ${trimWidth}%; background: #4f7892; }
      .delete { width: ${deleteWidth}%; background: #ef4444; }
      .grid { margin-top: 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .small { border-radius: 18px; background: #ffffff; border: 1px solid #cbd8e0; padding: 16px; }
      .small .value { font-size: 28px; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="eyebrow">${t("ui.trimswipe")}</div>
      <h1>${data.title}</h1>
      <div class="muted">${t("ui.report-range-progress", { range: data.rangeLabel })}</div>
      <div class="hero">
        <div class="metric"><div class="label">${t("ui.before")}</div><div class="value">${formatMB(data.beforeTotal)}</div><div class="muted">${t("ui.previously-reclaimed")}</div></div>
        <div class="metric"><div class="label">${t("ui.after")}</div><div class="value">${formatMB(data.afterTotal)}</div><div class="muted">${t("ui.reclaimed-total")}</div></div>
      </div>
      <div class="big"><div class="label">${t("ui.progress")}</div><div class="value">${formatMB(periodStats.mbFreed)}</div><div class="muted">${t("ui.photos-reviewed-count", { count: periodStats.reviewed })}</div><div class="bar"><div class="trim"></div><div class="delete"></div></div></div>
      <div class="grid">
        <div class="small"><div class="label">${t("ui.kept")}</div><div class="value">${periodStats.kept}</div></div>
        <div class="small"><div class="label">${t("ui.trimmed")}</div><div class="value">${periodStats.trimmed}</div></div>
        <div class="small"><div class="label">${t("ui.deleted")}</div><div class="value">${periodStats.deleted}</div></div>
      </div>
    </div>
  </body>
</html>`;
}

function roundSettings(settings: NativeSettings): NativeSettings {
  const trimKinds = settings.trimKinds.filter(
    (kind): kind is NativeTrimKind => kind === "metadata" || kind === "location" || kind === "compression",
  );
  return {
    ...settings,
    cardsPerRound: Math.min(30, Math.max(5, Math.round(settings.cardsPerRound) || 10)),
    minSizeMB: Math.min(
      MAX_PHOTO_SIZE_THRESHOLD_MB,
      Math.max(0.5, Math.round(settings.minSizeMB * 2) / 2),
    ),
    minAgeYears: Math.min(
      MAX_PHOTO_AGE_THRESHOLD_YEARS,
      Math.max(0, Math.round(settings.minAgeYears * 12) / 12),
    ),
    trimQuality: Math.min(0.98, Math.max(0.5, settings.trimQuality)),
    trimKinds: trimKinds.length > 0 ? [...new Set(trimKinds)] : ["metadata", "location", "compression"],
    trimReviewMode: settings.trimReviewMode === "trimmed-only" || settings.trimReviewMode === "all" ? settings.trimReviewMode : "normal",
    largeText: false,
    highContrast: false,
  };
}

function targetLabel(settings: NativeSettings): string {
  const prefix = settings.trimReviewMode === "trimmed-only" ? `${t("ui.trimmed-only")} ` : "";
  if (settings.targetMode === "balanced") return `${prefix}${t("ui.balanced")}`;
  if (settings.targetMode === "big-only") return `${prefix}${t("ui.target-big-only", { value: formatSizeThreshold(settings.minSizeMB) })}`;
  if (settings.targetMode === "old-only") return `${prefix}${t("ui.target-old-only", { value: formatAgeThreshold(settings.minAgeYears) })}`;
  if (settings.targetMode === "old-and-large") {
    return `${prefix}${t("ui.target-old-and-large", { age: formatAgeThreshold(settings.minAgeYears), size: formatSizeThreshold(settings.minSizeMB) })}`;
  }
  if (settings.targetMode === "duplicates" || settings.targetMode === "similar") return `${prefix}${t("ui.similar-photos")}`;
  if (settings.targetMode === "blurry" || settings.targetMode === "mistakes") return `${prefix}${t("ui.blurry")}`;
  if (settings.targetMode === "screenshots") return `${prefix}${t("ui.screenshots")}`;
  if (settings.targetMode === "live-photos") return `${prefix}${t("ui.live-photos")}`;
  if (settings.targetMode === "multibursts" || settings.targetMode === "bursts") return `${prefix}${t("ui.multibursts")}`;
  if (settings.targetMode === "icloud") return `${prefix}${t("ui.icloud-heavy")}`;
  return `${prefix}${t("ui.target-balanced-range", { size: formatSizeThreshold(settings.minSizeMB), age: formatAgeThreshold(settings.minAgeYears) })}`;
}

function formatSizeThreshold(value: number): string {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} MB`;
}

function formatAgeThreshold(years: number): string {
  if (years <= 0) return t("ui.age-today");
  if (years < 1) {
    const months = Math.max(1, Math.round(years * 12));
    return t("ui.age-months-plus", { count: months });
  }
  return t("ui.age-years-plus", { count: Number.isInteger(years) ? years.toFixed(0) : years.toFixed(1) });
}

function formatGameSizeThreshold(value: number): string {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} MB`;
}

function formatGameAgeThreshold(years: number): string {
  if (years <= 0) return t("ui.age-today");
  if (years < 1) {
    const months = Math.max(1, Math.round(years * 12));
    return t("ui.age-months", { count: months });
  }
  return t("ui.age-years", { count: Number.isInteger(years) ? years.toFixed(0) : years.toFixed(1) });
}

function formatReminderTime(value: string): string {
  const [hour = "20", minute = "30"] = value.split(":");
  const date = new Date(2000, 0, 1, Number(hour), Number(minute));
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function reminderPickerDate(value: string): Date {
  const [hourText = "20", minuteText = "30"] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date();
  date.setHours(Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : 20, Number.isFinite(minute) ? Math.max(0, Math.min(59, minute)) : 30, 0, 0);
  return date;
}

function reminderPickerValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function gameAgeYears(createdAt: number): number {
  return (Date.now() - createdAt) / (365.25 * 24 * 3600 * 1000);
}

function nextFallbackTargetMode(current: NativeTargetMode): NativeTargetMode {
  const index = FALLBACK_TARGET_MODES.indexOf(current);
  if (index < 0) return "balanced";
  return FALLBACK_TARGET_MODES[(index + 1) % FALLBACK_TARGET_MODES.length] ?? "balanced";
}

function sessionModeLabel(mode: NativeSessionMode): string {
  if (mode === "endless") return t("ui.session-endless");
  if (mode === "time-attack") return t("ui.time-attack");
  return t("ui.session-classic");
}

function actionVerb(action: NativeActionType): string {
  if (action === "trim") return t("ui.trimmed");
  if (action === "delete") return t("ui.deleted");
  return t("ui.kept");
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

function dailyRewardState(stats: NativeStats): DailyRewardState {
  const today = dateKey();
  const claimedToday = (stats.dailyRewardClaims[today] ?? 0) > 0;
  return {
    canClaimToday: !claimedToday,
    claimedToday,
    rewardAmount: DAILY_CLAIM_TOKENS,
    nextResetLabel: "00:00",
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
  const titles = [t("ui.fresh-start"), t("ui.space-saver"), t("ui.camera-roll-pro"), t("ui.storage-guardian")];
  const title = titles[Math.min(titles.length - 1, Math.floor((level - 1) / 3))];
  return { level, title, progress, next: t("ui.points-to-level", { count: Math.ceil(25 - (points % 25)), level: level + 1 }) };
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

function recentSelectionIds(
  stats: NativeStats,
  ledger?: NativePhotoReviewLedger | null,
  includePreviouslyReviewed = false,
): string[] {
  const cutoff = Date.now() - SELECTION_GRACE_DAYS * DAY_MS;
  const ids = new Set<string>();
  if (!includePreviouslyReviewed) {
    stats.recentSeenPhotos.forEach((item) => {
      const seenAt = Date.parse(item.lastSeenAt);
      if (!Number.isNaN(seenAt) && seenAt >= cutoff) ids.add(item.photoId);
    });
    stats.actionLog.forEach((item) => {
      const actedAt = Date.parse(item.createdAt);
      if (!Number.isNaN(actedAt) && actedAt >= cutoff) ids.add(item.photoId);
    });
  }
  if (ledger) {
    Object.keys(ledger.records).forEach((photoId) => {
      if (shouldExcludeReviewedPhoto(ledger, photoId, { includePreviouslyReviewed })) ids.add(photoId);
    });
  }
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
    t("ui.share-month", { value: formatMB(month.mbFreed) }),
    t("ui.share-summary", { reviewed: stats.reviewed, trimmed: stats.trimmed, deleted: stats.deleted }),
    t("ui.share-week", { value: formatMB(week.mbFreed) }),
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
      <Text style={{ position: "absolute", color: "#315f7d", fontSize: size * 0.28, fontWeight: "700" }}>
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
      color: ["#315f7d", "#22c55e", "#3f6f8d", "#3b82f6", "#ec4899"][Math.floor(Math.random() * 5)],
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
  // Subscribe the app shell to i18next's languageChanged event. Most native
  // screens use the shared `t` helper, so the shell subscription ensures the
  // whole tree re-renders immediately after a language switch.
  const { i18n: translationI18n } = useTranslation();
  const [screen, setScreen] = useState<Screen>("home");
  const [stats, setStats] = useState<NativeStats>(DEFAULT_NATIVE_STATS);
  const [reviewLedger, setReviewLedger] = useState<NativePhotoReviewLedger | null>(null);
  const [queue, setQueue] = useState<NativePhoto[]>([]);
  const [swipeRoundId, setSwipeRoundId] = useState(0);
  const [swipeRoundInitialCount, setSwipeRoundInitialCount] = useState(0);
  const [midsetAdDismissed, setMidsetAdDismissed] = useState(false);
  const [midsetAdVisible, setMidsetAdVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [permissionLimited, setPermissionLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recap, setRecap] = useState<SessionRecap | null>(null);
  const [pendingDeletes, setPendingDeletes] = useState<NativePhoto[]>([]);
  const [trimmingCount, setTrimmingCount] = useState(0);
  const [trimActionPickerVisible, setTrimActionPickerVisible] = useState(false);
  const [trimActionLoading, setTrimActionLoading] = useState(false);
  const [backgroundTrimResult, setBackgroundTrimResult] = useState<BackgroundTrimResult | null>(null);
  const [trimResultVisible, setTrimResultVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [libraryScan, setLibraryScan] = useState<NativeLibraryScan | null>(null);
  const [scanProgress, setScanProgress] = useState<NativeLibraryScanProgress | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cleanupPlan, setCleanupPlan] = useState<NativeCleanupPlan | null>(null);
  const [cleanupPlanBusy, setCleanupPlanBusy] = useState(false);
  const [quickCleanupLibrary, setQuickCleanupLibrary] = useState<QuickCleanupLibrary | null>(null);
  const [quickCleanupBusy, setQuickCleanupBusy] = useState(false);
  const [quickCleanupError, setQuickCleanupError] = useState<"permission" | "error" | null>(null);
  const [quickCleanupProgress, setQuickCleanupProgress] = useState<NativeLibraryScanProgress | null>(null);
  const [pendingQuickCleanupOpen, setPendingQuickCleanupOpen] = useState(false);
  const [photoProtection, setPhotoProtection] = useState<PhotoProtectionStore | null>(null);
  const [dailyCleanupPlan, setDailyCleanupPlan] = useState<DailyCleanupPlan | null>(null);
  const [dailyCleanupBusy, setDailyCleanupBusy] = useState(false);
  const [dailyCleanupError, setDailyCleanupError] = useState<"permission" | "error" | null>(null);
  const [dailyReminderPromptVisible, setDailyReminderPromptVisible] = useState(false);
  const [dailyReminderPermission, setDailyReminderPermission] = useState<{ granted: boolean; blocked: boolean }>({ granted: false, blocked: false });
  const sessionRef = useRef<SessionRecap>({ kept: 0, trimmed: 0, deleted: 0, freed: 0 });
  const pendingDeletesRef = useRef<NativePhoto[]>([]);
  const pendingTrimsRef = useRef<NativePhoto[]>([]);
  const preparedTrimPromisesRef = useRef<Map<string, Promise<PreparedTrim>>>(new Map());
  const trimPreparationChainRef = useRef<Promise<void>>(Promise.resolve());
  const [pendingTrims, setPendingTrims] = useState<NativePhoto[]>([]);
  const [tokenBalance, setTokenBalance] = useState<number>(10);
  const [isPro, setIsPro] = useState(false);
  const [purchaseAccessReady, setPurchaseAccessReady] = useState(false);
  const [hasUnlimitedTrims, setHasUnlimitedTrims] = useState(false);
  const isProRef = useRef(false);
  const [accountSignedIn, setAccountSignedInState] = useState(true);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [adBusy, setAdBusy] = useState(false);
  const cleanupCompletionsRef = useRef(0);
  const shareShotRef = useRef<View>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod | null>(null);
  const [reportExportBusy, setReportExportBusy] = useState<"image" | "pdf" | null>(null);
  const applyingActionsRef = useRef(false);
  const settingsDirtyRef = useRef(false);
  const pendingSettingsRef = useRef<NativeSettings | null>(null);
  const scheduledScanBusyRef = useRef(false);
  const freeSpaceScanBusyRef = useRef(false);
  const startupQuickCleanupAttemptedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const reportCardRef = useRef<View>(null);

  const settings = roundSettings(stats.settings);
  useEffect(() => {
    void translationI18n.changeLanguage(settings.appLanguage);
  }, [settings.appLanguage, translationI18n]);
  const backgroundSchedulesRef = useRef(settings.backgroundScanSchedules);
  backgroundSchedulesRef.current = settings.backgroundScanSchedules;
  isProRef.current = isPro;
  const activeTheme = getNativeTheme(settings.theme);
  const top = queue[0];
  const next = queue[1];
  const trimCurrencyAvailable = hasUnlimitedTrims ? Number.MAX_SAFE_INTEGER : Math.max(0, tokenBalance);
  const onboardingDue = statsLoaded && !stats.onboardingComplete;
  const backgroundScheduleSignature = settings.backgroundScanSchedules
    .map((schedule) => `${schedule.id}:${schedule.active}:${schedule.days.join(",")}:${schedule.times.join(",")}:${schedule.targetMB}:${schedule.lastRunAt ?? ""}`)
    .join("|");
  const engagementPayload = {
    preferences: settings.smartReminders,
    snapshot: stats.engagementSnapshot,
    locale: settings.appLanguage,
    streak: currentStreak(stats),
    reviewedToday: dailyFor(stats, dateKey()).reviewed,
    lastCleanupAt: stats.actionLog.find((entry) => entry.action !== "keep")?.createdAt ?? null,
    lastActiveAt: stats.lastActiveAt,
  };

  function showToast(title: string, detail?: string, tone: ToastMessage["tone"] = "info") {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), title, detail, tone });
    toastTimerRef.current = setTimeout(() => setToast(null), 3800);
  }

  function requestConfirmation({
    title,
    detail,
    cancelLabel = t("ui.cancel"),
    confirmLabel = t("ui.done"),
    danger,
    runInBackground = false,
    onConfirm,
  }: {
    title: string;
    detail: string;
    cancelLabel?: string;
    confirmLabel?: string;
    danger?: boolean;
    runInBackground?: boolean;
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
          if (runInBackground) {
            setConfirmRequest(null);
            setConfirmBusy(false);
            resolve(0);
            showToast(t("ui.trim-started"), t("ui.you-can-keep-using-trimswipe-while-the-batch-run"), "info");
            void onConfirm()
              .then((count) => showToast(t("ui.trim-finished"), t("ui.photos-processed-count", { count }), "success"))
              .catch((err) => showToast(t("ui.trim-failed"), err instanceof Error ? err.message : t("ui.please-try-again"), "error"));
            return;
          }
          setConfirmBusy(true);
          try {
            close(await onConfirm());
          } catch (err) {
            close(0);
            showToast(t("ui.apply-failed"), err instanceof Error ? err.message : t("ui.please-try-again"), "error");
          }
        },
      });
    });
  }

  useEffect(() => {
    let cancelled = false;
    loadNativeStats().then(async (loaded) => {
      if (cancelled) return;
      const [ledger, protection, cachedQuickCleanup] = await Promise.all([
        loadNativePhotoReviewLedger(loaded),
        loadPhotoProtectionStore(),
        loadQuickCleanupReviewCache(),
      ]);
      if (cancelled) return;
      const shouldRestoreQuickCleanup = Boolean(cachedQuickCleanup);
      const activeStats = {
        ...loaded,
        lastActiveAt: new Date().toISOString(),
        freeSpacePlan: shouldRestoreQuickCleanup && cachedQuickCleanup
          ? {
              status: "ready" as const,
              startedAt: loaded.freeSpacePlan.startedAt,
              completedAt: loaded.freeSpacePlan.completedAt ?? new Date().toISOString(),
              estimatedSavingsMB: cachedQuickCleanup.plan.estimatedSavingsMB,
              estimatedTrimSavingsMB: cachedQuickCleanup.plan.selectedItems
                .filter((item) => item.action === "trim")
                .reduce((sum, item) => sum + item.estimatedSavingsMB, 0),
              estimatedDeleteSavingsMB: cachedQuickCleanup.plan.selectedItems
                .filter((item) => item.action === "delete")
                .reduce((sum, item) => sum + item.estimatedSavingsMB, 0),
              candidateCount: cachedQuickCleanup.plan.items.length,
              error: null,
            }
          : loaded.freeSpacePlan.status === "ready"
            ? DEFAULT_FREE_SPACE_PLAN
            : loaded.freeSpacePlan,
      };
      void saveNativeStats(activeStats);
      setStats(activeStats);
      if (shouldRestoreQuickCleanup) setQuickCleanupLibrary(cachedQuickCleanup);
      setReviewLedger(ledger);
      setPhotoProtection(protection);
      setStatsLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const unsub = subscribeTokens((s) => setTokenBalance(s.tokens));
    void Promise.all([loadAccountSession(), getPurchaseAccessStatus()])
      .then(([session, access]) => {
        setAccountSignedInState(session.signedIn);
        setIsPro(access.isPro);
        setHasUnlimitedTrims(access.hasUnlimitedTrims);
        setActiveProductId(access.activeProductId);
        setPurchaseAccessReady(true);
      })
      .catch(() => {
        setIsPro(false);
        setHasUnlimitedTrims(false);
        setActiveProductId(null);
        // Do not risk showing an ad to a Pro user when entitlement lookup failed.
        setPurchaseAccessReady(false);
    });
    void registerCleanupBackgroundTask();
    return () => unsub();
  }, []);

  // The listener is intentionally installed once; it reads current entitlement via refs.
  useEffect(
    () => subscribeToReminderResponses((destination) => {
      if (destination === "daily-cleanup") void openDailyCleanupReview();
      else if (destination === "quick-cleanup") setPendingQuickCleanupOpen(true);
      else setScreen(isProRef.current ? "automation" : "games");
    }),
    // The listener is intentionally installed once; the callback reads current entitlement via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!pendingQuickCleanupOpen || !statsLoaded) return;
    let active = true;
    if (quickCleanupLibrary) {
      setScreen("quick-cleanup");
      setPendingQuickCleanupOpen(false);
      return;
    }
    void loadQuickCleanupReviewCache().then((cached) => {
      if (!active) return;
      setPendingQuickCleanupOpen(false);
      if (cached) {
        setQuickCleanupLibrary(cached);
        setScreen("quick-cleanup");
        return;
      }
      setScreen("home");
      void startFreeSpacePlanScan();
    });
    return () => { active = false; };
    // The scan starter is a component command; state dependencies above
    // ensure this effect always runs with current settings and permissions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuickCleanupOpen, quickCleanupLibrary, statsLoaded]);

  useEffect(() => {
    if (!statsLoaded || stats.freeSpacePlan.status !== "scanning" || freeSpaceScanBusyRef.current) return;
    const notificationPermission = ensureCleanupNotifications(true);
    void runFreeSpacePlanScan(stats.freeSpacePlan.startedAt ?? new Date().toISOString(), notificationPermission);
    // Resume an interrupted user-requested scan when the app next becomes
    // active. The runner has its own single-flight guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.freeSpacePlan.startedAt, stats.freeSpacePlan.status, statsLoaded]);

  useEffect(() => {
    if (!statsLoaded || onboardingDue || startupQuickCleanupAttemptedRef.current) return;
    if (quickCleanupLibrary || stats.freeSpacePlan.status === "ready" || stats.freeSpacePlan.status === "scanning") {
      startupQuickCleanupAttemptedRef.current = true;
      return;
    }
    startupQuickCleanupAttemptedRef.current = true;
    void startFreeSpacePlanScan({ announce: false, requestNotificationPermission: false });
    // The startup preparation is deliberately single-shot. The scan runner
    // owns permission handling and single-flight protection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingDue, quickCleanupLibrary, stats.freeSpacePlan.status, statsLoaded]);

  useEffect(() => {
    if (!statsLoaded) return;
    let active = true;
    void (async () => {
      await translationI18n.changeLanguage(settings.appLanguage);
      if (!active) return;
      const permission = await reconcileDailyTrimReminder({
        enabled: settings.dailyTrimReminder.enabled,
        promptAcknowledged: stats.dailyTrimReminderPromptVersion >= DAILY_TRIM_REMINDER_PROMPT_VERSION,
        time: settings.dailyTrimReminder.time,
      });
      if (active) setDailyReminderPermission({ granted: permission.granted, blocked: permission.blocked });
    })();
    return () => {
      active = false;
    };
  }, [settings.appLanguage, settings.dailyTrimReminder.enabled, settings.dailyTrimReminder.time, stats.dailyTrimReminderPromptVersion, statsLoaded, translationI18n]);

  useEffect(() => {
    if (!statsLoaded || onboardingDue || stats.dailyTrimReminderPromptVersion >= DAILY_TRIM_REMINDER_PROMPT_VERSION) return;
    const timer = setTimeout(() => setDailyReminderPromptVisible(true), 350);
    return () => clearTimeout(timer);
  }, [onboardingDue, stats.dailyTrimReminderPromptVersion, statsLoaded]);

  useEffect(() => {
    if (!statsLoaded || !purchaseAccessReady) return;
    void syncRemoteCleanupReminders(
      isPro ? backgroundSchedulesRef.current : [],
      { requestPermission: false },
      engagementPayload,
    );
  }, [backgroundScheduleSignature, isPro, purchaseAccessReady, settings.appLanguage, statsLoaded, settings.smartReminders, stats.engagementSnapshot, stats.lastActiveAt]);

  useEffect(() => {
    if (!purchaseAccessReady || isPro) return;
    void initAds().catch(() => {});
  }, [isPro, purchaseAccessReady]);

  async function handleWatchAd() {
    if (adBusy) return;
    setAdBusy(true);
    try {
      const got = await showRewardedAd();
      if (got > 0) {
        showToast(t("ui.tokens-added"), t("ui.tokens-added-to-balance", { count: got }), "success");
      } else {
        showToast(t("ui.no-ad-available"), t("ui.please-try-again-in-a-moment"), "warning");
      }
    } finally {
      setAdBusy(false);
    }
  }

  function maybeShowInterstitialAfterCleanup(reviewedCount: number) {
    if (reviewedCount <= 0 || isPro) return;
    cleanupCompletionsRef.current += 1;
    // Show an interstitial after every second completed set / swipe round.
    if (cleanupCompletionsRef.current < 2) return;
    cleanupCompletionsRef.current = 0;
    void showInterstitialAd();
  }

  async function claimDailyTokens() {
    const reward = dailyRewardState(stats);
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
    showToast(t("ui.tokens-claimed"), t("ui.free-tokens-added", { count: reward.rewardAmount }), "success");
  }


  function commitStats(updater: (current: NativeStats) => NativeStats) {
    setStats((current) => {
      const next = updater(current);
      void saveNativeStats(next);
      return next;
    });
  }

  function completeOnboarding() {
    commitStats((current) => ({ ...current, onboardingComplete: true, onboardingVersion: APP_VERSION }));
  }

  async function setDailyReminderEnabled(enabled: boolean): Promise<void> {
    updateSettings({
      dailyTrimReminder: { ...(pendingSettingsRef.current ?? settings).dailyTrimReminder, enabled },
    });
    commitStats((current) => ({
      ...current,
      dailyTrimReminderPromptVersion: Math.max(current.dailyTrimReminderPromptVersion, DAILY_TRIM_REMINDER_PROMPT_VERSION),
    }));
    setDailyReminderPromptVisible(false);
    if (!enabled) {
      await cancelDailyTrimReminder();
      return;
    }

    let permission = await getDailyTrimReminderPermission();
    if (!permission.granted && permission.canAskAgain) {
      permission = await requestDailyTrimReminderPermission();
    }
    setDailyReminderPermission({ granted: permission.granted, blocked: permission.blocked });
    if (permission.granted) {
      await scheduleDailyTrimReminder((pendingSettingsRef.current ?? settings).dailyTrimReminder.time);
    } else {
      showToast(t("ui.notifications-are-off"), t("ui.daily-trim-reminder-system-blocked"), "warning");
    }
  }

  async function setDailyReminderTime(time: string): Promise<void> {
    const nextSettings = {
      ...(pendingSettingsRef.current ?? settings),
      dailyTrimReminder: {
        ...(pendingSettingsRef.current ?? settings).dailyTrimReminder,
        time,
      },
    };
    updateSettings({ dailyTrimReminder: nextSettings.dailyTrimReminder });
    if (!nextSettings.dailyTrimReminder.enabled) return;
    const permission = await getDailyTrimReminderPermission();
    setDailyReminderPermission({ granted: permission.granted, blocked: permission.blocked });
    if (permission.granted) await scheduleDailyTrimReminder(time);
  }

  function declineDailyReminderPrompt() {
    void setDailyReminderEnabled(false);
  }

  async function acceptDailyReminderPrompt() {
    await setDailyReminderEnabled(true);
  }

  async function openDailyCleanupReview() {
    setDailyCleanupPlan(null);
    setDailyCleanupError(null);
    setDailyCleanupBusy(true);
    setScreen("daily-cleanup");
    try {
      const permission = await requestPhotoPermission();
      if (!permission.granted) {
        setPermissionDenied(true);
        showToast(t("ui.photo-access-needed"), t("ui.open-ios-settings-to-preview-cleanup-folders"), "warning");
        setDailyCleanupError("permission");
        return;
      }
      setPermissionDenied(false);
      setDailyCleanupPlan(await loadDailyCleanupPlan(settings));
    } catch (error) {
      showToast(t("ui.preview-failed"), error instanceof Error ? error.message : t("ui.could-not-build-this-cleanup-folder"), "error");
      setDailyCleanupError("error");
    } finally {
      setDailyCleanupBusy(false);
    }
  }

  async function reviewFreeSpacePlan() {
    if (quickCleanupLibrary) {
      setScreen("quick-cleanup");
      return;
    }
    const cached = await loadQuickCleanupReviewCache();
    if (cached) {
      setQuickCleanupLibrary(cached);
      setScreen("quick-cleanup");
      return;
    }
    // A ready summary without its review cache is not actionable. Keep the
    // user on Home, rebuild once, and notify when the actual preview is ready.
    commitStats((current) => ({ ...current, freeSpacePlan: DEFAULT_FREE_SPACE_PLAN }));
    await startFreeSpacePlanScan();
  }

  async function runFreeSpacePlanScan(startedAt: string, notificationPermission?: Promise<boolean>) {
    if (freeSpaceScanBusyRef.current) return;
    freeSpaceScanBusyRef.current = true;
    setQuickCleanupBusy(true);
    setQuickCleanupProgress({ scanned: 0, phase: "indexing" });
    try {
      const permission = await requestPhotoPermission();
      if (!permission.granted) {
        setPermissionDenied(true);
        setQuickCleanupError("permission");
        commitStats((current) => ({
          ...current,
          freeSpacePlan: {
            ...current.freeSpacePlan,
            status: "failed",
            completedAt: new Date().toISOString(),
            error: "permission",
          },
        }));
        showToast(t("ui.photo-access-needed"), t("ui.open-ios-settings-to-preview-cleanup-folders"), "warning");
        return;
      }
      setPermissionDenied(false);
      const library = await loadQuickCleanupLibrary(settings, {
        budgetSeconds: 120,
        trimBalance: tokenBalance,
        unlimitedTrims: hasUnlimitedTrims,
        protection: photoProtection ?? undefined,
        reviewLedger,
        onProgress: setQuickCleanupProgress,
      });
      const cached = await saveQuickCleanupReviewCache(library);
      setQuickCleanupLibrary(library);
      const selected = library.plan.selectedItems;
      const estimatedTrimSavingsMB = selected
        .filter((item) => item.action === "trim")
        .reduce((sum, item) => sum + item.estimatedSavingsMB, 0);
      const estimatedDeleteSavingsMB = selected
        .filter((item) => item.action === "delete")
        .reduce((sum, item) => sum + item.estimatedSavingsMB, 0);
      const completedAt = new Date().toISOString();
      commitStats((current) => ({
        ...current,
        freeSpacePlan: {
          status: "ready",
          startedAt,
          completedAt,
          estimatedSavingsMB: library.plan.estimatedSavingsMB,
          estimatedTrimSavingsMB,
          estimatedDeleteSavingsMB,
          candidateCount: library.plan.items.length,
          error: null,
        },
      }));
      showToast(t("ui.trimswipe-scan-ready"), t("ui.scan-found-to-review", { value: formatMB(library.plan.estimatedSavingsMB) }), "success");
      const canNotify = cached && await (notificationPermission ?? ensureCleanupNotifications(false));
      if (canNotify) {
        await notifyCleanupProgress(
          t("ui.trimswipe-scan-ready"),
          t("ui.scan-found-to-review", { value: formatMB(library.plan.estimatedSavingsMB) }),
          { data: { type: "quick-cleanup-ready", screen: "quick-cleanup" }, requestPermission: false },
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("ui.could-not-scan-the-photo-library");
      setQuickCleanupError("error");
      commitStats((current) => ({
        ...current,
        freeSpacePlan: {
          ...current.freeSpacePlan,
          status: "failed",
          completedAt: new Date().toISOString(),
          error: message,
        },
      }));
      showToast(t("ui.preview-failed"), message, "error");
    } finally {
      freeSpaceScanBusyRef.current = false;
      setQuickCleanupBusy(false);
      setQuickCleanupProgress(null);
    }
  }

  async function startFreeSpacePlanScan(
    options: { announce?: boolean; requestNotificationPermission?: boolean } = {},
  ) {
    if (freeSpaceScanBusyRef.current || stats.freeSpacePlan.status === "scanning") return;
    const { announce = true, requestNotificationPermission = true } = options;
    const startedAt = new Date().toISOString();
    await clearQuickCleanupReviewCache();
    setQuickCleanupLibrary(null);
    setQuickCleanupError(null);
    commitStats((current) => ({
      ...current,
      freeSpacePlan: {
        ...DEFAULT_FREE_SPACE_PLAN,
        status: "scanning",
        startedAt,
      },
    }));
    if (announce) {
      showToast(t("ui.trimswipe-scan-started"), t("ui.you-can-keep-using-trimswipe-while-the-batch-run"), "info");
    }
    // Resolve notification access and scan concurrently. Even a tiny library
    // cannot race past the permission result and silently lose its ready alert.
    const notificationPermission = ensureCleanupNotifications(requestNotificationPermission);
    void runFreeSpacePlanScan(startedAt, notificationPermission);
  }

  function toggleQuickProtection(photo: NativePhoto, protectedState: boolean) {
    setPhotoProtection((current) => {
      if (!current) return current;
      const next = updatePhotoProtection(current, photo.id, protectedState);
      void savePhotoProtectionStore(next);
      return next;
    });
    setQuickCleanupLibrary((current) => {
      if (!current) return current;
      const protectedIds = new Set(current.plan.protectedIds);
      if (protectedState) protectedIds.add(photo.id);
      else protectedIds.delete(photo.id);
      const items = current.plan.items.map((candidate) => candidate.photo.id === photo.id
        ? { ...candidate, selected: false }
        : candidate);
      const next = {
        ...current,
        plan: { ...current.plan, items, selectedItems: items.filter((candidate) => candidate.selected), protectedIds: [...protectedIds] },
      };
      void saveQuickCleanupReviewCache(next);
      return next;
    });
  }

  function decideQuickLater(photo: NativePhoto) {
    commitReviewLedger((current) => recordNativePhotoReview(current, photo.id, "skipped"));
    setQuickCleanupLibrary((current) => {
      if (!current) return current;
      const next = { ...current, plan: { ...current.plan, items: current.plan.items.filter((candidate) => candidate.photo.id !== photo.id), selectedItems: current.plan.selectedItems.filter((candidate) => candidate.photo.id !== photo.id) } };
      void saveQuickCleanupReviewCache(next);
      return next;
    });
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
      console.log(t("ui.nativetrimswipe-share-failed"), { error });
      await Share.share({ message: progressShareText(stats) }).catch(() => undefined);
    }
  }

  function queueTrimPreparation(photo: NativePhoto): Promise<PreparedTrim> {
    const existing = preparedTrimPromisesRef.current.get(photo.id);
    if (existing) return existing;

    const prepared = trimPreparationChainRef.current
      .catch(() => undefined)
      .then(() =>
        prepareTrimPhoto(photo, settings.trimQuality, settings.trimKinds, {
          allowSecondPass: settings.trimReviewMode === "trimmed-only",
        }),
      );
    trimPreparationChainRef.current = prepared.then(
      () => undefined,
      () => undefined,
    );
    preparedTrimPromisesRef.current.set(photo.id, prepared);
    return prepared;
  }

  async function discardPreparedTrimIds(ids: string[]): Promise<void> {
    const pending = ids
      .map((id) => {
        const prepared = preparedTrimPromisesRef.current.get(id);
        preparedTrimPromisesRef.current.delete(id);
        return prepared;
      })
      .filter((item): item is Promise<PreparedTrim> => Boolean(item));
    if (pending.length > 0) await cleanupPreparedTrims(await Promise.all(pending));
  }

  function discardAllPreparedTrims(): void {
    void discardPreparedTrimIds([...preparedTrimPromisesRef.current.keys()]);
  }

  useEffect(
    () => () => {
      const pending = [...preparedTrimPromisesRef.current.values()];
      preparedTrimPromisesRef.current.clear();
      if (pending.length > 0) {
        void Promise.all(pending).then(cleanupPreparedTrims);
      }
    },
    [],
  );

  function commitReviewLedger(updater: (current: NativePhotoReviewLedger) => NativePhotoReviewLedger) {
    setReviewLedger((current) => {
      if (!current) return current;
      const nextLedger = updater(current);
      void saveNativePhotoReviewLedger(nextLedger);
      return nextLedger;
    });
  }

  function currentAvoidIds(): string[] {
    return recentSelectionIds(stats, reviewLedger, settings.includePreviouslyReviewed);
  }

  function recordAppliedTrimResults(
    sourcePhotos: NativePhoto[],
    results: { trimmed: boolean; newAssetId?: string }[],
  ) {
    commitReviewLedger((current) =>
      sourcePhotos.reduce(
        (nextLedger, photo, index) =>
          results[index]?.trimmed
            ? recordNativePhotoTrim(nextLedger, photo.id, results[index]?.newAssetId)
            : nextLedger,
        current,
      ),
    );
  }

  useEffect(() => {
    if (!reviewLedger || stats.actionLog.length === 0) return;
    commitReviewLedger((current) =>
      stats.actionLog.reduce(
        (nextLedger, entry) =>
          recordNativePhotoReview(
            nextLedger,
            entry.photoId,
            entry.action === "trim" ? "trimmed" : entry.action === "delete" ? "deleted" : "kept",
            entry.createdAt,
          ),
        current,
      ),
    );
    // The latest action-log entry is sufficient to trigger synchronization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.actionLog[0]?.id]);

  function openCleanupReport(period: ReportPeriod) {
    if (!isPro) return;
    setReportPeriod(period);
  }

  async function shareExportedFile(uri: string, mimeType: string, fallbackMessage: string) {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType });
      return;
    }
    await Share.share({ url: uri, message: fallbackMessage });
  }

  async function exportReportImage(period: ReportPeriod) {
    if (!reportCardRef.current || reportExportBusy) return;
    setReportExportBusy("image");
    try {
      const uri = await captureRef(reportCardRef.current, {
        format: "png",
        quality: 0.96,
        result: "tmpfile",
      });
      await shareExportedFile(uri, "image/png", cleanupReportText(stats, period));
      commitStats((current) => ({ ...current, shareCount: current.shareCount + 1 }));
    } catch (error) {
      console.log(t("ui.nativetrimswipe-report-image-export-failed"), { error });
      showToast(t("ui.export-failed"), t("ui.could-not-export-the-report-image"), "error");
    } finally {
      setReportExportBusy(null);
    }
  }

  async function exportReportPdf(period: ReportPeriod) {
    if (reportExportBusy) return;
    setReportExportBusy("pdf");
    try {
      const result = await Print.printToFileAsync({
        html: cleanupReportHtml(stats, period),
        base64: false,
      });
      await shareExportedFile(result.uri, "application/pdf", cleanupReportText(stats, period));
      commitStats((current) => ({ ...current, shareCount: current.shareCount + 1 }));
    } catch (error) {
      console.log(t("ui.nativetrimswipe-report-pdf-export-failed"), { error });
      showToast(t("ui.export-failed"), t("ui.could-not-export-the-report-pdf"), "error");
    } finally {
      setReportExportBusy(null);
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
        setScanError(t("ui.photo-access-is-needed-to-scan-your-library"));
        return;
      }
      setPermissionDenied(false);
      setPermissionLimited(permission.limited);
      await notifyCleanupProgress(t("ui.trimswipe-scan-started"), t("ui.looking-for-easy-storage-wins"));
      const result = await scanPhotoLibrary(setScanProgress);
      setLibraryScan(result);
      commitStats((current) => ({
        ...current,
        engagementSnapshot: {
          capturedAt: new Date().toISOString(),
          photoCount: result.assetCount,
          totalSizeMB: result.totalSizeMB,
          freeSpaceMB: result.freeSpaceMB,
          deviceCapacityMB: result.deviceCapacityMB,
          screenshotsCount: result.screenshotCount,
          screenshotsMB: result.storageByType.screenshotsMB,
          similarCount: result.duplicateRemovalCount,
          similarMB: result.storageByType.similarPhotosMB,
          trimSavingsMB: result.trimSavingsMB,
          deleteSavingsMB: result.deleteSavingsMB,
        },
      }));
      setScanProgress(null);
      setScanComplete(true);
      await notifyCleanupProgress(
        t("ui.trimswipe-scan-ready"),
        t("ui.scan-found-to-review", { value: formatMB(result.trimSavingsMB + result.deleteSavingsMB) }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t("ui.could-not-scan-the-photo-library");
      setScanError(message);
      setScanComplete(false);
    } finally {
      setScanBusy(false);
    }
  }

  async function loadRound(
    settingsOverride = settings,
    options: { showFallbackToast?: boolean } = {},
  ) {
    const activeSettings = roundSettings(settingsOverride);
    discardAllPreparedTrims();
    // FIX 1: Guard against NaN cardsPerRound before calling MediaLibrary
    const safeCount = Math.max(1, Math.round(activeSettings.cardsPerRound) || 10);
    setLoading(true);
    setSwipeRoundId((current) => current + 1);
    setSwipeRoundInitialCount(0);
    setMidsetAdDismissed(false);
    setMidsetAdVisible(false);
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
      let fallbackNotice = "";
      let photos = await loadPhotoRound(safeCount, activeSettings, {
        avoidIds: currentAvoidIds(),
        onFallback: (detail) => {
          fallbackNotice = detail;
        },
      });
      if (photos.length === 0 && activeSettings.targetMode !== "balanced") {
        const fallbackTargetMode = nextFallbackTargetMode(activeSettings.targetMode);
        const fallbackSettings = roundSettings({
          ...activeSettings,
          targetMode: fallbackTargetMode,
        });
        fallbackNotice = t("ui.filter-fallback-switched", {
          from: targetLabel(activeSettings),
          to: targetLabel(fallbackSettings),
        });
        photos = await loadPhotoRound(safeCount, fallbackSettings, {
          avoidIds: currentAvoidIds(),
        });
      }
      if (photos.length === 0 && activeSettings.targetMode !== "balanced") {
        const broadSettings = roundSettings({ ...activeSettings, targetMode: "balanced" });
        fallbackNotice = t("ui.filter-fallback-balanced", { from: targetLabel(activeSettings) });
        photos = await loadPhotoRound(safeCount, broadSettings, {
          avoidIds: currentAvoidIds(),
        });
      }
      setQueue(photos);
      setSwipeRoundInitialCount(photos.length);
      if (fallbackNotice && options.showFallbackToast) {
        showToast(t("ui.filter-widened"), fallbackNotice, "info");
      }
      if (photos.length === 0) {
        setError(t("ui.no-local-photos-were-available-in-the-current-li"));
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : t("ui.could-not-load-photos");
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!statsLoaded || onboardingDue) return;
    void loadRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsLoaded, onboardingDue, stats.startedAt]);

  useEffect(() => {
    if (
      settings.sessionMode !== "time-attack" ||
      loading ||
      recap ||
      pendingDeletes.length > 0 ||
      midsetAdVisible
    ) return undefined;
    if (timeLeft <= 0) return undefined;
    const timer = setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, midsetAdVisible, pendingDeletes.length, recap, settings.sessionMode, timeLeft]);

  useEffect(() => {
    if (settings.sessionMode !== "time-attack" || timeLeft !== 0 || loading || recap || midsetAdVisible) return;
    if (queue.length === 0) return;
    setQueue([]);
    finishSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, midsetAdVisible, queue.length, recap, settings.sessionMode, timeLeft]);

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
    if (!hasUnlimitedTrims && tokenBalance - pendingTrimsRef.current.length <= 0) {
      showToast(t("ui.not-enough-tokens"), t("ui.claim-daily-tokens-watch-an-ad-or-visit-the-shop"), "warning");
      return;
    }
    if (!canAttemptTrim(photo, settings)) {
      showToast(
        t("ui.cannot-trim-this-photo"),
        t("ui.trim-disabled-keep-delete", { reason: trimDisabledReason(photo, settings, "detail") }),
        "warning",
      );
      return;
    }
    const estimated = estimateTrimSavingsForSettings(photo, settings);
    session.trimmed += 1;
    session.freed += estimated;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Defer the actual trim to the end-of-set confirmation step so users
    // aren't interrupted with iOS delete dialogs after every swipe.
    pendingTrimsRef.current = [...pendingTrimsRef.current, photo];
    setPendingTrims(pendingTrimsRef.current);
    void queueTrimPreparation(photo);
    advance();
  }

  async function confirmActions(deletes: NativePhoto[], trims: NativePhoto[]) {
    if (applyingActionsRef.current) {
      showToast(t("ui.already-applying"), t("ui.please-wait-for-the-photos-confirmation"), "info");
      return;
    }
    applyingActionsRef.current = true;
    try {
    const requestedTrimIds = new Set(trims.map((p) => p.id));
    const requestedDeleteIds = new Set(deletes.map((p) => p.id));
    const chargeableTrims = hasUnlimitedTrims ? trims : trims.slice(0, tokenBalance);
    if (chargeableTrims.length < trims.length) {
      showToast(t("ui.not-enough-tokens"), t("ui.selected-trims-limit", { selected: chargeableTrims.length, total: trims.length }), "warning");
    }

    if (chargeableTrims.length > 0) {
      setBackgroundTrimResult(null);
      setTrimmingCount((count) => count + chargeableTrims.length);
    }
    const totalActions = deletes.length + chargeableTrims.length;
    const firstSuccessfulCleanup = stats.reviewed === 0 && totalActions > 0;
    if (totalActions >= 5) {
      await notifyCleanupProgress(t("ui.cleanup-started"), t("ui.applying"));
    }
    const preparedTrims = await Promise.all(
      chargeableTrims.map((photo) => queueTrimPreparation(photo)),
    );
    const batch = await commitTrimsAndDeletes(
      deletes,
      chargeableTrims,
      settings.trimQuality,
      settings.trimOutputMode === "replace",
      settings.trimKinds,
      {
        allowSecondPass: settings.trimReviewMode === "trimmed-only",
        prepared: preparedTrims,
      },
    );
    chargeableTrims.forEach((photo) => preparedTrimPromisesRef.current.delete(photo.id));
    const chargeableTrimIds = new Set(chargeableTrims.map((photo) => photo.id));
    void discardPreparedTrimIds(
      trims.filter((photo) => !chargeableTrimIds.has(photo.id)).map((photo) => photo.id),
    );
    if (chargeableTrims.length > 0) {
      setTrimmingCount((count) => Math.max(0, count - chargeableTrims.length));
    }
    const trimmedResults = batch.trimResults;
    recordAppliedTrimResults(chargeableTrims, trimmedResults);
    const trimmedOkIds = new Set(trimmedResults.filter((r) => r.trimmed).map((r) => r.id));
    const deletedCount = batch.deletedCount;
    const deletedPhotos = batch.deletedPhotos;

    if (!hasUnlimitedTrims && trimmedOkIds.size > 0) {
      await spendTokens(trimmedOkIds.size);
    }
    const actualTrimSaved = trimmedResults.reduce(
      (sum, r, i) => (r.trimmed ? sum + (r.savedMB ?? estimateTrimSavingsForSettings(chargeableTrims[i], settings)) : sum),
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
        next = appendActionLog(next, createActionLogEntry(p, "trim", estimateTrimSavingsForSettings(p, settings)));
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

    if (deletedCount !== deletes.length || trimmedOkIds.size !== chargeableTrims.length) {
      showToast(
        t("ui.some-actions-skipped"),
        t("ui.actions-result-summary", { deleted: deletedCount, deleteTotal: deletes.length, trimmed: trimmedOkIds.size, trimTotal: chargeableTrims.length, details: trimFailureSummary(trimmedResults) }).trim(),
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
      await notifyCleanupProgress(t("ui.cleanup-complete"), t("ui.saved-about", { value: formatMB(sessionRef.current.freed) }));
    }
    if (firstSuccessfulCleanup && !settings.smartReminders.enabled) {
      Alert.alert(
        t("ui.keep-your-cleanup-momentum"),
        t("ui.trimswipe-can-send-occasional-reminders-when-you"),
        [
          { text: t("ui.not-now"), style: "cancel" },
          { text: t("ui.enable-reminders"), onPress: () => updateSettings({ smartReminders: { ...settings.smartReminders, enabled: true } }) },
        ],
      );
    }
    maybeShowInterstitialAfterCleanup(
      sessionRef.current.kept + sessionRef.current.deleted + sessionRef.current.trimmed,
    );
    if (chargeableTrims.length > 0) {
      const beforeMB = chargeableTrims.reduce((sum, photo) => sum + photo.sizeMB, 0);
      setBackgroundTrimResult({
        requested: chargeableTrims.length,
        trimmed: trimmedOkIds.size,
        failed: chargeableTrims.length - trimmedOkIds.size,
        beforeMB: +beforeMB.toFixed(2),
        afterMB: +Math.max(0, beforeMB - actualTrimSaved).toFixed(2),
        savedMB: +actualTrimSaved.toFixed(2),
      });
    }
    } finally {
      applyingActionsRef.current = false;
    }
  }

  function openRecentlyDeleted() {
    showToast(
      t("ui.restore-deleted-photos"),
      t("ui.restore-deleted-instructions"),
      "info",
    );
    void Linking.openURL("photos-redirect://").catch(() => Linking.openSettings());
  }

  function cancelPendingActions() {
    discardAllPreparedTrims();
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
    const nextSettings = roundSettings({ ...(pendingSettingsRef.current ?? settings), ...patch });
    pendingSettingsRef.current = nextSettings;
    settingsDirtyRef.current = true;
    commitStats((current) => ({
      ...current,
      settings: roundSettings({ ...current.settings, ...patch }),
    }));
    if (patch.smartReminders?.enabled === true) {
      void syncRemoteCleanupReminders(settings.backgroundScanSchedules, { requestPermission: true }, {
        ...engagementPayload,
        preferences: { ...settings.smartReminders, ...patch.smartReminders },
      });
    }
  }

  function changeScreen(nextScreen: Screen) {
    if (nextScreen === "automation" && !isPro) return;
    const leavingSettings = screen === "settings" && nextScreen !== "settings";
    setScreen(nextScreen);
    if (leavingSettings && settingsDirtyRef.current) {
      const reloadSettings = pendingSettingsRef.current ?? settings;
      settingsDirtyRef.current = false;
      pendingSettingsRef.current = null;
      void loadRound(reloadSettings);
    }
  }

  function setBackgroundSchedules(nextSchedules: NativeBackgroundScanSchedule[]) {
    updateSettings({ backgroundScanSchedules: nextSchedules });
  }

  function updateBackgroundSchedule(
    scheduleId: string,
    updater: (schedule: NativeBackgroundScanSchedule) => NativeBackgroundScanSchedule,
  ) {
    const currentSchedules = (pendingSettingsRef.current ?? settings).backgroundScanSchedules;
    const hadActiveSchedule = currentSchedules.some((schedule) => schedule.active);
    const nextSchedules = currentSchedules.map((schedule) =>
      schedule.id === scheduleId ? updater(schedule) : schedule,
    );
    const hasActiveSchedule = nextSchedules.some((schedule) => schedule.active);
    setBackgroundSchedules(nextSchedules);

    if (hadActiveSchedule === hasActiveSchedule) return;
    void syncRemoteCleanupReminders(nextSchedules, {
      requestPermission: hasActiveSchedule,
    }, engagementPayload).then((result) => {
      if (!result.configured) {
        showToast(t("ui.cloud-reminders-not-configured"), t("ui.add-the-firebase-environment-values-before-enabl"), "warning");
      } else if (hasActiveSchedule && !result.permissionGranted) {
        showToast(t("ui.notifications-are-off"), t("ui.allow-notifications-in-ios-settings-to-receive-c"), "warning");
      } else if (result.error) {
        showToast(t("ui.reminder-sync-failed"), t("ui.your-schedule-is-saved-locally-cloud-reminders-w"), "warning");
      }
    });
  }

  function addBackgroundSchedule() {
    const nextIndex = settings.backgroundScanSchedules.length + 1;
    setBackgroundSchedules([
      ...settings.backgroundScanSchedules,
      {
        id: `cleanup-check-${Date.now()}`,
        label: t("ui.automation-check-number", { count: nextIndex }),
        active: false,
        days: [1, 2, 3, 4, 5],
        times: ["09:00"],
        targetMB: 50,
        lastRunAt: null,
        lastSuggestionAt: null,
      },
    ]);
  }

  async function reloadSettingsRound() {
    const reloadSettings = pendingSettingsRef.current ?? settings;
    settingsDirtyRef.current = false;
    pendingSettingsRef.current = null;
    await loadRound(reloadSettings);
  }

  function startGame(patch: Partial<NativeSettings>) {
    const nextSettings = roundSettings({ ...settings, ...patch });
    commitStats((current) => ({ ...current, settings: nextSettings }));
    setScreen("swipe");
    void loadRound(nextSettings, { showFallbackToast: true });
  }

  function cleanupActionCount(plan: NativeCleanupPlan): number {
    return plan.deleteCandidates.length + plan.trimCandidates.length;
  }

  function planTitleForCategory(category: NativeCleanupCategory, planSettings: NativeSettings): string {
    if (category === "large") return t("ui.photos-over-size", { value: formatSizeThreshold(planSettings.minSizeMB) });
    if (category === "old") return t("ui.photos-over-age", { value: formatAgeThreshold(planSettings.minAgeYears) });
    if (category === "screenshots") return t("ui.screenshots");
    if (category === "live") return t("ui.live-photos");
    if (category === "duplicates") return t("ui.similar-photos");
    if (category === "bursts") return t("ui.home-bursts");
    return t("ui.likely-mistakes");
  }

  async function buildExactCleanupPlan(
    category: NativeCleanupCategory,
    count: number,
    planSettings: NativeSettings,
    avoidIds: string[],
  ): Promise<NativeCleanupPlan> {
    if (category === "screenshots") {
      const screens = await loadCleanupPlan("screenshots", 18, planSettings, { avoidIds });
      const deleteCandidates = screens.deleteCandidates;
      return {
        category: "screenshots",
        title: t("ui.screenshots"),
        candidates: deleteCandidates,
        deleteCandidates,
        trimCandidates: [],
        estimatedDeleteSavingsMB: +deleteCandidates.reduce((sum, photo) => sum + photo.sizeMB, 0).toFixed(2),
        estimatedTrimSavingsMB: 0,
      };
    }

    const plan = await loadCleanupPlan(category, count, planSettings, { avoidIds });
    if (category === "bursts") {
      const deleteCandidates = plan.deleteCandidates.slice(1);
      return {
        ...plan,
        title: planTitleForCategory(category, planSettings),
        deleteCandidates,
        estimatedDeleteSavingsMB: +deleteCandidates.reduce((sum, photo) => sum + photo.sizeMB, 0).toFixed(2),
      };
    }
    return { ...plan, title: planTitleForCategory(category, planSettings) };
  }

  async function buildTrimmableFallbackPlan(
    count: number,
    baseSettings: NativeSettings,
    avoidIds: string[],
  ): Promise<NativeCleanupPlan> {
    const modes: NativeTargetMode[] = ["big-only", "old-only", "balanced"];
    const byId = new Map<string, NativePhoto>();
    for (const mode of modes) {
      for (const ids of [avoidIds, []]) {
        const photos = await loadPhotoRound(
          Math.max(count, 24),
          roundSettings({ ...baseSettings, targetMode: mode, cardsPerRound: Math.max(count, 24) }),
          { avoidIds: ids },
        );
        photos
          .filter((photo) => canAttemptTrim(photo, baseSettings))
          .forEach((photo) => {
            if (byId.size < count) byId.set(photo.id, photo);
          });
        if (byId.size >= count) break;
      }
      if (byId.size >= count) break;
    }
    const trimCandidates = [...byId.values()].slice(0, count);
    return {
      category: "large",
      title: t("ui.trimmable-photos"),
      candidates: trimCandidates,
      deleteCandidates: [],
      trimCandidates,
      estimatedDeleteSavingsMB: 0,
      estimatedTrimSavingsMB: +trimCandidates.reduce((sum, photo) => sum + estimateTrimSavingsForSettings(photo, baseSettings), 0).toFixed(2),
    };
  }

  async function loadCleanupPlanWithFallback(
    category: NativeCleanupCategory,
    count: number,
    baseSettings: NativeSettings,
    avoidIds: string[],
  ): Promise<{ plan: NativeCleanupPlan; fallbackNotice?: string }> {
    const exact = await buildExactCleanupPlan(category, count, baseSettings, avoidIds);
    if (cleanupActionCount(exact) > 0) return { plan: exact };

    if (baseSettings.includePreviouslyReviewed) {
      const withRecent = await buildExactCleanupPlan(category, count, baseSettings, []);
      if (cleanupActionCount(withRecent) > 0) {
        return {
          plan: withRecent,
          fallbackNotice: t("ui.included-previously-reviewed-photos-because-that"),
        };
      }
    }

    const relaxedSettings: NativeSettings[] = [];
    if (category === "large") {
      [0.75, 0.5, 0.25].forEach((factor) => {
        relaxedSettings.push(roundSettings({ ...baseSettings, minSizeMB: Math.max(0.5, baseSettings.minSizeMB * factor) }));
      });
    }
    if (category === "old") {
      [0.75, 0.5, 0.25].forEach((factor) => {
        relaxedSettings.push(roundSettings({ ...baseSettings, minAgeYears: Math.max(0, baseSettings.minAgeYears * factor) }));
      });
    }

    for (const relaxed of relaxedSettings) {
      const plan = await buildExactCleanupPlan(category, count, relaxed, avoidIds);
      if (cleanupActionCount(plan) > 0) {
        return {
          plan,
          fallbackNotice: t("ui.no-exact-matches-were-found-so-the-filter-was-wi"),
        };
      }
    }

    const fallbackPlan = await buildTrimmableFallbackPlan(count, baseSettings, avoidIds);
    return {
      plan: fallbackPlan,
      fallbackNotice:
        cleanupActionCount(fallbackPlan) > 0
          ? t("ui.no-exact-matches-were-found-so-a-nearby-trimmabl")
          : undefined,
    };
  }

  async function openCleanupCategory(category: NativeCleanupCategory) {
    if (category === "duplicates") {
      setScreen("this-or-that");
      return;
    }
    setCleanupPlanBusy(true);
    setCleanupPlan(null);
    setScreen("cleanup-plan");
    try {
      const permission = await requestPhotoPermission();
      if (!permission.granted) {
        setPermissionDenied(true);
        showToast(t("ui.photo-access-needed"), t("ui.open-ios-settings-to-preview-cleanup-folders"), "warning");
        return;
      }
      setPermissionDenied(false);
      const avoidIds = currentAvoidIds();
      const { plan, fallbackNotice } = await loadCleanupPlanWithFallback(category, 24, settings, avoidIds);
      setCleanupPlan(plan);
      if (fallbackNotice) {
        showToast(t("ui.filter-widened"), fallbackNotice, "info");
      }
    } catch (error) {
      showToast(t("ui.preview-failed"), error instanceof Error ? error.message : t("ui.could-not-build-this-cleanup-folder"), "error");
    } finally {
      setCleanupPlanBusy(false);
    }
  }

  async function openDeepClean() {
    if (!isPro) {
      showToast(t("ui.deep-clean-is-pro"), t("ui.lifetime-pro-unlocks-the-guided-full-library-sca"), "info");
      setScreen("shop");
      return;
    }
    setCleanupPlanBusy(true);
    setCleanupPlan(null);
    setScreen("cleanup-plan");
    try {
      await runLibraryScan();
      const avoidIds = currentAvoidIds();
      const [largeResult, oldResult, screenshots] = await Promise.all([
        loadCleanupPlanWithFallback("large", 18, settings, avoidIds),
        loadCleanupPlanWithFallback("old", 18, settings, avoidIds),
        loadCleanupPlan("screenshots", 18, settings, { avoidIds }),
      ]);
      const large = largeResult.plan;
      const old = oldResult.plan;
      const trimById = new Map<string, NativePhoto>();
      [...large.trimCandidates, ...old.trimCandidates].forEach((photo) => trimById.set(photo.id, photo));
      const deleteById = new Map<string, NativePhoto>();
      screenshots.deleteCandidates
        .forEach((photo) => {
          if (!trimById.has(photo.id)) deleteById.set(photo.id, photo);
        });
      const trimCandidates = [...trimById.values()];
      const deleteCandidates = [...deleteById.values()];
      setCleanupPlan({
        category: "mistakes",
        title: t("ui.deep-clean"),
        candidates: [...deleteCandidates, ...trimCandidates],
        deleteCandidates,
        trimCandidates,
        estimatedDeleteSavingsMB: +deleteCandidates.reduce((sum, photo) => sum + photo.sizeMB, 0).toFixed(2),
        estimatedTrimSavingsMB: +trimCandidates.reduce((sum, photo) => sum + estimateTrimSavingsForSettings(photo, settings), 0).toFixed(2),
      });
    } catch (error) {
      showToast(t("ui.deep-clean-failed"), error instanceof Error ? error.message : t("ui.could-not-build-a-deep-clean-preview"), "error");
    } finally {
      setCleanupPlanBusy(false);
    }
  }

  async function loadTrimmablePhotos(count: number): Promise<NativePhoto[]> {
    const permission = await requestPhotoPermission();
    if (!permission.granted) {
      setPermissionDenied(true);
      showToast(t("ui.photo-access-needed"), t("ui.open-ios-settings-to-review-trimmable-photos"), "warning");
      return [];
    }
    setPermissionDenied(false);
    const plan = await buildTrimmableFallbackPlan(count, settings, currentAvoidIds());
    if (plan.trimCandidates.length === 0) {
      showToast(t("ui.no-trimmable-photos"), t("ui.no-local-photos-currently-have-useful-trim-savin"), "info");
    }
    return plan.trimCandidates;
  }

  async function startTrimmableSwipeSet(count: number) {
    setTrimActionLoading(true);
    try {
      const photos = await loadTrimmablePhotos(count);
      if (photos.length === 0) return;
      setTrimActionPickerVisible(false);
      setQueue(photos);
      setSwipeRoundInitialCount(photos.length);
      setSwipeRoundId((current) => current + 1);
      setMidsetAdDismissed(false);
      setMidsetAdVisible(false);
      setPendingDeletes([]);
      setPendingTrims([]);
      pendingDeletesRef.current = [];
      pendingTrimsRef.current = [];
      sessionRef.current = { kept: 0, trimmed: 0, deleted: 0, freed: 0 };
      setRecap(null);
      setError(null);
      setLoading(false);
      setScreen("swipe");
    } finally {
      setTrimActionLoading(false);
    }
  }

  async function prepareTrimAll() {
    // Candidate discovery can take a while on large libraries. Dismiss the
    // picker immediately and return with a confirmation only when the set is ready.
    setTrimActionPickerVisible(false);
    setTrimActionLoading(true);
    showToast(t("ui.finding-photos"), t("ui.preparing-trimmable-photos", { count: BULK_TRIM_LIMIT }), "info");
    try {
      const availableTrimSlots = hasUnlimitedTrims ? BULK_TRIM_LIMIT : Math.min(BULK_TRIM_LIMIT, tokenBalance);
      if (availableTrimSlots === 0) {
        showToast(t("ui.no-trim-tokens"), t("ui.claim-tokens-watch-an-ad-or-upgrade-before-bulk-"), "warning");
        return;
      }
      const photos = await loadTrimmablePhotos(availableTrimSlots);
      if (photos.length === 0) return;
      const candidates = photos.slice(0, availableTrimSlots);
      const estimated = candidates.reduce((sum, photo) => sum + estimateTrimSavingsForSettings(photo, settings), 0);
      await requestConfirmation({
        title: t("ui.trim-photos-question", { count: candidates.length }),
        detail: t("ui.trim-background-confirm-detail", { value: formatMB(estimated) }),
        confirmLabel: t("ui.trim-count", { count: candidates.length }),
        runInBackground: true,
        onConfirm: async () => {
          await confirmActions([], candidates);
          return candidates.length;
        },
      });
    } finally {
      setTrimActionLoading(false);
    }
  }

  function markBackgroundScheduleRun(scheduleId: string, hadSuggestion: boolean) {
    const now = new Date().toISOString();
    commitStats((current) => ({
      ...current,
      settings: {
        ...current.settings,
        backgroundScanSchedules: current.settings.backgroundScanSchedules.map((schedule) =>
          schedule.id === scheduleId
            ? {
                ...schedule,
                lastRunAt: now,
                lastSuggestionAt: hadSuggestion ? now : schedule.lastSuggestionAt,
              }
            : schedule,
        ),
      },
    }));
  }

  async function buildBackgroundCleanupPlan(schedule: NativeBackgroundScanSchedule): Promise<NativeCleanupPlan> {
    const avoidIds = currentAvoidIds();
    const [largeResult, oldResult, screenshots] = await Promise.all([
      loadCleanupPlanWithFallback("large", 24, settings, avoidIds),
      loadCleanupPlanWithFallback("old", 24, settings, avoidIds),
      loadCleanupPlan("screenshots", 24, settings, { avoidIds }),
    ]);
    const trimById = new Map<string, NativePhoto>();
    [...largeResult.plan.trimCandidates, ...oldResult.plan.trimCandidates].forEach((photo) => {
      trimById.set(photo.id, photo);
    });
    const deleteById = new Map<string, NativePhoto>();
    screenshots.deleteCandidates.forEach((photo) => {
      if (!trimById.has(photo.id)) deleteById.set(photo.id, photo);
    });

    const selectedDeletes: NativePhoto[] = [];
    const selectedTrims: NativePhoto[] = [];
    let estimatedDeleteSavingsMB = 0;
    let estimatedTrimSavingsMB = 0;
    const targetMB = Math.max(10, schedule.targetMB);

    [...deleteById.values()].sort((a, b) => b.sizeMB - a.sizeMB).forEach((photo) => {
      if (estimatedDeleteSavingsMB + estimatedTrimSavingsMB >= targetMB && selectedDeletes.length + selectedTrims.length >= 3) return;
      selectedDeletes.push(photo);
      estimatedDeleteSavingsMB += photo.sizeMB;
    });

    [...trimById.values()]
      .sort((a, b) => estimateTrimSavingsForSettings(b, settings) - estimateTrimSavingsForSettings(a, settings))
      .forEach((photo) => {
        if (estimatedDeleteSavingsMB + estimatedTrimSavingsMB >= targetMB && selectedDeletes.length + selectedTrims.length >= 3) return;
        if (selectedDeletes.some((candidate) => candidate.id === photo.id)) return;
        selectedTrims.push(photo);
        estimatedTrimSavingsMB += estimateTrimSavingsForSettings(photo, settings);
      });

    return {
      category: "mistakes",
      title: t("ui.cleanup-suggestions-ready"),
      candidates: [...selectedDeletes, ...selectedTrims],
      deleteCandidates: selectedDeletes,
      trimCandidates: selectedTrims,
      estimatedDeleteSavingsMB: +estimatedDeleteSavingsMB.toFixed(2),
      estimatedTrimSavingsMB: +estimatedTrimSavingsMB.toFixed(2),
    };
  }

  async function runBackgroundCleanupScan(schedule: NativeBackgroundScanSchedule, source: "manual" | "scheduled") {
    if (!isPro || scheduledScanBusyRef.current) return;
    scheduledScanBusyRef.current = true;
    setCleanupPlanBusy(true);
    setCleanupPlan(null);
    if (source === "manual") setScreen("cleanup-plan");
    try {
      const permission = await requestPhotoPermission();
      if (!permission.granted) {
        setPermissionDenied(true);
        showToast(t("ui.photo-access-needed"), t("ui.allow-photo-access-to-run-scheduled-cleanup-chec"), "warning");
        markBackgroundScheduleRun(schedule.id, false);
        return;
      }
      setPermissionDenied(false);
      await notifyCleanupProgress(t("ui.trimswipe-check-started"), t("ui.looking-for-easy-storage-wins"));
      const plan = await buildBackgroundCleanupPlan(schedule);
      const hasSuggestion = cleanupPlanActionCount(plan) > 0;
      markBackgroundScheduleRun(schedule.id, hasSuggestion);

      if (!hasSuggestion) {
        if (source === "manual") setScreen("automation");
        showToast(t("ui.no-cleanup-suggestion"), t("ui.this-check-did-not-find-enough-local-photos-to-r"), "info");
        return;
      }

      setCleanupPlan(plan);
      setScreen("cleanup-plan");
      await notifyCleanupProgress(
        t("ui.cleanup-suggestions-ready"),
        t("ui.saved-about", { value: formatMB(cleanupPlanSavings(plan)) }),
      );
      showToast(
        source === "scheduled" ? t("ui.scheduled-scan-complete") : t("ui.scan-complete"),
        t("ui.review-photos"),
        "success",
      );
    } catch (error) {
      markBackgroundScheduleRun(schedule.id, false);
      showToast(t("ui.scheduled-scan-failed"), error instanceof Error ? error.message : t("ui.could-not-build-cleanup-suggestions"), "error");
    } finally {
      scheduledScanBusyRef.current = false;
      setCleanupPlanBusy(false);
    }
  }

  async function runDueBackgroundScans() {
    if (!statsLoaded || !isPro || scheduledScanBusyRef.current) return;
    const dueSchedule = settings.backgroundScanSchedules.find((schedule) => dueScheduleTime(schedule) !== null);
    if (!dueSchedule) return;
    await runBackgroundCleanupScan(dueSchedule, "scheduled");
  }

  useEffect(() => {
    if (!statsLoaded || !isPro) return undefined;
    void runDueBackgroundScans();
    const timer = setInterval(() => {
      void runDueBackgroundScans();
    }, 60 * 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsLoaded, isPro, backgroundScheduleSignature]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if ((previousState === "background" || previousState === "inactive") && nextState === "active") {
        commitStats((current) => ({ ...current, lastActiveAt: new Date().toISOString() }));
        if (isPro) void runDueBackgroundScans();
        if (statsLoaded) {
          void reconcileDailyTrimReminder({
            enabled: settings.dailyTrimReminder.enabled,
            promptAcknowledged: stats.dailyTrimReminderPromptVersion >= DAILY_TRIM_REMINDER_PROMPT_VERSION,
            time: settings.dailyTrimReminder.time,
          }).then((permission) => setDailyReminderPermission({ granted: permission.granted, blocked: permission.blocked }));
        }
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundScheduleSignature, isPro, settings.appLanguage, settings.dailyTrimReminder.enabled, settings.dailyTrimReminder.time, stats.dailyTrimReminderPromptVersion, statsLoaded]);

  useEffect(() => {
    if (!isPro && screen === "automation") setScreen("home");
  }, [isPro, screen]);

  async function bulkTrimPhotos(photos: NativePhoto[]) {
    const available = hasUnlimitedTrims ? photos.length : tokenBalance;
    const candidates = photos.filter((photo) => canAttemptTrim(photo, settings)).slice(0, available);
    if (available <= 0) {
      showToast(t("ui.not-enough-tokens"), t("ui.claim-daily-tokens-watch-an-ad-or-visit-the-shop"), "warning");
      return;
    }
    if (candidates.length === 0) {
      showToast(t("ui.nothing-local-to-trim"), t("ui.this-deck-only-has-icloud-only-or-unavailable-ph"), "warning");
      return;
    }
    setBulkBusy(true);
    setTrimmingCount((count) => count + candidates.length);
    if (candidates.length >= 5) {
      await notifyCleanupProgress(t("ui.trim-batch-started"), t("ui.applying"));
    }
    const results = await commitTrims(
      candidates,
      settings.trimQuality,
      settings.trimOutputMode === "replace",
      settings.trimKinds,
      { allowSecondPass: settings.trimReviewMode === "trimmed-only" },
    ).then((rs) =>
      candidates.map((p, i) => ({
        photo: p,
        trimmed: rs[i]?.trimmed === true,
        newAssetId: rs[i]?.newAssetId,
        savedMB: rs[i]?.savedMB,
        error: rs[i]?.error,
      })),
    );
    recordAppliedTrimResults(candidates, results);
    const trimmed = results.filter((item) => item.trimmed).map((item) => item.photo);
    if (!hasUnlimitedTrims && trimmed.length > 0) await spendTokens(trimmed.length);
    const actualSaved = results.reduce(
      (sum, item) =>
        item.trimmed ? sum + (item.savedMB ?? estimateTrimSavingsForSettings(item.photo, settings)) : sum,
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
      return trimmed.reduce((sf, photo) => appendActionLog(sf, createActionLogEntry(photo, "trim", estimateTrimSavingsForSettings(photo, settings))), withRecentlySeenPhotos(next, attempted));
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
      await notifyCleanupProgress(t("ui.trim-batch-complete"), t("ui.optimized-photos", { count: trimmed.length }));
    }
    maybeShowInterstitialAfterCleanup(trimmed.length);
    if (trimmed.length !== candidates.length) {
      showToast(t("ui.trim-incomplete"), t("ui.trimmed-result-summary", { trimmed: trimmed.length, total: candidates.length, details: trimFailureSummary(results.map((item) => ({ id: item.photo.id, trimmed: item.trimmed, error: item.error }))) }).trim(), "warning");
    }
  }

  async function confirmThisOrThatOutcome(
    kept: NativePhoto[],
    deleted: NativePhoto[],
    toTrim: NativePhoto[],
  ): Promise<number> {
    const available = hasUnlimitedTrims ? toTrim.length : tokenBalance;
    const trimCandidates = toTrim.filter((photo) => canAttemptTrim(photo, settings)).slice(0, available);
    if (trimCandidates.length < toTrim.length) {
      showToast(
        t("ui.not-enough-tokens"),
        t("ui.selected-trims-cloud-limit", { selected: trimCandidates.length, total: toTrim.length }),
        "warning",
      );
    }

    return requestConfirmation({
      title: t("ui.apply-suggested-removals"),
      detail: t("ui.delete-trim-count", { deleted: deleted.length, trimmed: trimCandidates.length, total: toTrim.length }),
      danger: deleted.length > 0,
      runInBackground: trimCandidates.length > 0,
      onConfirm: async () => {
            const deleteResult = deleted.length > 0 ? await deletePhotos(deleted.map((photo) => photo.id)) : { deleted: 0 };
            const deletedPhotos = deleted.slice(0, deleteResult.deleted);
            setTrimmingCount((count) => count + trimCandidates.length);
            const results = await commitTrims(
              trimCandidates,
              settings.trimQuality,
              settings.trimOutputMode === "replace",
              settings.trimKinds,
              { allowSecondPass: settings.trimReviewMode === "trimmed-only" },
            ).then((rs) => trimCandidates.map((p, i) => ({ trimmed: rs[i]?.trimmed === true, newAssetId: rs[i]?.newAssetId, savedMB: rs[i]?.savedMB, error: rs[i]?.error })));
            recordAppliedTrimResults(trimCandidates, results);
            setTrimmingCount((count) => Math.max(0, count - trimCandidates.length));
            const trimmed = trimCandidates.filter((_, index) => results[index]?.trimmed);
            if (!hasUnlimitedTrims && trimmed.length > 0) await spendTokens(trimmed.length);
            const trimmedIds = new Set(trimmed.map((photo) => photo.id));
            const actualTrimSavings = trimCandidates.reduce(
              (sum, photo, index) =>
                results[index]?.trimmed ? sum + (results[index]?.savedMB ?? estimateTrimSavingsForSettings(photo, settings)) : sum,
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
                      isDeleted ? photo.sizeMB : isTrimmed ? estimateTrimSavingsForSettings(photo, settings) : 0,
                    ),
                  );
                }, withCooldown);
              });
            }
            if (deleteResult.deleted !== deleted.length || trimmed.length !== trimCandidates.length) {
              showToast(
                t("ui.apply-incomplete"),
                t("ui.actions-result-summary", { deleted: deleteResult.deleted, deleteTotal: deleted.length, trimmed: trimmed.length, trimTotal: trimCandidates.length, details: trimFailureSummary(results.map((result, index) => ({ id: trimCandidates[index]?.id ?? String(index), trimmed: result.trimmed, error: result.error }))) }).trim(),
                "warning",
              );
            }
            console.log(t("ui.nativetrimswipe-this-or-that-trim-result"), {
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
    const available = hasUnlimitedTrims ? toTrim.length : tokenBalance;
    const trimCandidates = toTrim.filter((photo) => canAttemptTrim(photo, settings)).slice(0, available);
    if (trimCandidates.length < toTrim.length) {
      showToast(t("ui.not-enough-tokens"), t("ui.selected-trims-limit", { selected: trimCandidates.length, total: toTrim.length }), "warning");
    }
    const trimSavings = trimCandidates.reduce((sum, photo) => sum + estimateTrimSavingsForSettings(photo, settings), 0);
    if (kept.length + deleted.length + toTrim.length === 0) return 0;

    return requestConfirmation({
      title: deleted.length === 0 && toTrim.length === 0 ? t("ui.keep-all-photos") : t("ui.apply-your-budget-choices"),
      detail: deleted.length === 0 && toTrim.length === 0
        ? t("ui.keep-all-count-finish", { count: kept.length })
        : t("ui.delete-trim-savings", { deleted: deleted.length, trimmed: trimCandidates.length, total: toTrim.length, value: formatMB(deleteSavings + trimSavings) }),
      danger: deleted.length > 0,
      runInBackground: trimCandidates.length > 0,
      onConfirm: async () => {
              const deleteResult = deleted.length > 0 ? await deletePhotos(deleted.map((photo) => photo.id)) : { deleted: 0 };
              const deletedPhotos = deleted.slice(0, deleteResult.deleted);
              setTrimmingCount((count) => count + trimCandidates.length);
              const trimResults = await commitTrims(
                trimCandidates,
                settings.trimQuality,
                settings.trimOutputMode === "replace",
                settings.trimKinds,
                { allowSecondPass: settings.trimReviewMode === "trimmed-only" },
              ).then((rs) => trimCandidates.map((p, i) => ({ trimmed: rs[i]?.trimmed === true, newAssetId: rs[i]?.newAssetId, savedMB: rs[i]?.savedMB, error: rs[i]?.error })));
              recordAppliedTrimResults(trimCandidates, trimResults);
              setTrimmingCount((count) => Math.max(0, count - trimCandidates.length));
              const trimmedPhotos = trimCandidates.filter((_, index) => trimResults[index]?.trimmed);
              if (!hasUnlimitedTrims && trimmedPhotos.length > 0) await spendTokens(trimmedPhotos.length);
              const trimmedIds = new Set(trimmedPhotos.map((photo) => photo.id));
              const actualTrimSavings = trimCandidates.reduce(
                (sum, photo, index) =>
                  trimResults[index]?.trimmed ? sum + (trimResults[index]?.savedMB ?? estimateTrimSavingsForSettings(photo, settings)) : sum,
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
                  const mbFreed = action === "delete" ? photo.sizeMB : action === "trim" ? estimateTrimSavingsForSettings(photo, settings) : 0;
                  return appendActionLog(sf, createActionLogEntry(photo, action, mbFreed));
                }, withCooldown);
              });

              if (deleteResult.deleted !== deleted.length || trimmedPhotos.length !== trimCandidates.length) {
                showToast(
                  t("ui.budget-partly-applied"),
                  t("ui.actions-result-summary", { deleted: deleteResult.deleted, deleteTotal: deleted.length, trimmed: trimmedPhotos.length, trimTotal: trimCandidates.length, details: trimFailureSummary(trimResults.map((result, index) => ({ id: trimCandidates[index]?.id ?? String(index), trimmed: result.trimmed, error: result.error }))) }).trim(),
                  "warning",
                );
              }
              maybeShowInterstitialAfterCleanup(reviewed.length);
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
    const available = hasUnlimitedTrims ? toTrim.length : tokenBalance;
    const trimCandidates = toTrim.filter((photo) => canAttemptTrim(photo, settings)).slice(0, available);
    if (trimCandidates.length < toTrim.length) {
      showToast(t("ui.not-enough-tokens"), t("ui.selected-trims-limit", { selected: trimCandidates.length, total: toTrim.length }), "warning");
    }
    const trimSavings = trimCandidates.reduce((sum, photo) => sum + estimateTrimSavingsForSettings(photo, settings), 0);

    return requestConfirmation({
      title: t("ui.apply-past-moments-choices"),
      detail: t("ui.delete-trim-savings", { deleted: deleted.length, trimmed: trimCandidates.length, total: toTrim.length, value: formatMB(deleteSavings + trimSavings) }),
      danger: deleted.length > 0,
      runInBackground: trimCandidates.length > 0,
      onConfirm: async () => {
              const deleteResult = deleted.length > 0 ? await deletePhotos(deleted.map((photo) => photo.id)) : { deleted: 0 };
              const deletedPhotos = deleted.slice(0, deleteResult.deleted);
              setTrimmingCount((count) => count + trimCandidates.length);
              const trimResults = await commitTrims(
                trimCandidates,
                settings.trimQuality,
                settings.trimOutputMode === "replace",
                settings.trimKinds,
                { allowSecondPass: settings.trimReviewMode === "trimmed-only" },
              ).then((rs) => trimCandidates.map((p, i) => ({ trimmed: rs[i]?.trimmed === true, newAssetId: rs[i]?.newAssetId, savedMB: rs[i]?.savedMB, error: rs[i]?.error })));
              recordAppliedTrimResults(trimCandidates, trimResults);
              setTrimmingCount((count) => Math.max(0, count - trimCandidates.length));
              const trimmedPhotos = trimCandidates.filter((_, index) => trimResults[index]?.trimmed);
              if (!hasUnlimitedTrims && trimmedPhotos.length > 0) await spendTokens(trimmedPhotos.length);
              const trimmedIds = new Set(trimmedPhotos.map((photo) => photo.id));
              const actualTrimSavings = trimCandidates.reduce(
                (sum, photo, index) =>
                  trimResults[index]?.trimmed ? sum + (trimResults[index]?.savedMB ?? estimateTrimSavingsForSettings(photo, settings)) : sum,
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
                  const mbFreed = action === "delete" ? photo.sizeMB : action === "trim" ? estimateTrimSavingsForSettings(photo, settings) : 0;
                  return appendActionLog(sf, createActionLogEntry(photo, action, mbFreed));
                }, withCooldown);
              });

              if (deleteResult.deleted !== deleted.length || trimmedPhotos.length !== trimCandidates.length) {
                showToast(
                  t("ui.past-moments-partly-applied"),
                  t("ui.actions-result-summary", { deleted: deleteResult.deleted, deleteTotal: deleted.length, trimmed: trimmedPhotos.length, trimTotal: trimCandidates.length, details: trimFailureSummary(trimResults.map((result, index) => ({ id: trimCandidates[index]?.id ?? String(index), trimmed: result.trimmed, error: result.error }))) }).trim(),
                  "warning",
                );
              }
              maybeShowInterstitialAfterCleanup(deletedPhotos.length + trimmedPhotos.length);
              return reviewed.length;
            },
    });
  }

  async function handleSingleTrimComplete(photo: NativePhoto, savedMB: number) {
    if (!hasUnlimitedTrims) await spendTokens(1);
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
  const dailyReward = dailyRewardState(stats);
  const potentialFromScan = libraryScan
    ? libraryScan.trimSavingsMB + libraryScan.deleteSavingsMB
    : Math.max(stats.mbFreed * 2, 500);
  const scanInProgressText = scanProgress ? formatScanProgress(scanProgress) : undefined;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: activeTheme.background }]}>
      <StatusBar style={settings.theme === "dark" ? "light" : "dark"} />
      <View
        ref={shareShotRef}
        collapsable={false}
        style={[styles.shell, { backgroundColor: activeTheme.background }]}
      >
        {!statsLoaded ? (
          <Centered>
            <ActivityIndicator color="#315f7d" size="large" />
            <Text style={styles.muted}>{t("ui.preparing-trimswipe")}</Text>
          </Centered>
        ) : onboardingDue ? (
          <OnboardingCarousel appVersion={APP_VERSION} onDone={completeOnboarding} />
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
            roundId={swipeRoundId}
            roundInitialCount={swipeRoundInitialCount}
            midsetAdDismissed={midsetAdDismissed}
            largeControls={false}
            tokens={tokenBalance}
            trimsRemaining={trimCurrencyAvailable}
            trimLimit={trimCurrencyAvailable}
            onAction={handleAction}
            onReload={() => loadRound(settings, { showFallbackToast: true })}
            onOpenSettings={() => Linking.openSettings()}
            isPro={isPro}
            hasUnlimitedTrims={hasUnlimitedTrims}
            adEligibilityReady={purchaseAccessReady}
            onChangeSettings={updateSettings}
            onConfirmActions={confirmActions}
            onCancelPending={cancelPendingActions}
            onOpenShop={() => setScreen("shop")}
            onMidsetAdDismissed={() => {
              setMidsetAdDismissed(true);
              setMidsetAdVisible(false);
            }}
            onMidsetAdVisibilityChange={setMidsetAdVisible}
            onShare={shareProgress}
          />
        ) : screen === "stats" ? (
          <StatsDashboard
            stats={stats}
            scan={libraryScan}
            scanBusy={scanBusy}
            scanComplete={scanComplete}
            scanInProgressText={scanInProgressText}
            onQuickScan={runLibraryScan}
            onOpenTrimmable={() => setTrimActionPickerVisible(true)}
            onShare={shareProgress}
          />
        ) : screen === "this-or-that" ? (
          <ThisOrThatScreen
            settings={settings}
            tokens={tokenBalance}
            hasUnlimitedTrims={hasUnlimitedTrims}
            avoidIds={currentAvoidIds()}
            onBack={() => setScreen("games")}
            onConfirmOutcome={confirmThisOrThatOutcome}
          />
        ) : screen === "storage-budget" ? (
          <StorageBudgetScreen
            settings={settings}
            tokens={tokenBalance}
            hasUnlimitedTrims={hasUnlimitedTrims}
            trimsRemaining={trimCurrencyAvailable}
            avoidIds={currentAvoidIds()}
            onBack={() => setScreen("games")}
            onToast={showToast}
            onConfirmOutcome={confirmStorageBudgetOutcome}
          />
        ) : screen === "memory-lane" ? (
          <MemoryLaneScreen
            settings={settings}
            tokens={tokenBalance}
            hasUnlimitedTrims={hasUnlimitedTrims}
            avoidIds={currentAvoidIds()}
            trimsRemaining={trimCurrencyAvailable}
            onBack={() => setScreen("games")}
            onToast={showToast}
            onConfirmOutcome={confirmMemoryLaneOutcome}
          />
        ) : screen === "trim" ? (
          <TrimScreen
            settings={settings}
            trimsRemaining={trimCurrencyAvailable}
            trimLimit={trimCurrencyAvailable}
            avoidIds={currentAvoidIds()}
            isPro={isPro}
            onBack={() => setScreen("games")}
            onTrimmed={handleSingleTrimComplete}
          />
        ) : screen === "quick-cleanup" ? (
          <QuickCleanupReview
            plan={quickCleanupLibrary?.plan ?? null}
            groups={quickCleanupLibrary?.groups ?? []}
            trimOptions={quickCleanupLibrary?.trimOptions ?? []}
            months={quickCleanupLibrary?.months ?? []}
            loading={quickCleanupBusy}
            progress={quickCleanupProgress}
            error={quickCleanupError}
            trimsRemaining={trimCurrencyAvailable}
            onBack={() => setScreen("home")}
            onStartScan={() => {
              setScreen("home");
              void startFreeSpacePlanScan();
            }}
            onOpenSettings={() => void Linking.openSettings()}
            onProtect={toggleQuickProtection}
            onDecideLater={decideQuickLater}
            onConfirm={(deletes, trims) => {
              const deletePhotosForPlan = deletes;
              const trimPhotosForPlan = trims;
              void requestConfirmation({
                title: t("ui.apply-suggested-removals"),
                detail: t("ui.delete-trim-savings", { deleted: deletePhotosForPlan.length, trimmed: trimPhotosForPlan.length, total: trimPhotosForPlan.length, value: formatMB(deletePhotosForPlan.reduce((sum, photo) => sum + photo.sizeMB, 0) + trimPhotosForPlan.reduce((sum, photo) => sum + estimateTrimSavingsForSettings(photo, settings), 0)) }),
                danger: deletePhotosForPlan.length > 0,
                runInBackground: trimPhotosForPlan.length > 0,
                onConfirm: async () => {
                  setQuickCleanupLibrary(null);
                  await clearQuickCleanupReviewCache();
                  commitStats((current) => ({
                    ...current,
                    freeSpacePlan: {
                      ...current.freeSpacePlan,
                      status: "idle",
                      candidateCount: 0,
                      estimatedSavingsMB: 0,
                      estimatedTrimSavingsMB: 0,
                      estimatedDeleteSavingsMB: 0,
                      error: null,
                    },
                  }));
                  setScreen("swipe");
                  showToast(t("ui.cleanup-started"), t("ui.you-can-keep-using-trimswipe-while-the-batch-run"), "info");
                  await confirmActions(deletePhotosForPlan, trimPhotosForPlan);
                  return deletePhotosForPlan.length + trimPhotosForPlan.length;
                },
              }).catch((err) => showToast(t("ui.cleanup-failed"), err instanceof Error ? err.message : t("ui.please-try-again"), "error"));
            }}
          />
        ) : screen === "daily-cleanup" ? (
          <DailyCleanupReview
            plan={dailyCleanupPlan}
            loading={dailyCleanupBusy}
            error={dailyCleanupError}
            trimsRemaining={trimCurrencyAvailable}
            onBack={() => setScreen("home")}
            onOpenSettings={() => void Linking.openSettings()}
            onConfirm={(deletes, trims) => {
              setDailyCleanupPlan(null);
              setScreen("swipe");
              showToast(t("ui.cleanup-started"), t("ui.you-can-keep-using-trimswipe-while-the-batch-run"), "info");
              void confirmActions(deletes.map((item) => item.photo), trims.map((item) => item.photo)).catch((err) => {
                showToast(t("ui.cleanup-failed"), err instanceof Error ? err.message : t("ui.please-try-again"), "error");
              });
            }}
          />
        ) : screen === "cleanup-plan" ? (
          <CleanupPlanScreen
            plan={cleanupPlan}
            loading={cleanupPlanBusy}
            isPro={isPro}
            settings={settings}
            onBack={() => setScreen("home")}
            onRetry={() => {
              const category = cleanupPlan?.category;
              if (category) void openCleanupCategory(category);
            }}
            onConfirm={(deletes, trims) => {
              setCleanupPlan(null);
              setScreen("swipe");
              showToast(t("ui.cleanup-started"), t("ui.you-can-keep-using-trimswipe-while-the-batch-run"), "info");
              void confirmActions(deletes, trims).catch((err) => {
                showToast(t("ui.cleanup-failed"), err instanceof Error ? err.message : t("ui.please-try-again"), "error");
              });
            }}
            trimsRemaining={trimCurrencyAvailable}
            onOpenShop={() => setScreen("shop")}
          />
        ) : screen === "automation" && isPro ? (
          <ProAutomationScreen
            schedules={settings.backgroundScanSchedules}
            busy={cleanupPlanBusy}
            onAddSchedule={addBackgroundSchedule}
            onRunNow={(schedule) => void runBackgroundCleanupScan(schedule, "manual")}
            onUpdateSchedule={updateBackgroundSchedule}
          />
        ) : screen === "shop" ? (
          <ShopScreen
            onBack={() => setScreen("games")}
            onToast={showToast}
            dailyReward={dailyReward}
            onClaimDailyTokens={claimDailyTokens}
            onProStatusChange={(nextIsPro, nextHasUnlimitedTrims) => {
              setIsPro(nextIsPro);
              if (nextHasUnlimitedTrims !== undefined) {
                setHasUnlimitedTrims(nextHasUnlimitedTrims);
              }
              if (nextIsPro) setAccountSignedInState(true);
              void getPurchaseAccessStatus().then((access) => {
                setActiveProductId(access.activeProductId);
              });
            }}
          />
        ) : screen === "games" ? (
          <GamesScreen
            stats={stats}
            settings={settings}
            queue={queue}
            scan={libraryScan}
            tokens={tokenBalance}
            hasUnlimitedTrims={hasUnlimitedTrims}
            onStartGame={startGame}
            onPickCategory={openCleanupCategory}
            onChangeSettings={updateSettings}
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
            scanInProgressText={scanInProgressText}
            tokens={tokenBalance}
            isPro={isPro}
            hasUnlimitedTrims={hasUnlimitedTrims}
            adBusy={adBusy}
            freeSpacePlan={stats.freeSpacePlan}
            freeSpacePlanProgress={quickCleanupProgress}
            onStartSwipe={() => { setScreen("swipe"); void loadRound(settings, { showFallbackToast: true }); }}
            onStartFreeSpacePlan={() => void startFreeSpacePlanScan()}
            onReviewFreeSpacePlan={reviewFreeSpacePlan}
            onOpenTrim={() => setScreen("trim")}
            onOpenGames={() => setScreen("games")}
            onOpenShop={() => setScreen("shop")}
            onWatchAd={handleWatchAd}
            onQuickScan={runLibraryScan}
            onDeepClean={openDeepClean}
            onOptimizeStorage={() => {
              showToast(t("ui.open-settings"), t("ui.optimize-storage-instructions"), "info");
              void Linking.openSettings();
            }}
            onOpenRecentlyDeleted={openRecentlyDeleted}
            onPickCategory={openCleanupCategory}
            onShare={shareProgress}
          />
        ) : (
          <SettingsScreen
            settings={settings}
            isPro={isPro}
            accountSignedIn={accountSignedIn}
            activeProductId={activeProductId}
            samplePhoto={top ?? queue[0]}
            onChange={updateSettings}
            onDailyReminderChange={setDailyReminderEnabled}
            onDailyReminderTimeChange={setDailyReminderTime}
            dailyReminderPermission={dailyReminderPermission}
            onChangeLanguage={async (appLanguage) => {
              const rightToLeft = appLanguage === "ar";
              const directionChanged = rightToLeft !== I18nManager.isRTL;
              const nextSettings = roundSettings({
                ...(pendingSettingsRef.current ?? settings),
                appLanguage,
              });
              I18nManager.allowRTL(rightToLeft);
              I18nManager.forceRTL(rightToLeft);
              pendingSettingsRef.current = nextSettings;
              const nextStats = {
                ...stats,
                settings: nextSettings,
              };
              setStats(nextStats);
              await saveNativeStats(nextStats);
              if (Platform.OS === "web") {
                if (typeof document !== "undefined") document.documentElement.dir = rightToLeft ? "rtl" : "ltr";
                return;
              }
              if (directionChanged) {
                try {
                  await reloadAppAsync("language-direction-changed");
                } catch {
                  // Expo Go cannot reliably restart after a dynamic RTL switch.
                  // The selected language remains saved and applies on the next launch.
                }
              }
            }}
            onReload={reloadSettingsRound}
            onCreateReport={openCleanupReport}
            onRestorePurchases={async () => {
              await setAccountSignedIn(true);
              await restorePurchasesPublic();
              const access = await getPurchaseAccessStatus();
              setAccountSignedInState(true);
              setIsPro(access.isPro);
              setHasUnlimitedTrims(access.hasUnlimitedTrims);
              setActiveProductId(access.activeProductId);
              showToast(
                access.isPro ? "Restored" : t("ui.nothing-to-restore"),
                access.isPro
                  ? t("ui.premium-access-restored")
                  : t("ui.no-active-purchases-were-found-for-this-apple-id"),
                access.isPro ? "success" : "warning",
              );
            }}
            onSignOut={async () => {
              await setAccountSignedIn(false);
              setAccountSignedInState(false);
              setIsPro(false);
              setHasUnlimitedTrims(false);
              setActiveProductId(null);
              showToast(
                t("ui.signed-out"),
                t("ui.premium-benefits-are-disconnected-on-this-device"),
                "success",
              );
            }}
            onManagePurchases={async () => {
              try {
                await Linking.openURL("https://apps.apple.com/account/subscriptions");
              } catch {
                showToast(t("ui.could-not-open-subscriptions"), t("ui.open-subscriptions-instructions"), "warning");
              }
            }}
          />
        )}

        {statsLoaded && !onboardingDue && screen !== "daily-cleanup" ? <BottomNav screen={screen} isPro={isPro} theme={activeTheme} onChange={changeScreen} /> : null}
        {statsLoaded && (trimmingCount > 0 || backgroundTrimResult) ? (
          <BackgroundTrimStatus
            count={trimmingCount}
            result={backgroundTrimResult}
            onOpenResult={() => setTrimResultVisible(true)}
          />
        ) : null}
        <TrimmableActionSheet
          visible={trimActionPickerVisible}
          loading={trimActionLoading}
          onClose={() => setTrimActionPickerVisible(false)}
          onStartSet={(count) => void startTrimmableSwipeSet(count)}
          onTrimAll={() => void prepareTrimAll()}
        />
        <TrimResultSheet
          visible={trimResultVisible}
          result={backgroundTrimResult}
          onClose={() => setTrimResultVisible(false)}
          onDismiss={() => {
            setTrimResultVisible(false);
            setBackgroundTrimResult(null);
          }}
        />
        <ReportDashboardModal
          visible={reportPeriod !== null}
          period={reportPeriod ?? "weekly"}
          stats={stats}
          reportRef={reportCardRef}
          busy={reportExportBusy}
          onClose={() => setReportPeriod(null)}
          onExportImage={() => reportPeriod ? void exportReportImage(reportPeriod) : undefined}
          onExportPdf={() => reportPeriod ? void exportReportPdf(reportPeriod) : undefined}
        />
        <ConfirmSheet request={confirmRequest} busy={confirmBusy} />
        <Toast toast={toast} />
        <DailyReminderPrompt
          visible={dailyReminderPromptVisible}
          reminderTime={formatReminderTime(settings.dailyTrimReminder.time)}
          onEnable={() => void acceptDailyReminderPrompt()}
          onDismiss={declineDailyReminderPrompt}
        />
      </View>
    </SafeAreaView>
  );
}

function trimOptionsForSettings(settings: NativeSettings): { allowSecondPass: boolean; quality: number } {
  return {
    allowSecondPass: settings.trimReviewMode === "trimmed-only",
    quality: settings.trimQuality,
  };
}

function trimStatusForSettings(photo: NativePhoto, settings: NativeSettings) {
  return getTrimStatus(photo, settings.trimKinds, settings.trimQuality, {
    allowSecondPass: settings.trimReviewMode === "trimmed-only",
  });
}

function estimateTrimSavingsForSettings(photo: NativePhoto, settings: NativeSettings): number {
  return estimateTrimSavings(photo, settings.trimKinds, trimOptionsForSettings(settings));
}

function canAttemptTrim(
  photo: NativePhoto,
  settingsOrKinds: NativeSettings | NativeTrimKind[] = ["metadata", "location", "compression"],
): boolean {
  const settings = Array.isArray(settingsOrKinds) ? null : settingsOrKinds;
  const trimKinds: NativeTrimKind[] = Array.isArray(settingsOrKinds)
    ? settingsOrKinds
    : settingsOrKinds.trimKinds;
  const source = photo.localUri || photo.uri;
  return (
    !photo.isCloudAsset &&
    Boolean(source) &&
    !source.startsWith("ph://") &&
    getTrimStatus(photo, trimKinds, settings?.trimQuality, {
      allowSecondPass: settings?.trimReviewMode === "trimmed-only",
    }).canTrim &&
    (!settings || estimateTrimSavingsForSettings(photo, settings) > 0)
  );
}

function trimReviewHint(photo: NativePhoto, settings: NativeSettings): string {
  const status = trimStatusForSettings(photo, settings);
  if (!status.canTrim) return t("ui.cannot-trim-detail", { reason: trimDisabledReason(photo, settings, "detail") });
  return t("ui.image-trim-savings", { size: formatMB(photo.sizeMB), value: formatMB(estimateTrimSavingsForSettings(photo, settings)) });
}

function trimDisabledReason(photo: NativePhoto, settings: NativeSettings, variant: "short" | "detail" = "short"): string {
  const source = photo.localUri || photo.uri;
  const status = trimStatusForSettings(photo, settings);
  if (photo.isCloudAsset || !source || source.startsWith("ph://")) {
    return variant === "short" ? t("ui.icloud-only") : t("ui.photo-not-downloaded");
  }
  if (photo.sizeMB <= 1) {
    return variant === "short" ? t("ui.too-small") : t("ui.file-too-small");
  }
  if (photo.trimState?.blockedReason === "already-optimized") {
    return variant === "short" ? t("ui.already-optimized") : t("ui.already-optimized-detail");
  }
  if (status.statusLabel === t("ui.already-trimmed") || status.nextLabel === t("ui.already-trimmed")) {
    return variant === "short" ? t("ui.already-trimmed") : t("ui.all-trim-data-removed");
  }
  if (status.nextKinds.length === 0) {
    return variant === "short" ? t("ui.no-trim-left") : t("ui.no-selected-trim-actions");
  }
  if (estimateTrimSavingsForSettings(photo, settings) <= 0) {
    return variant === "short" ? t("ui.no-saving") : t("ui.trims-no-saving");
  }
  return variant === "short" ? t("ui.unavailable") : status.statusLabel;
}

function trimmedPhotoLabel(photo: NativePhoto, settings?: NativeSettings): string | null {
  if (!photo.trimState) return null;
  if (photo.trimState.blockedReason === "already-optimized") return t("ui.trimmed-max");
  if (settings && trimStatusForSettings(photo, settings).nextKinds.length === 0) {
    return t("ui.trimmed-max");
  }
  return t("ui.trimmed");
}

function pickStorageBudgetPool(photos: NativePhoto[]): NativePhoto[] {
  const candidates = photos
    .filter((photo) => photo.sizeMB > 0)
    .sort((a, b) => b.sizeMB - a.sizeMB)
    .slice(0, 48);
  if (candidates.length === 0) return [];

  const scale = 10;
  const minUnits = Math.round(BUDGET_MIN_POOL_MB * scale);
  const maxUnits = Math.round(BUDGET_MAX_POOL_MB * scale);
  const targetUnits = Math.round(((BUDGET_MIN_POOL_MB + BUDGET_MAX_POOL_MB) / 2) * scale);
  const states: Array<{ previous: number; index: number } | null> = new Array(maxUnits + 1).fill(null);
  states[0] = { previous: -1, index: -1 };

  candidates.forEach((photo, index) => {
    const units = Math.max(1, Math.round(photo.sizeMB * scale));
    if (units > maxUnits) return;
    for (let sum = maxUnits - units; sum >= 0; sum -= 1) {
      if (!states[sum] || states[sum + units]) continue;
      states[sum + units] = { previous: sum, index };
    }
  });

  let bestSum = -1;
  for (let sum = minUnits; sum <= maxUnits; sum += 1) {
    if (!states[sum]) continue;
    if (bestSum < 0 || Math.abs(sum - targetUnits) < Math.abs(bestSum - targetUnits)) {
      bestSum = sum;
    }
  }
  if (bestSum < 0) {
    for (let sum = maxUnits; sum > 0; sum -= 1) {
      if (states[sum]) {
        bestSum = sum;
        break;
      }
    }
  }
  if (bestSum <= 0) return [candidates[0]];

  const selected: NativePhoto[] = [];
  let cursor = bestSum;
  while (cursor > 0) {
    const state = states[cursor];
    if (!state || state.index < 0) break;
    selected.push(candidates[state.index]);
    cursor = state.previous;
  }
  return selected.sort((a, b) => b.sizeMB - a.sizeMB);
}

function CleanupPlanScreen({
  plan,
  loading,
  isPro,
  settings,
  onBack,
  onRetry,
  onConfirm,
  trimsRemaining,
  onOpenShop,
}: {
  plan: NativeCleanupPlan | null;
  loading: boolean;
  isPro: boolean;
  settings: NativeSettings;
  onBack: () => void;
  onRetry?: () => void;
  onConfirm: (deletes: NativePhoto[], trims: NativePhoto[]) => Promise<void> | void;
  trimsRemaining: number;
  onOpenShop: () => void;
}) {
  if (loading) {
    return (
      <Centered>
        <ActivityIndicator color="#315f7d" size="large" />
        <Text style={styles.heroTitle}>{t("ui.building-preview")}</Text>
        <Text style={styles.centerText}>{t("ui.finding-the-photos-that-will-make-the-biggest-de")}</Text>
      </Centered>
    );
  }

  if (!plan) {
    return (
      <Centered>
        <Text style={styles.heroTitle}>{t("ui.no-cleanup-preview")}</Text>
        <Text style={styles.centerText}>{t("ui.run-a-scan-or-pick-another-smart-folder")}</Text>
        <PrimaryButton label={t("ui.back-home")} onPress={onBack} />
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
  const deepCleanLocked = plan.title === t("ui.deep-clean") && !isPro;
  const actionCount = plan.deleteCandidates.length + plan.trimCandidates.length;

  if (deepCleanLocked) {
    return (
      <Centered>
        <Text style={styles.heroTitle}>{t("ui.deep-clean-is-pro")}</Text>
        <Text style={styles.centerText}>{t("ui.lifetime-pro-unlocks-the-guided-full-library-sca")}</Text>
        <PrimaryButton label={t("ui.open-lifetime-pro")} onPress={onOpenShop} />
        <SecondaryButton label={t("ui.back-home")} onPress={onBack} />
      </Centered>
    );
  }

  if (actionCount === 0) {
    return (
      <Centered>
        <Text style={styles.heroTitle}>{plan.title}</Text>
        <Text style={styles.centerText}>
          No matching local photos were found for this preview. Pick another smart folder or reload after changing focus.
        </Text>
        {onRetry ? <PrimaryButton label={t("ui.try-broader-preview")} onPress={onRetry} /> : null}
        <SecondaryButton label={t("ui.back-home")} onPress={onBack} />
      </Centered>
    );
  }

  return (
    <ConfirmActionsReview
      title={plan.title}
      detail={
        bestKept
          ? t("ui.suggested-to-keep")
          : t("ui.every-batch-is-previewed-first")
      }
      beforeAfter={
        <>
          <View style={styles.beforeAfterCard}>
            <Text style={styles.beforeAfterLabel}>{t("ui.before")}</Text>
            <Text style={styles.beforeAfterValueRed}>+{formatMB(deleteMB)} clutter</Text>
          </View>
          <View style={styles.beforeAfterCard}>
            <Text style={styles.beforeAfterLabel}>{t("ui.after")}</Text>
            <Text style={styles.beforeAfterValueGreen}>{t("ui.save-approx", { value: formatMB(total) })}</Text>
          </View>
        </>
      }
      deletes={plan.deleteCandidates}
      trims={plan.trimCandidates}
      settings={settings}
      onConfirm={onConfirm}
      onCancel={onBack}
      trimsRemaining={trimsRemaining}
    />
  );
}


// ─── Swipe Screen ─────────────────────────────────────────────────────────────

function SwipeScreen({
  top, next, queueCount, loading, error, permissionDenied, permissionLimited,
  settings, recap, pendingDeletes, pendingTrims, trimmingCount, timeLeft,
  roundId, roundInitialCount, midsetAdDismissed, largeControls, tokens,
  trimsRemaining, trimLimit, onAction, onReload, onOpenSettings,
  isPro, hasUnlimitedTrims, adEligibilityReady, onChangeSettings, onConfirmActions, onCancelPending, onOpenShop,
  onMidsetAdDismissed, onMidsetAdVisibilityChange, onShare,
}: {
  top?: NativePhoto; next?: NativePhoto; queueCount: number; loading: boolean;
  error: string | null; permissionDenied: boolean; permissionLimited: boolean;
  settings: NativeSettings; recap: SessionRecap | null; pendingDeletes: NativePhoto[];
  pendingTrims: NativePhoto[];
  trimmingCount: number; timeLeft: number; roundId: number; roundInitialCount: number;
  midsetAdDismissed: boolean; largeControls: boolean; tokens: number; trimsRemaining: number;
  trimLimit: number; onAction: (photo: NativePhoto, action: Action) => void;
  onReload: () => void; onOpenSettings: () => void;
  isPro: boolean; hasUnlimitedTrims: boolean; adEligibilityReady: boolean;
  onChangeSettings: (patch: Partial<NativeSettings>) => void;
  onConfirmActions: (deletes: NativePhoto[], trims: NativePhoto[]) => Promise<void> | void;
  onCancelPending: () => void;
  onOpenShop: () => void;
  onMidsetAdDismissed: () => void;
  onMidsetAdVisibilityChange: (visible: boolean) => void;
  onShare: () => void;
}) {
  const [fullPhoto, setFullPhoto] = useState<NativePhoto | null>(null);
  const [midsetAd, setMidsetAd] = useState<LoadedSwipeMidsetNativeAd | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Keep the photo card within the visible area on 4.7-inch and 5.4-inch
  // iPhones while retaining the larger card on modern Max-sized devices.
  const deckHeight = Math.max(
    330,
    Math.min(492, Math.round(Math.min(windowHeight * 0.52, windowWidth * 1.15))),
  );
  const showMidsetAd = shouldPresentMidsetAd({
    initialCount: roundInitialCount,
    remainingCount: queueCount,
    isPro,
    dismissed: midsetAdDismissed,
    loaded: Boolean(midsetAd),
    hasCurrentPhoto: Boolean(top),
  });
  const midpointReached = hasReachedMidset(roundInitialCount, queueCount);

  useEffect(() => {
    let active = true;
    let ownedAd: LoadedSwipeMidsetNativeAd | null = null;
    setMidsetAd(null);

    if (!adEligibilityReady || isPro || midsetAdDismissed || roundInitialCount < 2) {
      return () => { active = false; };
    }

    void loadSwipeMidsetNativeAd({ freeUserVerified: true }).then((loaded) => {
      if (!loaded) return;
      if (!active) {
        try { loaded.ad.destroy(); } catch {}
        return;
      }
      ownedAd = loaded;
      setMidsetAd(loaded);
    });

    return () => {
      active = false;
      if (ownedAd) {
        try { ownedAd.ad.destroy(); } catch {}
      }
    };
  }, [adEligibilityReady, isPro, midsetAdDismissed, roundId, roundInitialCount]);

  useEffect(() => {
    // The placement belongs exactly at the midpoint. If preloading has not
    // completed by then, fail open for this round instead of interrupting later.
    if (adEligibilityReady && !isPro && !midsetAdDismissed && midpointReached && top && !midsetAd) {
      onMidsetAdDismissed();
    }
  }, [adEligibilityReady, isPro, midpointReached, midsetAd, midsetAdDismissed, onMidsetAdDismissed, top]);

  useEffect(() => {
    onMidsetAdVisibilityChange(showMidsetAd);
    return () => {
      if (showMidsetAd) onMidsetAdVisibilityChange(false);
    };
  }, [onMidsetAdVisibilityChange, showMidsetAd]);

  if (loading) {
    return (
      <Centered>
        <ActivityIndicator color="#315f7d" size="large" />
        <Text style={styles.muted}>{t("ui.loading-your-photo-round")}</Text>
      </Centered>
    );
  }
  if (permissionDenied) {
    return (
      <Centered>
        <Text style={styles.heroTitle}>{t("ui.photo-access-needed")}</Text>
        <Text style={styles.centerText}>{t("ui.trimswipe-needs-photo-access-to-build-your-clean")}</Text>
        <PrimaryButton label={t("ui.open-ios-settings")} onPress={onOpenSettings} />
        <SecondaryButton label={t("ui.try-again")} onPress={onReload} />
      </Centered>
    );
  }
  if ((pendingDeletes.length > 0 || pendingTrims.length > 0) && !top) {
    return (
      <ConfirmActionsReview
        deletes={pendingDeletes}
        trims={pendingTrims}
        settings={settings}
        onConfirm={(d, t) => onConfirmActions(d, t)}
        onCancel={onCancelPending}
        trimsRemaining={trimsRemaining}
      />
    );
  }
  if (recap) {
    return <Recap recap={recap} onNext={onReload} onShare={onShare} />;
  }
  if (error && !top) {
    return (
      <Centered>
        <Text style={styles.heroTitle}>{t("ui.no-deck-yet")}</Text>
        <Text style={styles.centerText}>{error}</Text>
        <PrimaryButton label={t("ui.reload-photos")} onPress={onReload} />
      </Centered>
    );
  }
  return (
    <View style={styles.content}>
      <View style={styles.swipeHeader}>
        <View style={styles.swipeHeaderCopy}>
          <Text style={styles.eyebrow}>{t("ui.current-focus")}</Text>
          <Text style={[styles.swipeTitle, largeControls && styles.swipeTitleLarge]}>{targetLabel(settings)}</Text>
          <Text style={styles.swipeSubtitle}>{t("ui.session-mode-subtitle", { mode: sessionModeLabel(settings.sessionMode) })}</Text>
        </View>
        <View style={styles.swipeStatusColumn}>
          <TokenPill tokens={tokens} hasUnlimitedTrims={hasUnlimitedTrims} />
          <Text style={styles.queuePill}>{t("ui.queue-left", { count: queueCount })}</Text>
          {settings.sessionMode === "time-attack" ? <Text style={styles.timerPill}>{timeLeft}s</Text> : null}
          {trimmingCount > 0 ? <Text style={styles.trimBadge}>{t("ui.trimming-count", { count: trimmingCount })}</Text> : null}
        </View>
      </View>
      {permissionLimited ? <Text style={styles.warning}>{t("ui.limited-photo-access-is-enabled-some-photos-may-")}</Text> : null}
      <View style={[styles.deck, { height: deckHeight }]}>
        {showMidsetAd
          ? top ? <PhotoCard photo={top} settings={settings} stacked /> : null
          : next ? <PhotoCard photo={next} settings={settings} stacked /> : null}
        {showMidsetAd && midsetAd ? (
          <SwipeMidsetAdCard
            loaded={midsetAd}
            onDismiss={onMidsetAdDismissed}
          />
        ) : top ? (
          <SwipeablePhotoCard
            photo={top}
            settings={settings}
            onAction={(action) => onAction(top, action)}
            onOpenFull={() => setFullPhoto(top)}
          />
        ) : null}
      </View>
      {!showMidsetAd ? (
        <View style={styles.actions}>
          <ActionButton label={t("ui.keep")} tone="keep" large={largeControls} onPress={() => top && onAction(top, "keep")} />
          <ActionButton
            label={!top ? t("ui.trim-label") : !canAttemptTrim(top, settings) ? trimDisabledReason(top, settings) : trimsRemaining <= 0 ? t("ui.limit-hit") : t("ui.trim-label")}
            tone="trim"
            large={largeControls}
            disabled={!top || !canAttemptTrim(top, settings)}
            onPress={() => {
              if (!top) return;
              if (trimsRemaining <= 0) {
                onOpenShop();
                return;
              }
              onAction(top, "trim");
            }}
          />
          <ActionButton label={t("ui.delete")} tone="delete" large={largeControls} onPress={() => top && onAction(top, "delete")} />
        </View>
      ) : null}
      <FullPhotoModal photo={fullPhoto} onClose={() => setFullPhoto(null)} />
    </View>
  );
}

function trimFailureSummary(
  results: Array<{ id: string; trimmed: boolean; error?: string }>,
): string {
  const failed = results.filter((result) => !result.trimmed);
  if (failed.length === 0) return "";
  const optimized = failed.filter((result) =>
    result.error?.toLowerCase().includes("optimized") ||
    result.error?.toLowerCase().includes("not produce a smaller image"),
  ).length;
  const cloud = failed.filter((result) => result.error?.toLowerCase().includes("not downloaded")).length;
  const maxed = failed.filter((result) => result.error?.toLowerCase().includes("all selected trims")).length;
  const reasons = new Set<string>();
  if (optimized > 0) {
    reasons.add(t("ui.trim-failure-optimized", { count: optimized }));
  }
  if (cloud > 0) {
    reasons.add(t("ui.trim-failure-cloud", { count: cloud }));
  }
  if (maxed > 0) {
    reasons.add(t("ui.trim-failure-maxed", { count: maxed }));
  }
  failed
    .map((result) => result.error)
    .filter((reason): reason is string => Boolean(reason))
    .filter(
      (reason) =>
        !reason.toLowerCase().includes("optimized") &&
        !reason.toLowerCase().includes("not produce a smaller image") &&
        !reason.toLowerCase().includes("not downloaded") &&
        !reason.toLowerCase().includes("all selected trims"),
    )
    .forEach((reason) => reasons.add(reason));
  if (reasons.size === 0) return t("ui.trim-failure-count", { count: failed.length });
  return [...reasons].slice(0, 2).join(" ");
}

function SwipeablePhotoCard({ photo, settings, onAction, onOpenFull }: { photo: NativePhoto; settings: NativeSettings; onAction: (action: Action) => void; onOpenFull: () => void }) {
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
      <PhotoCard photo={photo} settings={settings} onOpenFull={onOpenFull} />
      <Animated.View pointerEvents="none" style={[styles.swipeTint, styles.keepTint, { opacity: keepOpacity }]} />
      <Animated.View pointerEvents="none" style={[styles.swipeTint, styles.deleteTint, { opacity: deleteOpacity }]} />
    </Animated.View>
  );
}

function PhotoCard({ photo, settings, stacked, onOpenFull }: { photo: NativePhoto; settings: NativeSettings; stacked?: boolean; onOpenFull?: () => void }) {
  const Wrapper = onOpenFull ? Pressable : View;
  const trimStatus = trimStatusForSettings(photo, settings);
  const trimLabel = trimmedPhotoLabel(photo, settings);
  const canTrim = canAttemptTrim(photo, settings);
  return (
    <Wrapper onLongPress={onOpenFull} delayLongPress={350} style={[styles.photoCard, stacked && styles.stackedCard]}>
      <Image source={{ uri: photo.uri }} style={styles.photoImage} resizeMode="cover" />
      <View style={styles.photoShade} />
      <View style={styles.photoTop}>
        {trimLabel ? <Text style={styles.trimmedLabel}>{trimLabel}</Text> : null}
        <Text style={styles.pill}>{t("ui.image-size", { value: formatMB(photo.sizeMB) })}</Text>
        <Text style={styles.pill}>{t("ui.delete-prefix")}<Text style={styles.pillSaving}>-{formatMB(photo.sizeMB)}</Text></Text>
        {canTrim ? (
          <Text style={styles.pill}>{t("ui.trim-prefix")}<Text style={styles.pillSaving}>-{formatMB(estimateTrimSavingsForSettings(photo, settings))}</Text></Text>
        ) : null}
      </View>
      <View style={styles.photoBottom}>
        <Text style={styles.photoTitle} numberOfLines={1}>{photo.title}</Text>
        <Text style={styles.photoMeta}>{photo.month} {photo.year} - {photo.device}</Text>
        <View style={styles.reasonRow}>
          {photo.cleanupReasons.map((reason) => <Text key={reason} style={styles.reason}>{reason}</Text>)}
          {trimStatus.strippedLabels.map((label) => <Text key={label} style={styles.reasonTrimmed}>{label}</Text>)}
          {photo.isCloudAsset ? <Text style={styles.reason}>{t("ui.icloud")}</Text> : null}
        </View>
      </View>
    </Wrapper>
  );
}

// Lets the user deselect any items they no longer want to delete or trim
// before applying the actions in a single batch (one iOS confirmation).
function ConfirmActionsReview({
  title = t("ui.confirm-actions"),
  detail,
  beforeAfter,
  deletes,
  trims,
  settings,
  onConfirm,
  onCancel,
  trimsRemaining,
}: {
  title?: string;
  detail?: string;
  beforeAfter?: ReactNode;
  deletes: NativePhoto[];
  trims: NativePhoto[];
  settings: NativeSettings;
  onConfirm: (deletes: NativePhoto[], trims: NativePhoto[]) => Promise<void> | void;
  onCancel: () => void;
  trimsRemaining?: number;
}) {
  const trimSelectionLimit = Math.max(0, Math.floor(trimsRemaining ?? Number.MAX_SAFE_INTEGER));
  const [deleteList, setDeleteList] = useState<NativePhoto[]>(deletes);
  const [trimList, setTrimList] = useState<NativePhoto[]>(trims);
  const [selectedDeletes, setSelectedDeletes] = useState<Set<string>>(
    () => new Set(deletes.map((p) => p.id)),
  );
  const [selectedTrims, setSelectedTrims] = useState<Set<string>>(
    () => new Set(trims.slice(0, Math.min(trims.length, trimSelectionLimit)).map((p) => p.id)),
  );
  const [fullPhoto, setFullPhoto] = useState<NativePhoto | null>(null);
  const [applying, setApplying] = useState(false);
  const applyingRef = useRef(false);

  const chosenDeletes = deleteList.filter((p) => selectedDeletes.has(p.id));
  const chosenTrims = trimList.filter((p) => selectedTrims.has(p.id));
  const deleteMB = chosenDeletes.reduce((s, p) => s + p.sizeMB, 0);
  const trimMB = chosenTrims.reduce((s, p) => s + estimateTrimSavingsForSettings(p, settings), 0);
  const total = deleteMB + trimMB;
  const nothingSelected = chosenDeletes.length + chosenTrims.length === 0;

  async function handleApply() {
    if (applyingRef.current || nothingSelected) return;
    applyingRef.current = true;
    setApplying(true);
    await new Promise((resolve) => setTimeout(resolve, 80));
    try {
      await onConfirm(chosenDeletes, chosenTrims);
    } finally {
      applyingRef.current = false;
      setApplying(false);
    }
  }

  function toggleDelete(id: string) {
    if (applying) return;
    const next = new Set(selectedDeletes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDeletes(next);
  }

  function toggleTrim(id: string) {
    if (applying) return;
    const next = new Set(selectedTrims);
    if (next.has(id)) next.delete(id);
    else if (next.size < trimSelectionLimit) next.add(id);
    setSelectedTrims(next);
  }

  function moveToDelete(photo: NativePhoto) {
    if (applying) return;
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
    if (applying) return;
    if (!canAttemptTrim(photo, settings)) return;
    setDeleteList((current) => current.filter((item) => item.id !== photo.id));
    setTrimList((current) =>
      current.some((item) => item.id === photo.id) ? current : [...current, photo],
    );
    setSelectedDeletes((current) => {
      const next = new Set(current);
      next.delete(photo.id);
      return next;
    });
    setSelectedTrims((current) => {
      if (current.has(photo.id) || current.size >= trimSelectionLimit) return current;
      return new Set(current).add(photo.id);
    });
  }

  function renderRow(photo: NativePhoto, selected: boolean, onToggle: () => void, hint: string, move: "delete" | "trim") {
    const moveDisabled = move === "trim" && !canAttemptTrim(photo, settings);
    const trimLabel = trimmedPhotoLabel(photo, settings);
    return (
      <Pressable
        key={photo.id}
        onPress={onToggle}
        onLongPress={() => setFullPhoto(photo)}
        delayLongPress={350}
        style={styles.reviewRow}
      >
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          hitSlop={8}
          style={[styles.checkbox, selected && styles.checkboxOn]}
        >
          {selected ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </Pressable>
        <Image source={{ uri: photo.uri }} style={[styles.reviewThumb, !selected && { opacity: 0.4 }]} resizeMode="cover" />
        <View style={styles.reviewCopy}>
          <Text style={[styles.reviewTitle, !selected && { textDecorationLine: "line-through", color: "#9ca3af" }]} numberOfLines={1}>
            {photo.title}
          </Text>
          {trimLabel ? <Text style={styles.reviewTrimmedLabel}>{trimLabel}</Text> : null}
          <Text style={styles.mutedSmall}>{hint}</Text>
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            if (moveDisabled) return;
            if (move === "delete") moveToDelete(photo);
            else moveToTrim(photo);
          }}
          hitSlop={8}
          style={[styles.reviewMoveButton, moveDisabled && styles.reviewMoveButtonDisabled]}
        >
          <Ionicons
            name={move === "delete" ? "trash-outline" : "cut-outline"}
            size={18}
            color={moveDisabled ? "#94a3b8" : move === "delete" ? "#dc2626" : "#315f7d"}
          />
        </Pressable>

      </Pressable>
    );
  }

  return (
    <View style={[styles.content, styles.reviewScreen]}>
      <Text style={styles.heroTitle}>{title}</Text>
      {detail ? <Text style={styles.centerText}>{detail}</Text> : null}
      {beforeAfter ? <View style={styles.beforeAfterRow}>{beforeAfter}</View> : null}
      <Text style={styles.muted}>
        {t("ui.review-actions-help", { deletes: chosenDeletes.length, trims: chosenTrims.length, value: formatMB(total) })}
      </Text>
      {trimSelectionLimit < trimList.length ? (
        <Text style={styles.warning}>{t("ui.not-enough-tokens-count", { selected: trimSelectionLimit, total: trimList.length })}</Text>
      ) : null}
      <ScrollView style={styles.reviewList} contentContainerStyle={styles.reviewListContent}>
        {trimList.length > 0 ? (
          <Text style={[styles.eyebrow, { marginBottom: 6 }]}>{t("ui.trim-count-of", { selected: chosenTrims.length, total: trimList.length })}</Text>
        ) : null}
        {trimList.map((photo) =>
          renderRow(
            photo,
            selectedTrims.has(photo.id),
            () => toggleTrim(photo.id),
            trimReviewHint(photo, settings),
            "delete",
          ),
        )}
        {deleteList.length > 0 ? (
          <Text style={[styles.eyebrow, { marginTop: trimList.length > 0 ? 14 : 0, marginBottom: 6 }]}>
            {t("ui.delete-count-of", { selected: chosenDeletes.length, total: deleteList.length })}
          </Text>
        ) : null}
        {deleteList.map((photo) =>
          renderRow(
            photo,
            selectedDeletes.has(photo.id),
            () => toggleDelete(photo.id),
            canAttemptTrim(photo, settings)
              ? t("ui.delete-frees", { value: photo.sizeMB.toFixed(1) })
              : t("ui.delete-frees-cannot-trim", { value: photo.sizeMB.toFixed(1), reason: trimDisabledReason(photo, settings, "detail") }),
            "trim",
          ),
        )}
      </ScrollView>
      <View style={styles.reviewActionFooter}>
        {applying ? (
          <View style={styles.applyProgressCard}>
            <View style={styles.applyProgressHeader}>
              <Text style={styles.applyProgressTitle}>{t("ui.preparing-changes")}</Text>
              <Text style={styles.applyProgressDetail}>{t("ui.photos-may-ask-for-confirmation-next")}</Text>
            </View>
            <View style={styles.applyProgressTrack}>
              <View style={styles.applyProgressFill} />
            </View>
          </View>
        ) : null}
        <PrimaryButton
          label={applying ? t("ui.applying") : nothingSelected ? t("ui.nothing-selected") : t("ui.apply-save", { value: formatMB(total) })}
          danger={chosenDeletes.length > 0}
          disabled={nothingSelected || applying}
          onPress={handleApply}
        />
        <SecondaryButton label={t("ui.keep-them-all")} disabled={applying} onPress={onCancel} />
      </View>
      <FullPhotoModal photo={fullPhoto} onClose={() => setFullPhoto(null)} />
    </View>
  );
}

function Recap({
  recap,
  onNext,
  onShare,
}: {
  recap: SessionRecap;
  onNext: () => Promise<void> | void;
  onShare: () => void;
}) {
  const [nextBusy, setNextBusy] = useState(false);
  const appear = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const total = recap.kept + recap.trimmed + recap.deleted;
  const trimShare = recap.freed > 0 ? Math.min(1, (recap.trimmed * 3) / Math.max(1, total)) : 0;
  const deleteShare = recap.freed > 0 ? Math.min(1, (recap.deleted * 3) / Math.max(1, total)) : 0;
  const insight = recap.deleted > recap.trimmed
    ? t("ui.deletes-did-the-heavy-lifting-this-round")
    : recap.trimmed > 0
      ? t("ui.trims-quietly-reclaimed-space-without-losing-mem")
      : t("ui.a-light-pass-still-keeps-the-camera-roll-intenti");

  useEffect(() => {
    appear.setValue(0);
    pulse.setValue(0);
    Animated.parallel([
      Animated.timing(appear, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(140),
        Animated.spring(pulse, {
          toValue: 1,
          friction: 4,
          tension: 90,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [appear, pulse]);

  useEffect(() => {
    const shineLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shine, {
          toValue: 1,
          duration: 920,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(7080),
      ]),
    );
    shineLoop.start();
    return () => shineLoop.stop();
  }, [shine]);

  async function handleNext() {
    if (nextBusy) return;
    setNextBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await onNext();
    } catch {
      setNextBusy(false);
    }
  }

  const badgeScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const contentTranslate = appear.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const cardScale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <ScrollView contentContainerStyle={styles.recapContent} showsVerticalScrollIndicator={false}>
      <Animated.View
        style={[
          styles.recapTop,
          { opacity: appear, transform: [{ translateY: contentTranslate }] },
        ]}
      >
        <Animated.View style={[styles.recapBadgeWrap, { transform: [{ scale: badgeScale }] }]}>
          <CelebrationBurst visible />
          <View style={styles.recapBadge}>
            <Ionicons name="checkmark" size={40} color="#ffffff" />
          </View>
        </Animated.View>
        <Text style={styles.heroTitle}>{t("ui.set-complete")}</Text>
        <Text style={styles.centerText}>{t("ui.reviewed-and-freed", { count: total, value: formatMB(recap.freed) })}</Text>
        <Text style={styles.insightText}>{insight}</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.recapImpactCard,
          { opacity: appear, transform: [{ scale: cardScale }, { translateY: contentTranslate }] },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.recapImpactShine,
            {
              opacity: shine.interpolate({
                inputRange: [0, 0.15, 0.75, 1],
                outputRange: [0, 0.85, 0.85, 0],
              }),
              transform: [
                {
                  translateX: shine.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-140, 390],
                  }),
                },
                { rotate: "18deg" },
              ],
            },
          ]}
        />
        <View style={styles.recapImpactHeader}>
          <View>
            <Text style={styles.eyebrow}>{t("ui.round-impact")}</Text>
            <Text style={styles.recapImpactValue}>{formatMB(recap.freed)}</Text>
          </View>
          <View style={styles.recapCleanBadge}>
            <Ionicons name="sparkles" size={18} color="#15803d" />
          </View>
        </View>
        <ImpactRow label={t("ui.trim-momentum")} value={t("ui.photos-count", { count: recap.trimmed })} progress={trimShare} tone="trim" />
        <ImpactRow label={t("ui.delete-momentum")} value={t("ui.photos-count", { count: recap.deleted })} progress={deleteShare} tone="delete" />
        <View style={styles.recapSuccessStrip}>
          <Ionicons name="shield-checkmark-outline" size={17} color="#15803d" />
          <Text style={styles.recapSuccessText}>{t("ui.cleanup-applied-successfully")}</Text>
        </View>
      </Animated.View>
      <Animated.View style={[styles.statGrid, { opacity: appear }]}>
        <MiniStat label={t("ui.kept")} value={recap.kept} />
        <MiniStat label={t("ui.trimmed")} value={recap.trimmed} />
        <MiniStat label={t("ui.deleted")} value={recap.deleted} />
      </Animated.View>
      <PrimaryButton label={nextBusy ? t("ui.loading") : t("ui.new-set")} disabled={nextBusy} onPress={handleNext} />
      <SecondaryButton label={t("ui.share-progress")} disabled={nextBusy} onPress={onShare} />
    </ScrollView>
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
    ? t("ui.video-reclaimed", { count: Math.max(1, Math.round(stats.mbFreed / FOUR_K_VIDEO_MB_PER_MINUTE)) })
    : t("ui.start-reviewing-to-build-your-impact-story");

  const achievements: Achievement[] = [
    { title: t("ui.daily-rhythm"), detail: t("ui.challenge-today", { count: today.reviewed, target: DAILY_REVIEW_TARGET }), progress: clampProgress(today.reviewed, DAILY_REVIEW_TARGET), unlocked: today.reviewed >= DAILY_REVIEW_TARGET },
    { title: t("ui.weekly-saver"), detail: `${formatMB(week.mbFreed)} / ${formatMB(WEEKLY_SAVINGS_TARGET_MB)}`, progress: clampProgress(week.mbFreed, WEEKLY_SAVINGS_TARGET_MB), unlocked: week.mbFreed >= WEEKLY_SAVINGS_TARGET_MB },
    { title: t("ui.metadata-master"), detail: t("ui.stats-badge-trimmed-hint", { count: stats.trimmed }), progress: clampProgress(stats.trimmed, 50), unlocked: stats.trimmed >= 50 },
    { title: t("ui.heavy-hitter"), detail: `${formatMB(stats.mbFreed)} / 1 GB`, progress: clampProgress(stats.mbFreed, 1024), unlocked: stats.mbFreed >= 1024 },
  ];

  return (
    <ScrollView contentContainerStyle={styles.statsContent}>
      {/* Hero health card */}
      <View style={styles.statsHero}>
        <View style={styles.statsHeroLeft}>
          <Text style={styles.eyebrow}>{t("ui.storage-health")}</Text>
          <Text style={styles.statsHeroTitle}>{health < 60 ? t("ui.needs-work") : health < 80 ? t("ui.getting-there") : t("ui.looking-great")}</Text>
          <Text style={styles.statsHeroCopy}>{videoText}</Text>
          <View style={styles.levelRowInline}>
            <Text style={styles.levelLabel}>{t("ui.level-title", { level: level.level, title: level.title })}</Text>
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
        <ImpactPill label={t("ui.freed")} value={formatMB(stats.mbFreed)} accent="#315f7d" />
        <ImpactPill label={t("ui.reviewed")} value={String(stats.reviewed)} accent="#3b82f6" />
        <ImpactPill label={t("ui.deleted")} value={String(stats.deleted)} accent="#ef4444" />
        <ImpactPill label={t("ui.trimmed")} value={String(stats.trimmed)} accent="#22c55e" />
      </View>

      {/* Streak + today */}
      <View style={styles.streakRow}>
        <View style={styles.streakHalf}>
          <Text style={styles.eyebrow}>{t("ui.streak")}</Text>
          <Text style={styles.streakBigNum}>{streak}</Text>
          <Text style={styles.mutedSmall}>{t("ui.days-active")}</Text>
        </View>
        <View style={styles.streakDivider} />
        <View style={styles.streakHalf}>
          <Text style={styles.eyebrow}>{t("ui.today")}</Text>
          <Text style={styles.streakBigNum}>{today.reviewed}</Text>
          <Text style={styles.mutedSmall}>{t("ui.photos-reviewed")}</Text>
        </View>
      </View>

      {/* Activity bar chart */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("ui.last-7-days")}</Text>
      </View>
      <ActivityBars stats={stats} />

      {/* Challenges */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("ui.challenges")}</Text>
        {streak > 0 ? <Text style={styles.sectionBadge}>{t("ui.day-streak", { count: streak })} 🔥</Text> : null}
      </View>
      <ChallengeCard title={t("ui.clean-10-photos-today")} value={`${today.reviewed}/${DAILY_REVIEW_TARGET}`} detail={t("ui.challenge-cleaned", { count: today.trimmed + today.deleted, value: formatMB(today.mbFreed) })} progress={clampProgress(today.reviewed, DAILY_REVIEW_TARGET)} />
      <ChallengeCard title={t("ui.save-500-mb-this-week")} value={formatMB(week.mbFreed)} detail={t("ui.challenge-reviewed-seven-days", { count: week.reviewed })} progress={clampProgress(week.mbFreed, WEEKLY_SAVINGS_TARGET_MB)} />

      {/* Trim savings grid */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("ui.trim-savings")}</Text>
        <Text style={styles.sectionDetail}>{t("ui.week-month-year")}</Text>
      </View>
      <View style={styles.metricGrid}>
        <MetricCard label={t("ui.today")} value={formatMB(today.trimMbFreed)} />
        <MetricCard label={t("ui.this-week")} value={formatMB(week.trimMbFreed)} />
        <MetricCard label={t("ui.this-month")} value={formatMB(monthStats(stats).trimMbFreed)} />
        <MetricCard label={t("ui.this-year")} value={formatMB(yearStats(stats).trimMbFreed)} />
      </View>

      {/* Trim streak */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("ui.trimstreak")}</Text>
        {trimsInARow > 0 ? <Text style={styles.sectionDetail}>{t("ui.days-active-count", { count: trimsInARow })}</Text> : null}
      </View>
      <View style={styles.streakCard}>
        <Text style={styles.streakValue}>{trimsInARow}</Text>
        <View style={styles.streakDivider} />
        <View style={styles.streakCopy}>
          <Text style={styles.challengeTitle}>{t("ui.trims-today", { count: today.trimmed })}</Text>
          <Text style={styles.mutedSmall}>{t("ui.use-your-top-right-balance-for-trims")}</Text>
        </View>
      </View>

      {/* Badges */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("ui.badges")}</Text>
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
        <Text style={styles.mutedSmall}>{t("ui.total-estimated-reclaimed")}</Text>
      </View>
      <ImpactRow label={t("ui.trim")} value={formatMB(trimMB)} progress={total > 0 ? trimMB / total : 0} tone="trim" />
      <ImpactRow label={t("ui.delete")} value={formatMB(deleteMB)} progress={total > 0 ? deleteMB / total : 0} tone="delete" />
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
            <Text style={styles.achievementStatusText}>{achievement.unlocked ? t("ui.done") : t("ui.next")}</Text>
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
  const progressText = scanProgress ? formatScanProgress(scanProgress) : t("ui.scanning");
  return (
    <ScrollView contentContainerStyle={[styles.content, styles.onboardingContent]}>
      <View style={styles.dashboardHero}>
        <Text style={styles.eyebrow}>{t("ui.welcome")}</Text>
        <Text style={styles.heroTitle}>{t("ui.see-what-your-camera-roll-is-costing")}</Text>
        <Text style={styles.dashboardCopy}>{t("ui.start-with-a-scan")}</Text>
        {permissionLimited ? <Text style={styles.warning}>{t("ui.limited-photo-access-is-enabled")}</Text> : null}
        {scanError ? <Text style={styles.warning}>{scanError}</Text> : null}
        <PrimaryButton label={scanBusy ? progressText : scan ? t("ui.scan-again") : t("ui.scan-photo-library")} disabled={scanBusy} onPress={onScan} />
        {permissionDenied ? <SecondaryButton label={t("ui.open-ios-settings")} onPress={() => Linking.openSettings()} /> : null}
      </View>
      {scan ? (
        <>
          <ScanResults scan={scan} />
          <PrimaryButton label={t("ui.choose-a-cleanup-game")} onPress={onDone} />
          <SecondaryButton label={t("ui.tune-settings-first")} onPress={onOpenSettings} />
        </>
      ) : (
        <View style={styles.onboardingSteps}>
          <OnboardingStep title={t("ui.device-aware-bars")} detail={t("ui.the-full-bar-is-your-iphone-or-ipad-storage-capa")} />
          <OnboardingStep title={t("ui.trim-estimate")} detail={t("ui.see-how-much-space-compression-can-save-without-")} />
          <OnboardingStep title={t("ui.review-estimate")} detail={t("ui.see-likely-uncategorized-group-and-mistake-savin")} />
        </View>
      )}
    </ScrollView>
  );
}

function ScanResults({ scan }: { scan: NativeLibraryScan }) {
  const capacityMB = scan.deviceCapacityMB && scan.deviceCapacityMB > 0 ? scan.deviceCapacityMB : Math.max(1, scan.totalSizeMB);
  const afterTrimMB = Math.max(0, scan.totalSizeMB - scan.trimSavingsMB);
  const afterDeleteMB = Math.max(0, scan.totalSizeMB - scan.deleteSavingsMB);
  const capacityLabel = scan.deviceCapacityMB ? t("ui.device-capacity", { value: formatMB(scan.deviceCapacityMB) }) : t("ui.photo-library-size-used-as-scale");
  return (
    <View style={styles.scanPanel}>
      <View style={styles.scanHeader}>
        <View>
          <Text style={styles.eyebrow}>{t("ui.scan-result")}</Text>
          <Text style={styles.scanTotal}>{formatMB(scan.totalSizeMB)}</Text>
        </View>
        <Text style={styles.scanCapacity}>{capacityLabel}</Text>
      </View>
      <View style={styles.scanMetricGrid}>
        <ScanMetric label={t("ui.photos-scanned")} value={String(scan.assetCount)} />
        <ScanMetric label={t("ui.trim-can-save")} value={formatMB(scan.trimSavingsMB)} />
        <ScanMetric label={t("ui.delete-can-save")} value={formatMB(scan.deleteSavingsMB)} />
        <ScanMetric label={t("ui.screenshots-found")} value={String(scan.screenshotCount)} />
      </View>
      <View style={styles.storageBars}>
        <StorageBar label={t("ui.photo-library-now")} detail={t("ui.allocated", { value: formatMB(scan.totalSizeMB) })} valueMB={scan.totalSizeMB} capacityMB={capacityMB} tone="now" />
        <StorageBar label={t("ui.after-trim")} detail={t("ui.estimated-savings", { value: formatMB(scan.trimSavingsMB) })} valueMB={afterTrimMB} capacityMB={capacityMB} tone="trim" />
        <StorageBar label={t("ui.after-delete")} detail={t("ui.disjoint-review-savings", { value: formatMB(scan.deleteSavingsMB) })} valueMB={afterDeleteMB} capacityMB={capacityMB} tone="delete" />
      </View>
      <Text style={styles.scanFootnote}>{t("ui.delete-estimate-detail", { duplicates: scan.duplicateRemovalCount, mistakes: scan.mistakeCount })}</Text>
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

type GameSmartFolder = {
  key: NativeCleanupCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  estMB: number;
  thumb?: string;
};

const GAME_SMART_FOLDER_DEFS: Array<{
  key: NativeCleanupCategory;
  label: (settings: NativeSettings) => string;
  icon: keyof typeof Ionicons.glyphMap;
  match: (photo: NativePhoto, settings: NativeSettings) => boolean;
}> = [
  { key: "large", label: (settings) => `≥${formatGameSizeThreshold(settings.minSizeMB)}`, icon: "albums-outline", match: (photo, settings) => photo.sizeMB >= settings.minSizeMB },
  { key: "old", label: (settings) => settings.minAgeYears <= 0 ? t("ui.any-age") : t("ui.game-old", { value: `≥${formatGameAgeThreshold(settings.minAgeYears)}` }), icon: "time-outline", match: (photo, settings) => gameAgeYears(photo.creationTime) >= settings.minAgeYears },
  { key: "screenshots", label: () => t("ui.home-screens"), icon: "phone-portrait-outline", match: (photo) => photo.cleanupReasons.includes("Screenshot") || photo.title.toLowerCase().includes("screen") },
  { key: "live", label: () => t("ui.home-live"), icon: "radio-button-on-outline", match: (photo) => photo.cleanupReasons.includes(t("ui.live-photo")) },
  { key: "duplicates", label: () => t("ui.similar-photos"), icon: "copy-outline", match: (photo) => photo.cleanupReasons.includes("Similar") },
  { key: "bursts", label: () => t("ui.home-bursts"), icon: "sparkles-outline", match: (photo) => photo.cleanupReasons.includes("Burst") },
];

function photoAccessLabel(permission: NativePhotoPermission | null): string {
  if (!permission) return t("ui.game-checking");
  if (!permission.granted || permission.accessLevel === "none") return t("ui.not-allowed");
  if (permission.accessLevel === "all") return t("ui.all-photos");
  if (permission.accessLevel === "selected") return t("ui.game-selected");
  return t("ui.game-limited");
}

function GamesScreen({ stats, settings, queue, scan, tokens, hasUnlimitedTrims, onStartGame, onPickCategory, onChangeSettings, onOpenThisOrThat, onOpenStorageBudget, onOpenMemoryLane }: {
  stats: NativeStats; settings: NativeSettings; queue: NativePhoto[]; scan: NativeLibraryScan | null; tokens: number; hasUnlimitedTrims: boolean; onStartGame: (patch: Partial<NativeSettings>) => void;
  onPickCategory: (category: NativeCleanupCategory) => void;
  onChangeSettings: (patch: Partial<NativeSettings>) => void;
  onOpenThisOrThat: () => void; onOpenStorageBudget: () => void; onOpenMemoryLane: () => void;
}) {
  const [photoPermission, setPhotoPermission] = useState<NativePhotoPermission | null>(null);
  const today = dailyFor(stats, dateKey());
  const todayLabel = today.mbFreed > 0 ? `${formatMB(today.mbFreed)} ${t("ui.today").toLocaleLowerCase()}` : t("ui.ready-to-clean");
  const largestPhotoMB = Math.max(0.5, scan?.largestPhotoMB ?? 0, ...queue.map((photo) => photo.sizeMB));
  const oldestPhotoAgeYears = Math.max(0, scan?.oldestPhotoAgeYears ?? 0, ...queue.map((photo) => gameAgeYears(photo.creationTime)));
  // Keep a useful tuning range even when the current library happens to contain
  // only small or same-day photos; scan bounds may expand, but never collapse it.
  const largeSliderMax = Math.max(20, largestPhotoMB, settings.minSizeMB);
  const oldSliderMax = Math.max(10, oldestPhotoAgeYears, settings.minAgeYears);
  const largeSliderValue = Math.min(settings.minSizeMB, largeSliderMax);
  const oldSliderValue = Math.min(settings.minAgeYears, oldSliderMax);
  const displayedSettings = { ...settings, minSizeMB: largeSliderValue, minAgeYears: oldSliderValue };
  const largeMaxText = scan && largeSliderMax === largestPhotoMB
    ? t("ui.game-largest-photo", { value: formatGameSizeThreshold(largestPhotoMB) })
    : t("ui.game-range-up-to", { value: formatGameSizeThreshold(largeSliderMax) });
  const oldMaxText = scan && oldSliderMax === oldestPhotoAgeYears
    ? t("ui.game-oldest-photo", { value: formatGameAgeThreshold(oldestPhotoAgeYears) })
    : t("ui.game-range-up-to", { value: formatGameAgeThreshold(oldSliderMax) });
  const smartFolders: GameSmartFolder[] = GAME_SMART_FOLDER_DEFS.map((def) => {
    const matched = queue.filter((photo) => def.match(photo, displayedSettings));
    const queueEstMB = matched.reduce((sum, photo) => sum + (def.key === "screenshots" || def.key === "duplicates" || def.key === "bursts" ? photo.sizeMB : estimateTrimSavingsForSettings(photo, displayedSettings)), 0);
    const scanSummary = (() => {
      if (!scan) return null;
      if (def.key === "large") {
        const items = scan.filterIndex.filter((item) => item.sizeMB >= displayedSettings.minSizeMB);
        return { count: items.length, estMB: items.reduce((sum, item) => sum + item.trimSavingsMB, 0) };
      }
      if (def.key === "old") {
        const items = scan.filterIndex.filter((item) => item.ageYears >= displayedSettings.minAgeYears);
        return { count: items.length, estMB: items.reduce((sum, item) => sum + item.trimSavingsMB, 0) };
      }
      if (def.key === "screenshots") return { count: scan.screenshotCount, estMB: scan.screenshotSavingsMB };
      if (def.key === "live") return { count: scan.livePhotoCount, estMB: scan.livePhotoSavingsMB };
      if (def.key === "duplicates") return { count: scan.duplicateRemovalCount, estMB: scan.duplicateDeleteSavingsMB };
      if (def.key === "bursts") return { count: scan.burstCount, estMB: scan.burstDeleteSavingsMB };
      return null;
    })();
    return {
      key: def.key,
      label: def.label(displayedSettings),
      icon: def.icon,
      count: scanSummary?.count ?? matched.length,
      estMB: scanSummary?.estMB ?? queueEstMB,
      thumb: matched[0]?.uri,
    };
  });

  useEffect(() => {
    let cancelled = false;
    getPhotoPermissionStatus()
      .then((permission) => {
        if (!cancelled) setPhotoPermission(permission);
      })
      .catch(() => {
        if (!cancelled) setPhotoPermission(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function updatePhotoAccess() {
    const current = photoPermission ?? (await getPhotoPermissionStatus().catch(() => null));
    if (!current?.granted) {
      const requested = await requestPhotoPermission();
      setPhotoPermission(requested);
      if (!requested.granted || requested.accessLevel !== "all") {
        await Linking.openSettings();
      }
      return;
    }
    await Linking.openSettings();
    setPhotoPermission(await getPhotoPermissionStatus().catch(() => current));
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
      <View style={styles.gamesVisualHero}>
        <View style={styles.gameTopRow}>
          <View style={styles.gamesHeroCopy}>
            <Text style={styles.eyebrow}>{t("ui.review-modes")}</Text>
            <Text style={styles.heroTitle}>{t("ui.choose-how-to-clean")}</Text>
            <Text style={styles.dashboardCopy}>{todayLabel} · {t("ui.game-photos-reviewed", { count: stats.reviewed })}</Text>
          </View>
          <TokenPill tokens={tokens} hasUnlimitedTrims={hasUnlimitedTrims} />
        </View>
        <View style={styles.heroPhotoStrip}>
          {([GAME_IMAGES.swipe, GAME_IMAGES.choice, GAME_IMAGES.budget] as const).map((source, index) => (
            <Image
              key={index}
              source={source}
              style={[styles.heroPhoto, index === 1 && styles.heroPhotoRaised]}
              resizeMode="cover"
            />
          ))}
        </View>
      </View>
      <Pressable onPress={updatePhotoAccess} style={styles.photoAccessCard}>
        <View style={styles.photoAccessIcon}>
          <Ionicons name="images-outline" size={18} color="#315f7d" />
        </View>
        <View style={styles.photoAccessCopy}>
          <Text style={styles.photoAccessLabel}>{t("ui.photo-access")}</Text>
          <Text style={styles.photoAccessValue}>{photoAccessLabel(photoPermission)}</Text>
        </View>
        <Text style={styles.photoAccessButton}>{photoPermission?.accessLevel === "all" ? t("ui.game-settings") : t("ui.game-permit")}</Text>
      </Pressable>
      <Pressable onPress={() => onStartGame({ sessionMode: "classic" })} style={styles.primaryGameVisualCard}>
        <Image source={GAME_IMAGES.swipe} style={styles.primaryGameArt} resizeMode="cover" />
        <View style={styles.primaryGameText}>
          <View style={styles.primaryGameBadge}><Text style={styles.primaryGameBadgeText}>{t("ui.primary-review")}</Text></View>
          <Text style={styles.primaryGameTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.66}>{t("ui.trimswipe")}</Text>
          <Text style={styles.primaryGameDetail}>{t("ui.swipe-left-up-or-right")}</Text>
        </View>
        <View style={styles.primaryGameIcons}>
          <Ionicons name="checkmark-circle" size={30} color="#ffffff" />
          <Ionicons name="cut" size={30} color="#ffffff" />
          <Ionicons name="trash" size={30} color="#ffffff" />
        </View>
      </Pressable>
      <View style={styles.gameGrid}>
        <VisualGameCard icon="swap-horizontal-outline" title={t("ui.compare-similar")} detail={t("ui.review-a-full-group")} image={GAME_IMAGES.choice} active={settings.targetMode === "similar"} onPress={onOpenThisOrThat} />
        <VisualGameCard icon="speedometer-outline" title={t("ui.free-space-plan")} detail={t("ui.stay-under-50-mb")} image={GAME_IMAGES.budget} onPress={onOpenStorageBudget} />
        <VisualGameCard icon="timer-outline" title={t("ui.quick-review")} detail={t("ui.game-quick-review-time")} image={GAME_IMAGES.speed} active={settings.sessionMode === "time-attack"} onPress={() => onStartGame({ sessionMode: "time-attack" })} />
        <VisualGameCard icon="calendar-outline" title={t("ui.past-moments")} detail={t("ui.old-photos-first")} image={GAME_IMAGES.memory} active={settings.targetMode === "old-only"} onPress={onOpenMemoryLane} />
      </View>
      <View style={styles.focusPanel}>
        <View style={styles.focusHeader}>
          <View>
            <Text style={styles.eyebrow}>{t("ui.cleanup-focus")}</Text>
            <Text style={styles.focusTitle}>{t("ui.tune-smart-folders")}</Text>
          </View>
          <Ionicons name="options-outline" size={22} color="#315f7d" />
        </View>
        <GameFilterSlider
          label={t("ui.large-photos")}
          value={largeSliderValue}
          min={0.5}
          max={largeSliderMax}
          step={0.5}
          formatValue={(sliderValue) => `≥${formatGameSizeThreshold(sliderValue)}`}
          minText={t("ui.0-5-mb-minimum")}
          maxText={largeMaxText}
          onChange={(minSizeMB) => onChangeSettings({ minSizeMB })}
        />
        <GameFilterSlider
          label={t("ui.older-than")}
          value={oldSliderValue}
          min={0}
          max={oldSliderMax}
          step={1 / 12}
          formatValue={(sliderValue) => sliderValue <= 0 ? t("ui.any-age") : t("ui.game-old", { value: `≥${formatGameAgeThreshold(sliderValue)}` })}
          minText={t("ui.any-age")}
          maxText={oldMaxText}
          onChange={(minAgeYears) => onChangeSettings({ minAgeYears })}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.focusFolderScroll}>
          {smartFolders.map((folder) => (
            <GameSmartFolderCard key={folder.key} folder={folder} onPress={() => onPickCategory(folder.key)} />
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

type PlaceholderVariant = "swipe" | "choice" | "budget" | "speed" | "memory" | "folder";

function PlaceholderPhoto({ variant, style }: { variant: PlaceholderVariant; style?: ViewStyle }) {
  const palette: Record<PlaceholderVariant, [string, string, string]> = {
    swipe: ["#cbd8e0", "#4f7892", "#253f50"],
    choice: ["#dbeafe", "#60a5fa", "#1e3a8a"],
    budget: ["#dcfce7", "#22c55e", "#14532d"],
    speed: ["#fee2e2", "#ef4444", "#7f1d1d"],
    memory: ["#f4efe3", "#3f6f8d", "#66552f"],
    folder: ["#f1f5f9", "#94a3b8", "#334155"],
  };
  const [sky, accent, dark] = palette[variant];
  return (
    <View style={[styles.placeholderPhoto, { backgroundColor: sky }, style]}>
      <View style={[styles.placeholderSun, { backgroundColor: accent }]} />
      <View style={[styles.placeholderHillBack, { backgroundColor: dark }]} />
      <View style={[styles.placeholderHillFront, { backgroundColor: accent }]} />
    </View>
  );
}

function VisualGameCard({ icon, title, detail, image, active, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  image: ImageSourcePropType;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.visualGameCard, active && styles.visualGameCardActive]}>
      <View style={styles.visualGameImageWrap}>
        <Image source={image} style={styles.visualGameImage} resizeMode="cover" />
        <View style={styles.visualGameIcon}>
          <Ionicons name={icon} size={16} color="#ffffff" />
        </View>
      </View>
      <View style={styles.gameCopy}>
        <Text
          style={[styles.gameTitle, active && styles.gameTitleActive]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
        >
          {title}
        </Text>
        <Text style={[styles.gameDetail, active && styles.gameDetailActive]} numberOfLines={1}>{detail}</Text>
      </View>
    </Pressable>
  );
}

function GameSmartFolderCard({ folder, onPress }: { folder: GameSmartFolder; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.focusFolderCard}>
      <View style={styles.focusFolderThumbWrap}>
        {folder.thumb ? (
          <Image source={{ uri: folder.thumb }} style={styles.focusFolderThumb} resizeMode="cover" />
        ) : (
          <PlaceholderPhoto variant="folder" style={styles.focusFolderThumb} />
        )}
        <View style={styles.focusFolderIcon}>
          <Ionicons name={folder.icon} size={13} color="#315f7d" />
        </View>
      </View>
      <Text style={styles.focusFolderLabel} numberOfLines={1}>{folder.label}</Text>
      <Text style={styles.focusFolderMeta} numberOfLines={1}>{folder.count} - {formatMB(folder.estMB)}</Text>
    </Pressable>
  );
}

// ─── This or That ─────────────────────────────────────────────────────────────

function ThisOrThatScreen({ settings, tokens, hasUnlimitedTrims, avoidIds, onBack, onConfirmOutcome }: {
  settings: NativeSettings; tokens: number; hasUnlimitedTrims: boolean; avoidIds: string[]; onBack: () => void;
  onConfirmOutcome: (kept: NativePhoto[], deleted: NativePhoto[], toTrim: NativePhoto[]) => Promise<number>;
}) {
  const [clusters, setClusters] = useState<DuplicateCluster[]>([]);
  const [index, setIndex] = useState(0);
  const [loadingClusters, setLoadingClusters] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fullPhoto, setFullPhoto] = useState<NativePhoto | null>(null);
  const [localAvoidIds, setLocalAvoidIds] = useState<string[]>([]);

  async function loadClusters(extraAvoidIds: string[] = []) {
    setLoadingClusters(true);
    try {
      const permission = await requestPhotoPermission();
      if (!permission.granted) { setClusters([]); return; }
      const mergedAvoidIds = [...new Set([...avoidIds, ...localAvoidIds, ...extraAvoidIds])];
      const nextClusters = await loadDuplicatePhotoGroups(8, settings, { avoidIds: mergedAvoidIds });
      setClusters(nextClusters);
      setIndex(0);
    } finally {
      setLoadingClusters(false);
    }
  }

  // The initial scan deliberately uses the settings snapshot from when the mode opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadClusters(); }, []);
  const cluster = clusters[index];

  async function confirmSelection(selection: { keeperId: string; removalIds: string[] }) {
    if (!cluster || busy) return;
    const keeper = cluster.photos.find((photo) => photo.id === selection.keeperId);
    const removals = cluster.photos.filter((photo) => selection.removalIds.includes(photo.id));
    if (!keeper || removals.length === 0) return;
    setBusy(true);
    try {
      const applied = await onConfirmOutcome([keeper], removals, []);
      if (applied > 0) {
        const reviewedIds = cluster.photos.map((photo) => photo.id);
        setLocalAvoidIds((current) => [...new Set([...current, ...reviewedIds])]);
        if (index + 1 < clusters.length) setIndex((current) => current + 1);
        else void loadClusters(reviewedIds);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loadingClusters) {
    return <Centered><ActivityIndicator color="#334155" size="large" /><Text style={styles.muted}>{t("ui.comparing-photos-privately-on-this-iphone")}</Text></Centered>;
  }

  if (!cluster) {
    return (
      <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
        <MiniGameHeader title={t("ui.compare-similar")} detail={t("ui.no-groups-ready")} tokens={tokens} hasUnlimitedTrims={hasUnlimitedTrims} onBack={onBack} />
        <View style={styles.dashboardHero}>
          <Text style={styles.heroTitle}>{t("ui.no-similar-photo-groups-found")}</Text>
          <Text style={styles.dashboardCopy}>{t("ui.only-confirmed-groups-are-shown-here-unrelated-p")}</Text>
          <PrimaryButton label={t("ui.scan-again")} onPress={() => void loadClusters()} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
      <MiniGameHeader title={t("ui.compare-similar")} detail={t("ui.group-progress", { current: index + 1, total: clusters.length })} tokens={tokens} hasUnlimitedTrims={hasUnlimitedTrims} onBack={onBack} />
      <DuplicateClusterReview
        cluster={cluster}
        confirmLabel={busy ? t("ui.applying") : t("ui.review-suggested-removals")}
        onPreviewPhoto={setFullPhoto}
        onConfirmRemovals={(selection) => void confirmSelection(selection)}
      />
      <FullPhotoModal photo={fullPhoto} onClose={() => setFullPhoto(null)} />
    </ScrollView>
  );
}

// ─── Storage Budget (FIX 3) ───────────────────────────────────────────────────

function StorageBudgetScreen({ settings, tokens, hasUnlimitedTrims, trimsRemaining, avoidIds, onBack, onToast, onConfirmOutcome }: {
  settings: NativeSettings; tokens: number; hasUnlimitedTrims: boolean; trimsRemaining: number; avoidIds: string[]; onBack: () => void;
  onToast: (title: string, detail?: string, tone?: ToastMessage["tone"]) => void;
  onConfirmOutcome: (kept: NativePhoto[], deleted: NativePhoto[], toTrim: NativePhoto[]) => Promise<number>;
}) {
  const [photos, setPhotos] = useState<NativePhoto[]>([]);
  const [keptIds, setKeptIds] = useState<Set<string>>(new Set());
  const [localAvoidIds, setLocalAvoidIds] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [fullPhoto, setFullPhoto] = useState<NativePhoto | null>(null);
  const [step, setStep] = useState<"select" | "unkept" | "kept">("select");
  const [unkeptAction, setUnkeptAction] = useState<"delete" | "trim">("delete");
  const [keptAction, setKeptAction] = useState<"keep" | "trim">("keep");

  async function loadBoard(extraAvoidIds: string[] = []) {
    setLoadingPhotos(true);
    try {
      const permission = await requestPhotoPermission();
      if (!permission.granted) { setPhotos([]); return; }
      const mergedAvoidIds = [...new Set([...avoidIds, ...localAvoidIds, ...extraAvoidIds])];
      const firstSettings = roundSettings({
        ...settings,
        cardsPerRound: 30,
        targetMode: settings.targetMode,
        sessionMode: "classic",
      });
      let fallbackNotice = "";
      let batch = await loadPhotoRound(48, firstSettings, {
        avoidIds: mergedAvoidIds,
        includeTrimmed: true,
        onFallback: (detail) => {
          fallbackNotice = detail;
        },
      });
      let finalPool = pickStorageBudgetPool(batch);
      if (finalPool.length === 0 && firstSettings.targetMode !== "balanced") {
        const fallbackSettings = roundSettings({
          ...firstSettings,
          targetMode: nextFallbackTargetMode(firstSettings.targetMode),
        });
        fallbackNotice =
          `${targetLabel(firstSettings)} did not return matching local photos. ` +
          `Trying ${targetLabel(fallbackSettings)} instead.`;
        batch = await loadPhotoRound(48, fallbackSettings, { avoidIds: mergedAvoidIds, includeTrimmed: true });
        finalPool = pickStorageBudgetPool(batch);
      }
      if (finalPool.length === 0 && firstSettings.targetMode !== "balanced") {
        const broadSettings = roundSettings({ ...firstSettings, targetMode: "balanced" });
        fallbackNotice =
          `${targetLabel(firstSettings)} did not return matching local photos. ` +
          t("ui.trying-a-balanced-board-instead");
        batch = await loadPhotoRound(48, broadSettings, { avoidIds: mergedAvoidIds, includeTrimmed: true });
        finalPool = pickStorageBudgetPool(batch);
      }
      if (fallbackNotice) {
        onToast(t("ui.filter-widened"), fallbackNotice, "info");
      }
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
  const unkeptTrimCandidates = notKeptPhotos.filter((photo) => canAttemptTrim(photo, settings));
  const keptTrimCandidates = keptPhotos.filter((photo) => canAttemptTrim(photo, settings));
  const plannedUnkeptTrims = unkeptAction === "trim" ? unkeptTrimCandidates.slice(0, trimsRemaining) : [];
  const remainingAfterUnkept = Math.max(0, trimsRemaining - plannedUnkeptTrims.length);
  const plannedKeptTrims = keptAction === "trim" ? keptTrimCandidates.slice(0, remainingAfterUnkept) : [];
  const plannedKeptTrimIds = new Set(plannedKeptTrims.map((photo) => photo.id));
  const keptAsIs = keptPhotos.filter((photo) => !plannedKeptTrimIds.has(photo.id));
  const toDelete = unkeptAction === "delete" ? notKeptPhotos : notKeptPhotos.filter((photo) => !canAttemptTrim(photo, settings));
  const toTrim = [...plannedUnkeptTrims, ...plannedKeptTrims];
  const usedMB = keptPhotos.reduce((sum, photo) => sum + photo.sizeMB, 0);
  const overBudget = usedMB > BUDGET_KEEP_LIMIT_MB;
  const deleteSavings = toDelete.reduce((sum, photo) => sum + photo.sizeMB, 0);
  const trimSavings = toTrim.reduce((sum, photo) => sum + estimateTrimSavingsForSettings(photo, settings), 0);
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
      onToast(t("ui.over-budget"), `Remove ${formatMB(usedMB - BUDGET_KEEP_LIMIT_MB)} from your kept photos before continuing.`, "warning");
      return;
    }
    setStep("unkept");
  }

  async function applyBudgetPlan() {
    setBusy(true);
    try {
      const count = await onConfirmOutcome(keptAsIs, toDelete, toTrim);
      if (count > 0 || toDelete.length === 0) {
        const boardIds = photos.map((photo) => photo.id);
        setLocalAvoidIds((current) => [...new Set([...current, ...boardIds])].slice(-120));
        void loadBoard(boardIds);
      }
    } finally {
      setBusy(false);
    }
  }

  async function keepAllAndFinish() {
    setBusy(true);
    try {
      const count = await onConfirmOutcome(photos, [], []);
      if (count > 0) {
        const boardIds = photos.map((photo) => photo.id);
        setLocalAvoidIds((current) => [...new Set([...current, ...boardIds])].slice(-120));
        void loadBoard(boardIds);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loadingPhotos) return <Centered><ActivityIndicator color="#334155" size="large" /><Text style={styles.muted}>{t("ui.building-a-free-space-plan")}</Text></Centered>;

  if (photos.length === 0) {
    return (
      <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
        <MiniGameHeader title={t("ui.free-space-plan")} detail={t("ui.no-plan-yet")} tokens={tokens} hasUnlimitedTrims={hasUnlimitedTrims} onBack={onBack} />
        <View style={styles.dashboardHero}>
          <Text style={styles.heroTitle}>{t("ui.no-budget-photos-found")}</Text>
          <Text style={styles.dashboardCopy}>{t("ui.no-budget-photos-detail")}</Text>
          <PrimaryButton label={t("ui.reload-photos")} onPress={() => void loadBoard(photos.map((photo) => photo.id))} />
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.budgetShell}>
      <Animated.ScrollView
        contentContainerStyle={[styles.content, styles.dashboardContent, styles.budgetContentWithFloating]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <MiniGameHeader title={t("ui.free-space-plan")} detail={t("ui.keep-what-fits")} tokens={tokens} hasUnlimitedTrims={hasUnlimitedTrims} onBack={onBack} />
      <View style={styles.dashboardHero}>
        <View style={styles.dashboardHeroTop}>
          <View>
            <Text style={styles.eyebrow}>{t("ui.budget")}</Text>
            <Text style={styles.heroTitle}>{formatMB(usedMB)} / {formatMB(BUDGET_KEEP_LIMIT_MB)}</Text>
          </View>
          <View style={styles.healthScore}>
            <Text style={styles.healthValue}>{keptPhotos.length}</Text>
            <Text style={styles.healthLabel}>{t("ui.kept")}</Text>
          </View>
        </View>
        <View style={styles.storageTrack}>
          <View style={[styles.storageFill, overBudget ? styles.storageFillDelete : styles.storageFillTrim, { width: progressWidth(Math.min(1, usedMB / BUDGET_KEEP_LIMIT_MB)) }]} />
        </View>
        <Text style={styles.dashboardCopy}>{t("ui.budget-selection-help")}</Text>
        <Text style={styles.mutedSmall}>
          {t("ui.pool-total", { value: formatMB(totalPoolMB) })}
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
            label={busy ? t("ui.applying") : t("ui.continue-with-kept", { count: keptPhotos.length })}
            disabled={busy || photos.length === 0}
            onPress={lockBudget}
          />
          <SecondaryButton
            label={t("ui.keep-all-finish")}
            disabled={busy}
            onPress={() => void keepAllAndFinish()}
          />
        </>
      ) : step === "unkept" ? (
        <BudgetDecisionStep
          title={t("ui.unkept-photos")}
          detail={t("ui.photos-outside-keep", { count: notKeptPhotos.length })}
          options={[
            { key: "delete", label: t("ui.delete-label"), detail: t("ui.free-value", { value: formatMB(notKeptPhotos.reduce((sum, photo) => sum + photo.sizeMB, 0)) }) },
            { key: "trim", label: unkeptTrimCandidates.length > 0 ? t("ui.trim-label") : t("ui.no-trimmable-photos"), detail: t("ui.try-save-value", { value: formatMB(unkeptTrimCandidates.reduce((sum, photo) => sum + estimateTrimSavingsForSettings(photo, settings), 0)) }) },
          ]}
          value={unkeptAction}
          onChange={(value) => setUnkeptAction(value as "delete" | "trim")}
          onBack={() => setStep("select")}
          onNext={() => setStep("kept")}
        />
      ) : (
        <BudgetDecisionStep
          title={t("ui.kept-photos")}
          detail={t("ui.selected-photos", { count: keptPhotos.length })}
          options={[
            { key: "keep", label: t("ui.keep-label"), detail: t("ui.leave-originals-as-they-are") },
            { key: "trim", label: keptTrimCandidates.length > 0 ? t("ui.trim-label") : t("ui.no-trimmable-photos"), detail: t("ui.try-save-value", { value: formatMB(keptTrimCandidates.reduce((sum, photo) => sum + estimateTrimSavingsForSettings(photo, settings), 0)) }) },
          ]}
          value={keptAction}
          onChange={(value) => setKeptAction(value as "keep" | "trim")}
          onBack={() => setStep("unkept")}
          onNext={applyBudgetPlan}
          nextLabel={busy ? t("ui.applying") : t("ui.apply-save-approx", { value: formatMB(deleteSavings + trimSavings) })}
          disabled={busy}
        />
      )}
      </Animated.ScrollView>
      <FullPhotoModal photo={fullPhoto} onClose={() => setFullPhoto(null)} />
      <Animated.View style={[styles.floatingBudget, { transform: [{ translateY: budgetTranslateY }, { scale: budgetScale }] }]}>
        <Text style={styles.floatingBudgetLabel}>{t("ui.used")}</Text>
        <Text style={[styles.floatingBudgetValue, overBudget && styles.floatingBudgetOver]}>{formatMB(usedMB)} / {formatMB(BUDGET_KEEP_LIMIT_MB)}</Text>
        <View style={styles.floatingBudgetTrack}>
          <View style={[styles.floatingBudgetFill, overBudget ? styles.storageFillDelete : styles.storageFillTrim, { width: progressWidth(Math.min(1, usedMB / BUDGET_KEEP_LIMIT_MB)) }]} />
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Memory Lane (FIX 4) ──────────────────────────────────────────────────────

function MemoryLaneScreen({ settings, tokens, hasUnlimitedTrims, avoidIds, trimsRemaining, onBack, onToast, onConfirmOutcome }: {
  settings: NativeSettings; tokens: number; hasUnlimitedTrims: boolean; avoidIds: string[]; trimsRemaining: number; onBack: () => void;
  onToast: (title: string, detail?: string, tone?: ToastMessage["tone"]) => void;
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
      let fallbackNotice = "";
      let next = await loadPhotoRound(
        roundSize,
        { ...settings, cardsPerRound: roundSize, targetMode: "old-only", sessionMode: "classic" },
        {
          avoidIds,
          includeTrimmed: true,
          onFallback: (detail) => {
            fallbackNotice = detail;
          },
        },
      );
      if (next.length === 0) {
        const broadSettings = roundSettings({
          ...settings,
          cardsPerRound: roundSize,
          targetMode: "balanced",
          sessionMode: "classic",
          minAgeYears: 0,
          minSizeMB: 0,
        });
        next = await loadPhotoRound(roundSize, broadSettings, {
          avoidIds,
          includeTrimmed: true,
        });
        if (next.length === 0 && avoidIds.length > 0) {
          next = await loadPhotoRound(roundSize, broadSettings, {
            avoidIds: [],
            includeTrimmed: true,
          });
        }
        if (next.length > 0) {
          fallbackNotice = t("ui.no-older-matches-were-available-so-any-age-and-a");
        }
      }
      if (fallbackNotice) {
        onToast(t("ui.older-photos-finished"), fallbackNotice, "info");
      }
      setPhotos(next);
      setIndex(0); setGuess(null); setKept([]); setDeleted([]); setToTrim([]); setRevealed(false);
      setOptions(next[0] ? yearOptions(next[0].year) : []);
    } finally { setLoadingPhotos(false); }
  }

  useEffect(() => { void loadMemories(); }, []);

  const photo = photos[index];
  const freed = deleted.reduce((sum, item) => sum + item.sizeMB, 0);
  const trimFreed = toTrim.reduce((sum, item) => sum + estimateTrimSavingsForSettings(item, settings), 0);
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
    else if (action === "trim" && canAttemptTrim(photo, settings)) setToTrim((current) => [...current, photo]);
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
    try {
      const count = await onConfirmOutcome(kept, deleted, toTrim);
      if (count > 0 || deleted.length + toTrim.length === 0) void loadMemories();
    } finally {
      setBusy(false);
    }
  }

  if (loadingPhotos) return <Centered><ActivityIndicator color="#315f7d" size="large" /><Text style={styles.muted}>{t("ui.finding-older-memories")}</Text></Centered>;

  if (!photo) {
    const hasReviewedAny = kept.length + deleted.length + toTrim.length > 0;
    const hasActions = deleted.length + toTrim.length > 0;
    if (!hasReviewedAny) {
      return (
        <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
          <MiniGameHeader title={t("ui.past-moments")} detail={t("ui.no-memories-loaded")} tokens={tokens} hasUnlimitedTrims={hasUnlimitedTrims} onBack={onBack} />
          <View style={styles.dashboardHero}>
            <Text style={styles.heroTitle}>{t("ui.no-memories-found")}</Text>
            <Text style={styles.dashboardCopy}>{t("ui.no-memories-detail")}</Text>
            <PrimaryButton label={t("ui.reload-photos")} disabled={busy} onPress={() => void loadMemories()} />
          </View>
        </ScrollView>
      );
    }
    return (
      <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
          <MiniGameHeader title={t("ui.past-moments")} detail={t("ui.round-complete")} tokens={tokens} hasUnlimitedTrims={hasUnlimitedTrims} onBack={onBack} />
        <View style={styles.dashboardHero}>
          <View style={styles.memorySummaryList}>
            <MemorySummaryItem label={t("ui.kept")} value={kept.length} tone="keep" />
            <MemorySummaryItem label={t("ui.trimmed")} value={toTrim.length} tone="trim" />
            <MemorySummaryItem label={t("ui.cleared")} value={deleted.length} tone="delete" />
          </View>
          <Text style={styles.dashboardCopy}>
            {hasActions
              ? t("ui.memory-actions-summary", { count: toTrim.length, value: formatMB(freed + trimFreed) })
              : t("ui.no-photos-were-marked-to-trim-or-delete")}
          </Text>
          {hasActions ? (
            <>
              <PrimaryButton label={busy ? t("ui.applying") : t("ui.apply-choices-save", { value: formatMB(freed + trimFreed) })} disabled={busy} onPress={confirmDeletes} />
              <SecondaryButton label={t("ui.play-another-round-without-deleting")} onPress={() => void loadMemories()} />
            </>
          ) : (
            <PrimaryButton label={t("ui.play-another-round")} disabled={busy} onPress={() => void loadMemories()} />
          )}
        </View>
      </ScrollView>
    );
  }

  // FIX 4: Border color based on correct/wrong answer
  const cardBorderColor = !revealed ? "#cbd8e0" : isCorrect ? "#22c55e" : "#ef4444";
  const memoryTrimLabel = trimmedPhotoLabel(photo, settings);

  return (
    <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
      <MiniGameHeader title={t("ui.past-moments")} detail={t("ui.memories-progress", { current: index + 1, total: photos.length })} tokens={tokens} hasUnlimitedTrims={hasUnlimitedTrims} onBack={onBack} />
      <Pressable onLongPress={() => setFullPhoto(photo)} delayLongPress={350} style={[styles.memoryCard, { borderColor: cardBorderColor, borderWidth: revealed ? 3 : StyleSheet.hairlineWidth }]}>
        <Image source={{ uri: photo.uri }} style={styles.memoryImage} resizeMode="cover" />
        <View style={styles.photoShade} />
        {memoryTrimLabel ? <Text style={styles.trimmedChoiceBadge}>{memoryTrimLabel}</Text> : null}
        <View style={styles.choiceFooter}>
          <Text style={styles.choiceTitle} numberOfLines={2}>{photo.title}</Text>
          <Text style={styles.choiceMeta}>{formatMB(photo.sizeMB)}</Text>
        </View>
        <CelebrationBurst visible={showCelebration} />
      </Pressable>

      {!revealed ? (
        <View style={styles.dashboardHero}>
          <Text style={styles.heroTitle}>{t("ui.what-year-was-this")}</Text>
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
          <Text style={styles.eyebrow}>{t("ui.actually")}</Text>
          <Text style={styles.heroTitle}>{photo.month} {photo.year}</Text>
          <Text style={styles.dashboardCopy}>
            {isCorrect ? "🎉" : t("ui.actual-year", { year: photo.year })} {t("ui.memory-result-next")}
          </Text>
          <View style={styles.actions}>
            <ActionButton label={t("ui.keep")} tone="keep" onPress={() => decide("keep")} />
            <ActionButton
              label={toTrim.length >= trimsRemaining ? t("ui.no-tokens") : canAttemptTrim(photo, settings) ? t("ui.trim-label") : trimDisabledReason(photo, settings)}
              tone="trim"
              disabled={toTrim.length >= trimsRemaining || !canAttemptTrim(photo, settings)}
              onPress={() => decide("trim")}
            />
            <ActionButton label={t("ui.clear")} tone="delete" onPress={() => decide("delete")} />
          </View>
        </View>
      )}
      <FullPhotoModal photo={fullPhoto} onClose={() => setFullPhoto(null)} />
    </ScrollView>
  );
}

// ─── Shared mini components ───────────────────────────────────────────────────

function MemorySummaryItem({ label, value, tone }: { label: string; value: number; tone: "keep" | "trim" | "delete" }) {
  const color = tone === "keep" ? "#16a34a" : tone === "trim" ? "#315f7d" : "#dc2626";
  return (
    <View style={styles.memorySummaryItem}>
      <View style={[styles.memorySummaryBullet, { backgroundColor: color }]} />
      <Text style={styles.memorySummaryText}>{label}</Text>
      <Text style={[styles.memorySummaryValue, { color }]}>{value}</Text>
    </View>
  );
}

function MiniGameHeader({ title, detail, tokens, hasUnlimitedTrims, onBack }: { title: string; detail: string; tokens: number; hasUnlimitedTrims: boolean; onBack: () => void }) {
  return (
    <View style={styles.miniGameHeader}>
      <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backButtonText}>{t("ui.back")}</Text></Pressable>
      <View style={styles.miniGameHeaderCopy}>
        <Text style={styles.eyebrow}>{detail}</Text>
        <Text style={styles.heroTitle}>{title}</Text>
      </View>
      <TokenPill tokens={tokens} hasUnlimitedTrims={hasUnlimitedTrims} />
    </View>
  );
}

function TokenPill({ tokens, hasUnlimitedTrims = false }: { tokens: number; hasUnlimitedTrims?: boolean }) {
  return (
    <View style={styles.tokenPill}>
      <Ionicons name="flash" size={14} color="#66552f" />
      <Text style={styles.tokenPillText}>{hasUnlimitedTrims ? "∞" : tokens}</Text>
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
        <SecondaryButton label={t("ui.back")} onPress={onBack} />
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
            <Ionicons name={request.danger ? "trash" : "checkmark"} size={24} color={request.danger ? "#dc2626" : "#315f7d"} />
          </View>
          <Text style={styles.confirmTitle}>{request.title}</Text>
          <Text style={styles.confirmDetail}>{request.detail}</Text>
          <View style={styles.confirmActions}>
            <SecondaryButton label={request.cancelLabel} onPress={request.onCancel} />
            <PrimaryButton label={busy ? t("ui.applying") : request.confirmLabel} danger={request.danger} disabled={busy} onPress={request.onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ReportDashboardModal({
  visible,
  period,
  stats,
  reportRef,
  busy,
  onClose,
  onExportImage,
  onExportPdf,
}: {
  visible: boolean;
  period: ReportPeriod;
  stats: NativeStats;
  reportRef: RefObject<View | null>;
  busy: "image" | "pdf" | null;
  onClose: () => void;
  onExportImage: () => void;
  onExportPdf: () => void;
}) {
  const data = reportDashboardData(stats, period);
  const { periodStats } = data;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.reportModalBackdrop}>
        <View style={styles.reportModalSheet}>
          <View ref={reportRef} collapsable={false} style={styles.reportDashboardCard}>
            <View style={styles.dashboardHeroTop}>
              <View style={styles.gameCopy}>
                <Text style={styles.eyebrow}>{t("ui.trimswipe")}</Text>
                <Text style={styles.reportModalTitle}>{data.title}</Text>
                <Text style={styles.dashboardCopy}>{t("ui.report-range-progress", { range: data.rangeLabel })}</Text>
              </View>
              <View style={styles.reportIcon}>
                <Ionicons name="document-text-outline" size={22} color="#315f7d" />
              </View>
            </View>

            <View style={styles.reportBeforeAfterRow}>
              <View style={styles.reportBeforeAfterCard}>
                <Text style={styles.beforeAfterLabel}>{t("ui.before")}</Text>
                <Text style={styles.reportBeforeAfterValue}>{formatMB(data.beforeTotal)}</Text>
                <Text style={styles.mutedSmall}>{t("ui.previously-reclaimed")}</Text>
              </View>
              <View style={styles.reportBeforeAfterCard}>
                <Text style={styles.beforeAfterLabel}>{t("ui.after")}</Text>
                <Text style={styles.reportBeforeAfterValue}>{formatMB(data.afterTotal)}</Text>
                <Text style={styles.mutedSmall}>{t("ui.reclaimed-total")}</Text>
              </View>
            </View>

            <View style={styles.reportProgressPanel}>
              <View style={styles.impactLabelRow}>
                <Text style={styles.impactLabel}>{t("ui.progress")}</Text>
                <Text style={styles.impactAmount}>{formatMB(periodStats.mbFreed)}</Text>
              </View>
              <Text style={styles.reportProgressValue}>{formatMB(periodStats.mbFreed)}</Text>
              <Text style={styles.mutedSmall}>{t("ui.photos-reviewed-count", { count: periodStats.reviewed })}</Text>
              <View style={styles.reportStackedTrack}>
                <View style={[styles.reportStackedTrim, { width: percentValue(data.trimPercent) }]} />
                <View style={[styles.reportStackedDelete, { width: percentValue(data.deletePercent) }]} />
              </View>
              <View style={styles.reportLegendRow}>
                <Text style={styles.reportLegendTrim}>{t("ui.trim-value", { value: formatMB(periodStats.trimMbFreed) })}</Text>
                <Text style={styles.reportLegendDelete}>{t("ui.delete-value", { value: formatMB(periodStats.deleteMbFreed) })}</Text>
              </View>
            </View>

            <View style={styles.statGrid}>
              <MiniStat label={t("ui.kept")} value={periodStats.kept} />
              <MiniStat label={t("ui.trimmed")} value={periodStats.trimmed} />
              <MiniStat label={t("ui.deleted")} value={periodStats.deleted} />
            </View>
          </View>

          <View style={styles.reportModalActions}>
            <SecondaryButton label={t("ui.close")} disabled={busy !== null} onPress={onClose} />
            <View style={styles.reportButtonRow}>
              <Pressable disabled={busy !== null} style={[styles.reportButton, busy !== null && styles.secondaryButtonDisabled]} onPress={onExportImage}>
                <Ionicons name="image-outline" size={18} color="#315f7d" />
                <Text style={styles.reportButtonText}>{busy === "image" ? t("ui.exporting") : t("ui.image")}</Text>
              </Pressable>
              <Pressable disabled={busy !== null} style={[styles.reportButton, busy !== null && styles.secondaryButtonDisabled]} onPress={onExportPdf}>
                <Ionicons name="document-outline" size={18} color="#315f7d" />
                <Text style={styles.reportButtonText}>{busy === "pdf" ? t("ui.exporting") : t("ui.pdf")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DailyReminderPrompt({
  visible,
  reminderTime,
  onEnable,
  onDismiss,
}: {
  visible: boolean;
  reminderTime: string;
  onEnable: () => void;
  onDismiss: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={dailyReminderPromptStyles.backdrop}>
        <View style={dailyReminderPromptStyles.card}>
          <View style={dailyReminderPromptStyles.icon}>
            <Ionicons name="moon-outline" size={24} color={colors.primary} />
          </View>
          <Text style={dailyReminderPromptStyles.title}>{t("ui.daily-trim-reminder-prompt-title")}</Text>
          <Text style={dailyReminderPromptStyles.body}>{t("ui.daily-trim-reminder-prompt-body").replace("8:30 PM", reminderTime)}</Text>
          <Pressable style={dailyReminderPromptStyles.primaryButton} onPress={onEnable}>
            <Text style={dailyReminderPromptStyles.primaryText}>{t("ui.enable-daily-trim-reminder")}</Text>
          </Pressable>
          <Pressable style={dailyReminderPromptStyles.secondaryButton} onPress={onDismiss}>
            <Text style={dailyReminderPromptStyles.secondaryText}>{t("ui.not-now")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const dailyReminderPromptStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.52)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  card: { width: "100%", maxWidth: 420, borderRadius: radius.lg, padding: spacing.xl, backgroundColor: colors.card, gap: spacing.md },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  title: { ...type.title, color: colors.text },
  body: { ...type.body, color: colors.textMuted, lineHeight: 22 },
  primaryButton: { minHeight: 50, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, marginTop: spacing.sm },
  primaryText: { color: colors.white, fontSize: 14, fontWeight: "900" },
  secondaryButton: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.textMuted, fontSize: 13, fontWeight: "800" },
});

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

function BudgetPhotoTile({ photo, kept, onPress, onLongPress }: { photo: NativePhoto; kept: boolean; onPress: () => void; onLongPress: () => void }) {
  const trimLabel = trimmedPhotoLabel(photo);
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350} style={[styles.budgetTile, kept && styles.budgetTileKept]}>
      <Image source={{ uri: photo.uri }} style={styles.budgetImage} resizeMode="cover" />
      <View style={styles.choiceShade} />
      <Text style={[styles.budgetStatus, kept && styles.budgetStatusKept]}>{kept ? t("ui.keep-label") : t("ui.cut")}</Text>
      {trimLabel ? <Text style={styles.trimmedTileBadge}>{trimLabel}</Text> : null}
      <Text style={styles.budgetSize}>{formatMB(photo.sizeMB)}</Text>
    </Pressable>
  );
}

function FullPhotoModal({ photo, onClose }: { photo: NativePhoto | null; onClose: () => void }) {
  const trimLabel = photo ? trimmedPhotoLabel(photo) : null;
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
              {trimLabel ? <Text style={styles.fullPhotoTrimmed}>{trimLabel}</Text> : null}
              <Text style={styles.fullPhotoMeta}>{photo.month} {photo.year} - {formatMB(photo.sizeMB)}</Text>
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

function QueuePhotoRow({ photo }: { photo: NativePhoto }) {
  const trimLabel = trimmedPhotoLabel(photo);
  return (
    <View style={styles.reviewRow}>
      <Image source={{ uri: photo.uri }} style={styles.reviewThumb} resizeMode="cover" />
      <View style={styles.reviewCopy}>
        <Text style={styles.reviewTitle} numberOfLines={1}>{photo.title}</Text>
        {trimLabel ? <Text style={styles.reviewTrimmedLabel}>{trimLabel}</Text> : null}
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
        <Text style={styles.mutedSmall}>{entry.mbFreed > 0 ? t("ui.value-saved", { value: formatMB(entry.mbFreed) }) : t("ui.no-storage-change")} - {entry.createdAt.slice(0, 10)}</Text>
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
  ["big-or-old", "ui.large-or-old", "ui.photos-over-either-threshold"],
  ["big-only", "ui.focus-large", "ui.photos-over-the-size-threshold"],
  ["old-only", "ui.focus-old", "ui.older-memories-first"],
  ["similar", "ui.similar-photos", "ui.visually-related-photos-to-compare-together"],
  ["blurry", "ui.focus-blurry", "ui.likely-blurry-dark-or-accidental-shots"],
  ["multibursts", "ui.focus-bursts", "ui.rapid-fire-photo-groups"],
  ["screenshots", "ui.focus-screens", "ui.screenshots-and-screen-grabs"],
];

function FocusDropdown({ value, onChange }: { value: NativeTargetMode; onChange: (value: NativeTargetMode) => void }) {
  const selected = FOCUS_OPTIONS.find(([option]) => option === value) ?? FOCUS_OPTIONS[0];
  return (
    <View style={styles.settingCardVertical}>
      <View style={styles.dashboardHeroTop}>
        <View style={styles.scanQuickCopy}>
          <Text style={styles.settingLabel}>{t("ui.focus-mode")}</Text>
          <Text style={styles.mutedSmall}>{t("ui.one-active-filter-keeps-cleanup-rounds-predictab")}</Text>
        </View>
        <Text style={styles.proPill}>{t(selected[1])}</Text>
      </View>
      <View style={styles.dropdownList}>
        {FOCUS_OPTIONS.map(([option, label, detail]) => {
          const active = value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => onChange(option)}
              style={[styles.dropdownOption, active && styles.dropdownOptionActive]}
            >
              <View style={styles.radioRow}>
                <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                  {active ? <View style={styles.radioInner} /> : null}
                </View>
                <View style={styles.reviewCopy}>
                  <Text style={[styles.dropdownOptionTitle, active && styles.dropdownOptionTitleActive]}>{t(label)}</Text>
                  <Text style={styles.mutedSmall}>{t(detail)}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function QualityPreview({ photo, currentQuality }: { photo?: NativePhoto; currentQuality: number }) {
  const baseSize = photo?.sizeMB ?? 4;
  const variants = [
    { label: "100%", quality: 1, color: "#94a3b8" },
    { label: "75%", quality: 0.75, color: "#4f7892" },
    { label: "50%", quality: 0.5, color: "#ef4444" },
  ];
  return (
    <View style={styles.qualityPreview}>
      <View style={styles.dashboardHeroTop}>
        <View style={styles.scanQuickCopy}>
          <Text style={styles.settingLabel}>{t("ui.trim-quality-preview")}</Text>
          <Text style={styles.mutedSmall}>{photo ? photo.title : t("ui.load-a-deck-to-preview-with-one-of-your-photos")}</Text>
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

type QualityPreviewItem = {
  label: string;
  quality: number;
  color: string;
  uri?: string;
  sizeMB: number;
  generated: boolean;
};

const BASE_QUALITY_PREVIEW_VARIANTS = [
  { label: "100%", quality: 1, color: "#94a3b8" },
  { label: "75%", quality: 0.75, color: "#4f7892" },
  { label: "50%", quality: 0.5, color: "#ef4444" },
];

function projectedQualitySize(baseSize: number, quality: number): number {
  if (quality === 1) return baseSize;
  return +(baseSize * (0.38 + quality * 0.5)).toFixed(2);
}

function qualityPreviewVariants(currentQuality: number) {
  const variants = [
    ...BASE_QUALITY_PREVIEW_VARIANTS,
    { label: `${Math.round(currentQuality * 100)}%`, quality: currentQuality, color: colors.primary },
  ];
  return variants
    .filter((variant, index, all) => all.findIndex((item) => Math.abs(item.quality - variant.quality) < 0.005) === index)
    .sort((a, b) => b.quality - a.quality);
}

function EnhancedQualityPreview({ photo, currentQuality }: { photo?: NativePhoto; currentQuality: number }) {
  const baseSize = photo?.sizeMB ?? 4;
  const variants = useMemo(() => qualityPreviewVariants(currentQuality), [currentQuality]);
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previews, setPreviews] = useState<QualityPreviewItem[]>(() =>
    variants.map((variant) => ({
      ...variant,
      uri: photo?.uri,
      sizeMB: projectedQualitySize(baseSize, variant.quality),
      generated: variant.quality === 1,
    })),
  );

  useEffect(() => {
    let cancelled = false;
    const generatedUris: string[] = [];
    const sourceUri = photo?.localUri || photo?.uri;
    const fallback = variants.map((variant) => ({
      ...variant,
      uri: photo?.uri,
      sizeMB: projectedQualitySize(baseSize, variant.quality),
      generated: variant.quality === 1,
    }));

    setPreviews(fallback);
    setActiveIndex(0);

    if (!photo || !sourceUri || sourceUri.startsWith("ph://")) {
      return () => undefined;
    }

    const previewSourceUri = sourceUri;

    async function buildPreviews() {
      const next: QualityPreviewItem[] = [fallback[0]];
      for (const variant of variants.slice(1)) {
        try {
          const result = await ImageManipulator.manipulateAsync(previewSourceUri, [], {
            compress: variant.quality,
            format: ImageManipulator.SaveFormat.JPEG,
          });
          generatedUris.push(result.uri);
          const info = await FileSystem.getInfoAsync(result.uri);
          const bytes = (info as FileSystem.FileInfo & { size?: number }).size ?? 0;
          next.push({
            ...variant,
            uri: result.uri,
            sizeMB: bytes > 0 ? +(bytes / (1024 * 1024)).toFixed(2) : projectedQualitySize(baseSize, variant.quality),
            generated: bytes > 0,
          });
        } catch {
          next.push(fallback[next.length]);
        }
      }
      if (!cancelled) setPreviews(next);
    }

    void buildPreviews();

    return () => {
      cancelled = true;
      generatedUris.forEach((uri) => {
        void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
      });
    };
  }, [baseSize, photo, variants]);

  const activePreview = previews[activeIndex] ?? previews[0];
  return (
    <View style={styles.qualityPreview}>
      <View style={styles.dashboardHeroTop}>
        <View style={styles.scanQuickCopy}>
          <Text style={styles.settingLabel}>{t("ui.trim-quality-preview")}</Text>
          <Text style={styles.mutedSmall}>{photo ? photo.title : t("ui.load-a-deck-to-preview-with-one-of-your-photos")}</Text>
        </View>
        {photo ? (
          <Pressable onPress={() => setExpanded(true)} style={styles.qualityThumbButton}>
            <Image source={{ uri: activePreview?.uri ?? photo.uri }} style={styles.qualityThumb} resizeMode="cover" />
          </Pressable>
        ) : null}
      </View>
      {previews.map((variant, index) => {
        const saved = Math.max(0, baseSize - variant.sizeMB);
        const active = Math.abs(currentQuality - variant.quality) < 0.08;
        return (
          <Pressable key={variant.label} onPress={() => { setActiveIndex(index); setExpanded(true); }} style={styles.qualityRow}>
            <Text style={[styles.qualityLabel, active && { color: variant.color }]}>{variant.label}</Text>
            <View style={styles.qualityTrack}>
              <View style={[styles.qualityFill, { width: progressWidth(variant.sizeMB / baseSize), backgroundColor: variant.color }]} />
            </View>
            <Text style={styles.mutedSmall}>
              {t("ui.quality-save", {
                size: formatMB(variant.sizeMB),
                saved: formatMB(saved),
                percent: Math.round((saved / Math.max(baseSize, 0.01)) * 100),
                estimated: variant.generated ? "" : t("ui.estimated-short"),
              })}
            </Text>
          </Pressable>
        );
      })}
      <Modal visible={expanded && Boolean(photo)} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
        <View style={styles.qualityModalOverlay}>
          <Pressable onPress={() => setExpanded(false)} hitSlop={12} style={styles.fullPhotoClose}>
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
          {photo ? (
            <View style={styles.qualityModalContent}>
              <Image source={{ uri: activePreview?.uri ?? photo.uri }} style={styles.qualityModalImage} resizeMode="contain" />
              <View style={styles.qualityCompareStrip}>
                {previews.map((variant, index) => {
                  const active = index === activeIndex;
                  return (
                    <Pressable key={variant.label} onPress={() => setActiveIndex(index)} style={[styles.qualityCompareItem, active && styles.qualityCompareItemActive]}>
                      <Image source={{ uri: variant.uri ?? photo.uri }} style={styles.qualityCompareThumb} resizeMode="cover" />
                      <Text style={[styles.qualityCompareLabel, active && { color: variant.color }]}>{variant.label}</Text>
                      <Text style={styles.qualityCompareSize}>{formatMB(variant.sizeMB)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const TRIM_KIND_OPTIONS: Array<{ kind: NativeTrimKind; labelKey: string; detailKey: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { kind: "metadata", labelKey: "ui.metadata", detailKey: "ui.camera-lens-edits-app-notes", icon: "document-text-outline" },
  { kind: "location", labelKey: "ui.location", detailKey: "ui.gps-coordinates-when-present", icon: "location-outline" },
  { kind: "compression", labelKey: "ui.compression", detailKey: "ui.final-shrink-pass-for-already-stripped-photos", icon: "contract-outline" },
];

function trimKindDetail(option: (typeof TRIM_KIND_OPTIONS)[number], quality: number): string {
  const detail = t(option.detailKey);
  if (option.kind === "metadata") return t("ui.trim-detail-percent", { detail });
  if (option.kind === "location") return t("ui.trim-detail-location", { detail });
  const savedPercent = Math.max(0, Math.round((1 - projectedQualitySize(1, quality)) * 100));
  return t("ui.trim-detail-quality", { detail, saved: savedPercent, quality: Math.round(quality * 100) });
}

function TrimKindSettings({
  settings,
  isPro,
  compact,
  onChange,
}: {
  settings: NativeSettings;
  isPro: boolean;
  compact?: boolean;
  onChange: (patch: Partial<NativeSettings>) => void;
}) {
  function toggle(kind: NativeTrimKind) {
    if (!isPro) return;
    const active = settings.trimKinds.includes(kind);
    const next = active
      ? settings.trimKinds.filter((item) => item !== kind)
      : [...settings.trimKinds, kind];
    onChange({ trimKinds: next.length > 0 ? next : [kind] });
  }

  return (
    <View style={[styles.settingCardVertical, compact && styles.trimKindCompact]}>
      <View style={styles.dashboardHeroTop}>
        <View style={styles.scanQuickCopy}>
          <Text style={styles.settingLabel}>{compact ? t("ui.trim-settings") : t("ui.default-trim-data")}</Text>
          <Text style={styles.mutedSmall}>
            {isPro ? t("ui.choose-what-trim-is-allowed-to-remove") : t("ui.lifetime-pro-unlocks-selectable-trim-data")}
          </Text>
        </View>
        {!isPro ? <Text style={styles.proPill}>{t("ui.pro")}</Text> : null}
      </View>
      <View style={styles.trimKindGrid}>
        {TRIM_KIND_OPTIONS.map((option) => {
          const active = settings.trimKinds.includes(option.kind);
          return (
            <Pressable
              key={option.kind}
              disabled={!isPro}
              onPress={() => toggle(option.kind)}
              style={[styles.trimKindOption, active && styles.trimKindOptionActive, !isPro && styles.trimKindOptionLocked]}
            >
              <Ionicons name={isPro ? option.icon : "lock-closed-outline"} size={17} color={active ? "#315f7d" : "#64748b"} />
              <View style={styles.reviewCopy}>
                <Text style={[styles.trimKindLabel, active && styles.trimKindLabelActive]}>{t(option.labelKey)}</Text>
                {!compact ? <Text style={styles.mutedSmall}>{trimKindDetail(option, settings.trimQuality)}</Text> : null}
              </View>
              <View style={[styles.checkbox, active && styles.checkboxOn]}>
                {active ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function BackgroundTrimStatus({ count, result, onOpenResult }: { count: number; result: BackgroundTrimResult | null; onOpenResult: () => void }) {
  const finished = count <= 0 && result !== null;
  return (
    <Pressable
      disabled={!finished}
      accessibilityRole={finished ? "button" : "progressbar"}
      accessibilityLabel={finished ? t("ui.trimming-finished-open-results") : t("ui.trimming-background-count", { count })}
      onPress={onOpenResult}
      style={({ pressed }) => [styles.backgroundTrimStatus, finished && styles.backgroundTrimFinished, pressed && styles.backgroundTrimPressed]}
    >
      {finished ? <Ionicons name="checkmark-circle" size={22} color="#ffffff" /> : <ActivityIndicator size="small" color="#ffffff" />}
      <View style={styles.backgroundTrimCopy}>
        <Text style={styles.backgroundTrimTitle}>{finished ? t("ui.trimming-finished") : t("ui.trimming-in-background")}</Text>
        <Text style={styles.backgroundTrimDetail}>
          {finished && result
            ? t("ui.trim-result-tap", { count: result.trimmed, value: formatMB(result.savedMB) })
            : t("ui.trimming-processing", { count })}
        </Text>
      </View>
      {finished ? <Ionicons name="chevron-forward" size={19} color="#ffffff" /> : null}
    </Pressable>
  );
}

function TrimmableActionSheet({ visible, loading, onClose, onStartSet, onTrimAll }: {
  visible: boolean;
  loading: boolean;
  onClose: () => void;
  onStartSet: (count: number) => void;
  onTrimAll: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.confirmBackdrop}>
        <View style={styles.confirmSheet}>
          <View style={styles.confirmIcon}><Ionicons name="cut-outline" size={24} color="#315f7d" /></View>
          <Text style={styles.confirmTitle}>{t("ui.review-trimmable-photos")}</Text>
          <Text style={styles.confirmDetail}>{t("ui.trim-action-sheet-detail", { count: BULK_TRIM_LIMIT })}</Text>
          <Text style={styles.eyebrow}>{t("ui.swipe-a-set")}</Text>
          <View style={styles.trimSetChoices}>
            {[10, 20, 30].map((count) => (
              <Pressable key={count} disabled={loading} onPress={() => onStartSet(count)} style={styles.trimSetChoice}>
                <Text style={styles.trimSetChoiceValue}>{count}</Text>
                <Text style={styles.trimSetChoiceLabel}>{t("ui.photos")}</Text>
              </Pressable>
            ))}
          </View>
          <PrimaryButton label={t("ui.trim-up-to", { count: BULK_TRIM_LIMIT })} disabled={loading} onPress={onTrimAll} />
          <SecondaryButton label={t("ui.cancel")} disabled={loading} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function TrimResultSheet({ visible, result, onClose, onDismiss }: {
  visible: boolean;
  result: BackgroundTrimResult | null;
  onClose: () => void;
  onDismiss: () => void;
}) {
  if (!result) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.confirmBackdrop}>
        <View style={styles.confirmSheet}>
          <View style={[styles.confirmIcon, styles.trimResultIcon]}><Ionicons name="checkmark" size={26} color="#ffffff" /></View>
          <Text style={styles.confirmTitle}>{t("ui.trimming-finished")}</Text>
          <Text style={styles.confirmDetail}>{t("ui.trim-result-success", { trimmed: result.trimmed, requested: result.requested })}</Text>
          <View style={styles.trimBeforeAfter}>
            <View style={styles.trimResultMetric}><Text style={styles.trimResultLabel}>{t("ui.before")}</Text><Text style={styles.trimResultValue}>{formatMB(result.beforeMB)}</Text></View>
            <Ionicons name="arrow-forward" size={20} color="#64748b" />
            <View style={styles.trimResultMetric}><Text style={styles.trimResultLabel}>{t("ui.after")}</Text><Text style={styles.trimResultValue}>{formatMB(result.afterMB)}</Text></View>
          </View>
          <View style={styles.trimSavedCard}>
            <Text style={styles.trimSavedLabel}>{t("ui.space-saved")}</Text>
            <Text style={styles.trimSavedValue}>{formatMB(result.savedMB)}</Text>
            {result.failed > 0 ? <Text style={styles.trimFailedText}>{result.failed} photo{result.failed === 1 ? "" : "s"} could not be trimmed.</Text> : null}
          </View>
          <PrimaryButton label={t("ui.done")} onPress={onDismiss} />
        </View>
      </View>
    </Modal>
  );
}

function ProAutomationScreen({
  schedules,
  busy,
  onAddSchedule,
  onRunNow,
  onUpdateSchedule,
}: {
  schedules: NativeBackgroundScanSchedule[];
  busy: boolean;
  onAddSchedule: () => void;
  onRunNow: (schedule: NativeBackgroundScanSchedule) => void;
  onUpdateSchedule: (
    scheduleId: string,
    updater: (schedule: NativeBackgroundScanSchedule) => NativeBackgroundScanSchedule,
  ) => void;
}) {
  return (
    <ScrollView contentContainerStyle={[styles.content, styles.dashboardContent]}>
      <View style={styles.dashboardHero}>
        <View style={styles.dashboardHeroTop}>
          <View style={styles.gameCopy}>
            <Text style={styles.eyebrow}>{t("ui.pro-automation")}</Text>
            <Text style={styles.heroTitle}>{t("ui.scheduled-cleanup-checks")}</Text>
          </View>
          <View style={styles.reportIcon}>
            <Ionicons name="alarm-outline" size={23} color="#315f7d" />
          </View>
        </View>
        <Text style={styles.dashboardCopy}>{t("ui.automation-copy")}</Text>
      </View>

      {schedules.map((schedule) => (
        <AutomationScheduleCard
          key={schedule.id}
          schedule={schedule}
          busy={busy}
          onRunNow={onRunNow}
          onUpdate={(updater) => onUpdateSchedule(schedule.id, updater)}
        />
      ))}

      <SecondaryButton label={t("ui.add-schedule")} onPress={onAddSchedule} />
    </ScrollView>
  );
}

function AutomationScheduleCard({
  schedule,
  busy,
  onRunNow,
  onUpdate,
}: {
  schedule: NativeBackgroundScanSchedule;
  busy: boolean;
  onRunNow: (schedule: NativeBackgroundScanSchedule) => void;
  onUpdate: (updater: (schedule: NativeBackgroundScanSchedule) => NativeBackgroundScanSchedule) => void;
}) {
  const lastSuggestion = schedule.lastSuggestionAt ? new Date(schedule.lastSuggestionAt) : null;
  const summary = t("ui.automation-summary", {
    days: scheduleDaysLabel(schedule.days),
    time: scheduleTimeLabel(schedule.times),
    value: formatMB(schedule.targetMB),
  });
  const scheduleLabel = schedule.label === "Daily cleanup check"
    ? t("ui.automation-daily-check")
    : /^Cleanup check \d+$/.test(schedule.label)
      ? t("ui.automation-check-number", { count: schedule.label.replace(/\D/g, "") })
      : schedule.label;

  function toggleDay(day: number) {
    onUpdate((current) => {
      const nextDays = current.days.includes(day)
        ? current.days.filter((item) => item !== day)
        : [...current.days, day].sort((a, b) => a - b);
      return { ...current, days: nextDays.length > 0 ? nextDays : current.days };
    });
  }

  function updateTime(index: number, nextTime: string) {
    onUpdate((current) => {
      const nextTimes = current.times.map((time, timeIndex) => (timeIndex === index ? nextTime : time));
      return { ...current, times: uniqueSortedTimes(nextTimes) };
    });
  }

  function removeTime(index: number) {
    onUpdate((current) => ({
      ...current,
      times: current.times.length > 1 ? current.times.filter((_, timeIndex) => timeIndex !== index) : current.times,
    }));
  }

  function addTime() {
    onUpdate((current) => {
      const lastTime = current.times[current.times.length - 1] ?? "09:00";
      return { ...current, times: uniqueSortedTimes([...current.times, shiftScheduleTime(lastTime, 60)]) };
    });
  }

  return (
    <View style={styles.automationCard}>
      <View style={styles.dashboardHeroTop}>
        <View style={styles.automationTitleBlock}>
          <Text style={styles.settingLabel}>{scheduleLabel}</Text>
          <Text style={styles.settingValue}>{schedule.active ? t("ui.automation-active") : t("ui.automation-inactive")}</Text>
          <Text style={styles.mutedSmall}>{summary}</Text>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: schedule.active }}
          onPress={() => onUpdate((current) => ({ ...current, active: !current.active }))}
          style={[styles.toggleTrack, schedule.active && styles.toggleTrackActive]}
        >
          <View style={[styles.toggleKnob, schedule.active && styles.toggleKnobActive]} />
        </Pressable>
      </View>

      <View style={styles.dayToggleRow}>
        {WEEKDAY_LABELS.map((label, index) => {
          const active = schedule.days.includes(index);
          return (
            <Pressable key={label} onPress={() => toggleDay(index)} style={[styles.dayToggle, active && styles.dayToggleActive]}>
              <Text style={[styles.dayToggleText, active && styles.dayToggleTextActive]}>{t(label).slice(0, 1)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.automationTimes}>
        {schedule.times.map((time, index) => (
          <View key={`${time}-${index}`} style={styles.automationTimeRow}>
            <Pressable style={styles.timeAdjustButton} onPress={() => updateTime(index, shiftScheduleTime(time, -30))}>
              <Ionicons name="remove" size={17} color="#315f7d" />
            </Pressable>
            <Text style={styles.timeValue}>{time}</Text>
            <Pressable style={styles.timeAdjustButton} onPress={() => updateTime(index, shiftScheduleTime(time, 30))}>
              <Ionicons name="add" size={17} color="#315f7d" />
            </Pressable>
            <Pressable disabled={schedule.times.length <= 1} style={styles.timeRemoveButton} onPress={() => removeTime(index)}>
              <Ionicons name="trash-outline" size={16} color={schedule.times.length <= 1 ? "#cbd5e1" : "#dc2626"} />
            </Pressable>
          </View>
        ))}
        {schedule.times.length < 5 ? (
          <Pressable style={styles.addTimeButton} onPress={addTime}>
            <Ionicons name="add-circle-outline" size={17} color="#315f7d" />
            <Text style={styles.addTimeText}>{t("ui.add-time")}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.automationTargetRow}>
        <View>
          <Text style={styles.settingLabel}>{t("ui.suggestion-target")}</Text>
          <Text style={styles.settingValue}>{formatMB(schedule.targetMB)}</Text>
        </View>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepperButton}
            onPress={() => onUpdate((current) => ({ ...current, targetMB: Math.max(10, current.targetMB - 10) }))}
          >
            <Text style={styles.stepperText}>-</Text>
          </Pressable>
          <Pressable
            style={styles.stepperButton}
            onPress={() => onUpdate((current) => ({ ...current, targetMB: Math.min(1000, current.targetMB + 10) }))}
          >
            <Text style={styles.stepperText}>+</Text>
          </Pressable>
        </View>
      </View>

      {lastSuggestion ? (
        <Text style={styles.mutedSmall}>
          {t("ui.automation-last-suggestion", { date: `${lastSuggestion.toLocaleDateString()} ${lastSuggestion.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` })}
        </Text>
      ) : (
        <Text style={styles.mutedSmall}>{t("ui.no-completed-suggestion-yet")}</Text>
      )}

      <PrimaryButton label={busy ? t("ui.automation-scanning") : t("ui.run-now")} disabled={busy} onPress={() => onRunNow(schedule)} />
    </View>
  );
}

function purchaseName(productId: string): string {
  if (productId === LIFETIME_PRODUCT_ID) return t("ui.lifetime-pro-connected");
  if (productId === MONTHLY_PRODUCT_ID) return t("ui.monthly-pro-connected");
  if (productId === YEARLY_PRODUCT_ID) return t("ui.yearly-pro-connected");
  return t("ui.purchase-connected");
}

function SettingsScreen({
  settings,
  isPro,
  accountSignedIn,
  activeProductId,
  samplePhoto,
  onChange,
  onDailyReminderChange,
  onDailyReminderTimeChange,
  dailyReminderPermission,
  onChangeLanguage,
  onReload,
  onCreateReport,
  onRestorePurchases,
  onSignOut,
  onManagePurchases,
}: {
  settings: NativeSettings;
  isPro: boolean;
  accountSignedIn: boolean;
  activeProductId: string | null;
  samplePhoto?: NativePhoto;
  onChange: (patch: Partial<NativeSettings>) => void;
  onDailyReminderChange: (enabled: boolean) => Promise<void> | void;
  onDailyReminderTimeChange: (time: string) => Promise<void> | void;
  dailyReminderPermission: { granted: boolean; blocked: boolean };
  onChangeLanguage: (appLanguage: AppLanguage) => Promise<void>;
  onReload: () => Promise<void> | void;
  onCreateReport: (period: (typeof REPORT_PERIODS)[number]) => void;
  onRestorePurchases: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
  onManagePurchases: () => Promise<void> | void;
}) {
  const [reloading, setReloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [openingAdInspector, setOpeningAdInspector] = useState(false);
  const [adInspectorMessage, setAdInspectorMessage] = useState("");
  const [openingPrivacyOptions, setOpeningPrivacyOptions] = useState(false);
  const [privacyOptionsMessage, setPrivacyOptionsMessage] = useState("");
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [languageQuery, setLanguageQuery] = useState("");
  const [reminderTimePickerOpen, setReminderTimePickerOpen] = useState(false);
  const [reminderTimeDraft, setReminderTimeDraft] = useState(settings.dailyTrimReminder.time);
  const safeAreaInsets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const compactLayout = windowWidth <= 390;
  const showsThresholds =
    settings.targetMode === "big-or-old" ||
    settings.targetMode === "big-only" ||
    settings.targetMode === "old-only" ||
    settings.targetMode === "old-and-large";

  async function handleReload() {
    setReloading(true);
    try {
      await onReload();
    } finally {
      setReloading(false);
    }
  }

  async function handleRestorePurchases() {
    setRestoring(true);
    try {
      await onRestorePurchases();
    } finally {
      setRestoring(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  }

  async function handleOpenAdInspector() {
    setOpeningAdInspector(true);
    setAdInspectorMessage("");
    try {
      const opened = await openAdInspector();
      if (!opened) setAdInspectorMessage(t("ui.ad-inspector-is-unavailable-in-this-build"));
    } finally {
      setOpeningAdInspector(false);
    }
  }

  async function handleOpenPrivacyOptions() {
    setOpeningPrivacyOptions(true);
    setPrivacyOptionsMessage("");
    try {
      const opened = await openAdsPrivacyOptions();
      if (!opened) setPrivacyOptionsMessage(t("ui.privacy-choices-are-not-required-for-this-locati"));
    } finally {
      setOpeningPrivacyOptions(false);
    }
  }

  const purchaseStatus = !accountSignedIn
    ? t("ui.not-signed-in")
    : activeProductId
      ? purchaseName(activeProductId)
      : t("ui.connected-no-pro-purchase");
  const hasManageableSubscription =
    activeProductId === MONTHLY_PRODUCT_ID || activeProductId === YEARLY_PRODUCT_ID;
  const theme = getNativeTheme(settings.theme);
  const themed = useMemo(() => createSettingsThemeStyles(theme), [theme]);
  const selectedLanguage = APP_LANGUAGES.find(([code]) => code === settings.appLanguage) ?? APP_LANGUAGES[0];
  const visibleLanguages = APP_LANGUAGES.filter(([, nativeName, englishName]) => `${nativeName} ${englishName}`.toLowerCase().includes(languageQuery.trim().toLowerCase()));

  function openReminderTimePicker() {
    setReminderTimeDraft(settings.dailyTrimReminder.time);
    setReminderTimePickerOpen(true);
  }

  function closeReminderTimePicker(save = true) {
    setReminderTimePickerOpen(false);
    if (save && reminderTimeDraft !== settings.dailyTrimReminder.time) void onDailyReminderTimeChange(reminderTimeDraft);
  }

  function handleReminderTimeChange(event: DateTimePickerEvent, date?: Date) {
    if (event.type === "dismissed") {
      closeReminderTimePicker(false);
      return;
    }
    if (!date) return;
    const next = reminderPickerValue(date);
    setReminderTimeDraft(next);
    // Android presents this control as a native dialog; commit immediately
    // when the user confirms it. iOS keeps the spinner open until Done.
    if (Platform.OS !== "ios") {
      setReminderTimePickerOpen(false);
      void onDailyReminderTimeChange(next);
    }
  }

  return (
    <ScrollView style={themed.screen} contentContainerStyle={styles.content}>
      <View style={[styles.settingsHero, themed.hero]}>
        <Text style={[styles.settingsEyebrow, themed.heroEyebrow]}>{t("ui.settings")}</Text>
        <Text style={[styles.settingsHeroTitle, themed.heroTitle]}>{t("ui.your-space-your-pace")}</Text>
        <Text style={[styles.settingsHeroCopy, themed.heroCopy]}>{t("ui.manage-purchase-access-then-tune-how-trimswipe-f")}</Text>
      </View>
      <View style={[styles.settingCardVertical, themed.card]}>
        <Text style={[styles.settingLabel, themed.label]}>{t("ui.language")}</Text>
        <Text style={[styles.mutedSmall, themed.muted]}>{t("ui.choose-the-language-used-throughout-trimswipe")}</Text>
        <Pressable accessibilityRole="button" onPress={() => setLanguagePickerOpen(true)} style={[styles.languagePickerButton, { borderColor: theme.border, backgroundColor: theme.cardSoft }]}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            style={[styles.languagePickerText, compactLayout && styles.languagePickerTextCompact, { color: theme.text }]}
          >{selectedLanguage[1]}{" · "}{selectedLanguage[2]}</Text>
          <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
        </Pressable>
      </View>
      <Modal visible={languagePickerOpen} animationType="slide" onRequestClose={() => setLanguagePickerOpen(false)}>
        <SafeAreaView style={[styles.languageModal, { backgroundColor: theme.background }]}>
          <View style={styles.languageModalHeader}><Text style={[styles.settingLabel, { color: theme.text }]}>{t("ui.choose-language")}</Text><Pressable onPress={() => setLanguagePickerOpen(false)}><Text style={{ color: theme.primary, fontWeight: "800" }}>{t("ui.done")}</Text></Pressable></View>
          <TextInput value={languageQuery} onChangeText={setLanguageQuery} placeholder={t("ui.search-languages")} placeholderTextColor={theme.textMuted} style={[styles.languageSearch, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]} />
          <ScrollView contentContainerStyle={styles.languageList} keyboardShouldPersistTaps="handled">
            {visibleLanguages.map(([code, nativeName, englishName]) => (
              <Pressable
                key={code}
                onPress={() => {
                  setLanguagePickerOpen(false);
                  setLanguageQuery("");
                  void onChangeLanguage(code);
                }}
                style={[styles.languageRow, compactLayout && styles.languageRowCompact, { borderBottomColor: theme.border }]}
              >
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={[styles.languageNative, compactLayout && styles.languageNativeCompact, { color: theme.text }]}>{nativeName}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={[styles.languageEnglish, compactLayout && styles.languageEnglishCompact, { color: theme.textMuted }]}>{englishName}</Text>
                {code === settings.appLanguage ? <Ionicons name="checkmark" size={20} color={theme.primary} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <View style={[styles.settingCardVertical, themed.card]}>
        <Text style={[styles.settingLabel, themed.label]}>{t("ui.color-theme")}</Text>
        <Text style={[styles.mutedSmall, themed.muted]}>{t("ui.choose-a-pastel-palette-for-your-space")}</Text>
        <View style={styles.themeOptionRow}>
          {NATIVE_THEME_OPTIONS.map((option) => {
            const optionTheme = getNativeTheme(option.id);
            const selected = settings.theme === option.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.id}
                onPress={() => onChange({ theme: option.id })}
                style={[styles.themeOption, { borderColor: selected ? theme.primaryBright : theme.border }, selected && { backgroundColor: theme.cardSoft }]}
              >
                <View style={[styles.themeSwatch, { backgroundColor: optionTheme.background, borderColor: optionTheme.border }]}>
                  <View style={[styles.themeSwatchAccent, { backgroundColor: optionTheme.primaryBright }]} />
                </View>
                <Text style={[styles.themeOptionText, { color: theme.text }, selected && { color: theme.primary, fontWeight: "900" }]}>{t(`ui.theme-${option.id}`)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={[styles.settingCardVertical, themed.card]}>
        <Text style={[styles.settingLabel, themed.label]}>{t("ui.daily-trim-reminder-setting", { time: formatReminderTime(settings.dailyTrimReminder.time) })}</Text>
        <Text style={[styles.mutedSmall, themed.muted]}>{t("ui.daily-trim-reminder-at", { time: formatReminderTime(settings.dailyTrimReminder.time) })}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={openReminderTimePicker}
          style={[styles.reminderTimeButton, { borderColor: theme.border, backgroundColor: theme.cardSoft }]}
        >
          <Ionicons name="time-outline" size={18} color={theme.primary} />
          <Text style={[styles.reminderTimeText, { color: theme.text }]}>{formatReminderTime(settings.dailyTrimReminder.time)}</Text>
          <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
        </Pressable>
        <ReminderToggle
          label={t("ui.enable-daily-trim-reminder")}
          value={settings.dailyTrimReminder.enabled}
          theme={theme}
          onChange={(enabled) => void onDailyReminderChange(enabled)}
        />
        {settings.dailyTrimReminder.enabled && dailyReminderPermission.blocked ? (
          <>
            <Text style={[styles.mutedSmall, { color: theme.danger }]}>{t("ui.daily-trim-reminder-system-blocked")}</Text>
            <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={styles.settingsLinkButton}>
              <Text style={[styles.settingsLinkText, { color: theme.primary }]}>{t("ui.open-settings")}</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      <Modal visible={reminderTimePickerOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => closeReminderTimePicker(false)}>
        <SafeAreaView
          edges={["left", "right", "bottom"]}
          style={[styles.languageModal, { backgroundColor: theme.background, paddingTop: Math.max(safeAreaInsets.top, 20) }]}
        >
          <View style={styles.reminderModalHeader}>
            <Text numberOfLines={2} style={[styles.settingLabel, styles.reminderModalTitle, { color: theme.text }]}>{t("ui.daily-trim-reminder-setting", { time: formatReminderTime(reminderTimeDraft) })}</Text>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => closeReminderTimePicker(true)} style={styles.reminderDoneButton}><Text style={{ color: theme.primary, fontWeight: "800" }}>{t("ui.done")}</Text></Pressable>
          </View>
          <View style={styles.reminderPickerBody}>
            <DateTimePicker
              value={reminderPickerDate(reminderTimeDraft)}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              minuteInterval={30}
              onChange={handleReminderTimeChange}
              themeVariant={theme.background === colors.background ? "light" : "dark"}
              style={styles.nativeTimePicker}
            />
            <Text style={[styles.mutedSmall, { color: theme.textMuted }]}>{t("ui.daily-trim-reminder-at", { time: formatReminderTime(reminderTimeDraft) })}</Text>
          </View>
        </SafeAreaView>
      </Modal>
      <View style={[styles.settingCardVertical, themed.card]}>
        <Text style={[styles.settingLabel, themed.label]}>{t("ui.smart-reminders")}</Text>
        <Text style={[styles.mutedSmall, themed.muted]}>{t("ui.helpful-nudges-only-when-trimswipe-already-knows")}</Text>
        <ReminderToggle label={t("ui.allow-smart-reminders")} value={settings.smartReminders.enabled} theme={theme} onChange={(enabled) => onChange({ smartReminders: { ...settings.smartReminders, enabled } })} />
        {settings.smartReminders.enabled ? (
          <>
            <ReminderToggle label={t("ui.protect-my-streak")} value={settings.smartReminders.streak} theme={theme} onChange={(streak) => onChange({ smartReminders: { ...settings.smartReminders, streak } })} />
            <ReminderToggle label={t("ui.low-storage")} value={settings.smartReminders.storage} theme={theme} onChange={(storage) => onChange({ smartReminders: { ...settings.smartReminders, storage } })} />
            <ReminderToggle label={t("ui.new-photos")} value={settings.smartReminders.newPhotos} theme={theme} onChange={(newPhotos) => onChange({ smartReminders: { ...settings.smartReminders, newPhotos } })} />
            <ReminderToggle label={t("ui.cleanup-opportunities")} value={settings.smartReminders.cleanup} theme={theme} onChange={(cleanup) => onChange({ smartReminders: { ...settings.smartReminders, cleanup } })} />
            <ReminderToggle label={t("ui.weekly-progress")} value={settings.smartReminders.weekly} theme={theme} onChange={(weekly) => onChange({ smartReminders: { ...settings.smartReminders, weekly } })} />
          </>
        ) : null}
      </View>
      <View style={[styles.accountCard, themed.card]}>
        <View style={styles.accountHeader}>
          <View style={[styles.accountIcon, { backgroundColor: accountSignedIn ? theme.primarySoft : theme.cardSoft }]}>
            <Ionicons
              name={accountSignedIn ? "person-circle-outline" : "person-outline"}
              size={24}
              color={accountSignedIn ? colors.primary : colors.textMuted}
            />
          </View>
          <View style={styles.accountCopy}>
            <Text style={[styles.settingLabel, themed.label]}>{t("ui.account-purchases")}</Text>
            <Text style={[styles.accountStatus, themed.text]}>{purchaseStatus}</Text>
          </View>
          <View style={[styles.accountStatusDot, { backgroundColor: accountSignedIn ? theme.sage : theme.textSubtle }]} />
        </View>
        <Text style={[styles.mutedSmall, themed.muted]}>
          {accountSignedIn
            ? t("ui.purchases-are-connected-to-the-apple-account-cur")
            : t("ui.free-mode-is-active-ads-and-free-limits-apply-un")}
        </Text>
        {accountSignedIn ? (
          <View style={styles.accountActions}>
            {hasManageableSubscription ? (
              <Pressable style={[styles.accountSecondaryButton, styles.accountManageButton, themed.secondaryButton]} onPress={() => void onManagePurchases()}>
                <Ionicons name="card-outline" size={17} color={colors.primary} />
                <Text style={[styles.accountSecondaryText, { color: theme.primary }]}>{t("ui.manage-subscription")}</Text>
              </Pressable>
            ) : null}
            <Pressable
              disabled={restoring}
              style={[styles.accountSecondaryButton, themed.secondaryButton]}
              onPress={() => void handleRestorePurchases()}
            >
              {restoring ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="refresh-outline" size={17} color={colors.primary} />
              )}
              <Text style={[styles.accountSecondaryText, { color: theme.primary }]}>{t("ui.restore")}</Text>
            </Pressable>
            <Pressable
              disabled={signingOut}
              style={[styles.accountSignOutButton, themed.signOutButton]}
              onPress={() => void handleSignOut()}
            >
              <Text style={[styles.accountSignOutText, { color: theme.danger }]}>{signingOut ? t("ui.signing-out") : t("ui.sign-out")}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            disabled={restoring}
            onPress={() => void handleRestorePurchases()}
            style={[styles.accountSignInButton, { backgroundColor: theme.primary }]}
          >
            {restoring ? <ActivityIndicator color={colors.white} /> : <Ionicons name="logo-apple" size={18} color={colors.white} />}
            <Text style={styles.accountSignInText}>{restoring ? t("ui.connecting") : t("ui.sign-in-restore-purchases")}</Text>
          </Pressable>
        )}
      </View>
      {isPro ? (
        <View style={styles.settingCardVertical}>
          <View style={styles.dashboardHeroTop}>
            <View style={styles.scanQuickCopy}>
              <Text style={styles.settingLabel}>{t("ui.progress-reports")}</Text>
              <Text style={styles.mutedSmall}>{t("ui.create-before-after-weekly-or-monthly-summaries")}</Text>
            </View>
            <View style={styles.reportIcon}>
              <Ionicons name="document-text-outline" size={22} color="#315f7d" />
            </View>
          </View>
          <View style={styles.reportButtonRow}>
            <Pressable style={styles.reportButton} onPress={() => onCreateReport("weekly")}>
              <Ionicons name="document-text-outline" size={18} color="#315f7d" />
              <Text style={styles.reportButtonText}>{t("ui.weekly")}</Text>
            </Pressable>
            <Pressable style={styles.reportButton} onPress={() => onCreateReport("monthly")}>
              <Ionicons name="document-text-outline" size={18} color="#315f7d" />
              <Text style={styles.reportButtonText}>{t("ui.monthly")}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {!isPro ? (
        <View style={[styles.settingCardVertical, themed.card]}>
          <Text style={[styles.settingLabel, themed.label]}>{t("ui.advertising-privacy")}</Text>
          <Text style={[styles.mutedSmall, themed.muted]}>
            {t("ui.advertising-privacy-copy")}
          </Text>
          <Pressable
            disabled={openingPrivacyOptions}
            style={[styles.accountSecondaryButton, themed.secondaryButton]}
            onPress={() => void handleOpenPrivacyOptions()}
          >
            {openingPrivacyOptions ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="shield-checkmark-outline" size={17} color={colors.primary} />
            )}
            <Text style={[styles.accountSecondaryText, { color: theme.primary }]}>{t("ui.privacy-choices")}</Text>
          </Pressable>
          {privacyOptionsMessage ? <Text style={[styles.mutedSmall, themed.muted]}>{privacyOptionsMessage}</Text> : null}
        </View>
      ) : null}
      {(__DEV__ || process.env.EXPO_PUBLIC_ADMOB_ENABLE_INSPECTOR === "true") ? (
        <View style={[styles.settingCardVertical, themed.card]}>
          <Text style={[styles.settingLabel, themed.label]}>{t("ui.ad-mediation-diagnostics")}</Text>
          <Text style={[styles.mutedSmall, themed.muted]}>
            {t("ui.ad-mediation-copy")}
          </Text>
          <Pressable
            disabled={openingAdInspector}
            style={[styles.accountSecondaryButton, themed.secondaryButton]}
            onPress={() => void handleOpenAdInspector()}
          >
            {openingAdInspector ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="analytics-outline" size={17} color={colors.primary} />
            )}
            <Text style={[styles.accountSecondaryText, { color: theme.primary }]}>{t("ui.open-ad-inspector")}</Text>
          </Pressable>
          {adInspectorMessage ? <Text style={[styles.mutedSmall, themed.muted]}>{adInspectorMessage}</Text> : null}
        </View>
      ) : null}
      <SettingStepper label={t("ui.cards-per-round")} value={settings.cardsPerRound} suffix="cards" min={5} max={30} step={1} onChange={(cardsPerRound) => onChange({ cardsPerRound })} />
      <Segmented label={t("ui.session-mode")} value={settings.sessionMode} options={[["classic", t("ui.session-classic")], ["endless", t("ui.session-endless")], ["time-attack", t("ui.session-time")]]} onChange={(sessionMode) => onChange({ sessionMode })} />
      <Segmented
        label={t("ui.photo-pool")}
        value={settings.trimReviewMode}
        options={[["normal", t("ui.pool-untrimmed")], ["trimmed-only", t("ui.trimmed-only")], ["all", t("ui.all-photos")]]}
        onChange={(trimReviewMode) => onChange({ trimReviewMode })}
      />
      <Segmented
        label={t("ui.previously-reviewed")}
        value={settings.includePreviouslyReviewed ? "include" : "hide"}
        options={[["hide", t("ui.hide-by-default")], ["include", t("ui.include")]]}
        onChange={(value) => onChange({ includePreviouslyReviewed: value === "include" })}
      />
      <SettingStepper label={t("ui.daily-goal")} value={settings.dailyGoalMB} suffix="MB" min={5} max={500} step={5} onChange={(dailyGoalMB) => onChange({ dailyGoalMB })} />
      <FocusDropdown value={settings.targetMode} onChange={(targetMode) => onChange({ targetMode })} />
      {showsThresholds ? (
        <>
          <SettingStepper label={t("ui.large-threshold")} value={settings.minSizeMB} suffix="MB" min={0.5} max={MAX_PHOTO_SIZE_THRESHOLD_MB} step={0.5} onChange={(minSizeMB) => onChange({ minSizeMB })} />
          <SettingStepper label={t("ui.old-threshold")} value={settings.minAgeYears} suffix="years" min={0} max={MAX_PHOTO_AGE_THRESHOLD_YEARS} step={1 / 12} onChange={(minAgeYears) => onChange({ minAgeYears })} />
        </>
      ) : null}
      <SettingStepper
        label={t("ui.trim-quality")}
        value={Math.round(settings.trimQuality * 100)}
        suffix="%"
        min={isPro ? 50 : 65}
        max={98}
        step={1}
        onChange={(quality) => onChange({ trimQuality: Math.max(isPro ? 50 : 65, quality) / 100 })}
      />
      <Segmented
        label={t("ui.trim-output")}
        value={settings.trimOutputMode}
        options={[["replace", t("ui.replace-originals")], ["save-new", t("ui.save-as-new")]]}
        onChange={(trimOutputMode) => onChange({ trimOutputMode })}
      />
      <TrimKindSettings settings={settings} isPro={isPro} onChange={onChange} />
      <EnhancedQualityPreview photo={samplePhoto} currentQuality={settings.trimQuality} />
      <View style={styles.settingsReloadWrap}>
        <PrimaryButton label={reloading ? t("ui.reloading-photos") : t("ui.reload-with-these-settings")} disabled={reloading} onPress={() => void handleReload()} />
      </View>
    </ScrollView>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function BottomNav({ screen, isPro, theme, onChange }: { screen: Screen; isPro: boolean; theme: NativeThemePalette; onChange: (screen: Screen) => void }) {
  const { width: windowWidth } = useWindowDimensions();
  const compact = windowWidth <= 390;
  const gamesActive = screen === "games" || screen === "swipe" || screen === "this-or-that" || screen === "storage-budget" || screen === "memory-lane";
  return (
    <View style={[styles.bottomNav, { backgroundColor: theme.card, borderColor: theme.border, shadowColor: theme.ink }]}>
      <NavButton compact={compact} label={t("ui.home")} active={screen === "home"} theme={theme} onPress={() => onChange("home")} />
      <NavButton compact={compact} label={t("ui.games")} active={gamesActive} theme={theme} onPress={() => onChange("games")} />
      {isPro ? (
        <NavButton compact={compact} label={t("ui.auto")} active={screen === "automation"} theme={theme} onPress={() => onChange("automation")} />
      ) : (
        <NavButton compact={compact} label={t("ui.shop")} active={screen === "shop"} theme={theme} onPress={() => onChange("shop")} />
      )}
      <NavButton compact={compact} label={t("ui.stats")} active={screen === "stats"} theme={theme} onPress={() => onChange("stats")} />
      <NavButton compact={compact} label={t("ui.settings")} active={screen === "settings"} theme={theme} onPress={() => onChange("settings")} />
    </View>
  );
}

function ReminderToggle({ label, value, theme, onChange }: { label: string; value: boolean; theme: NativeThemePalette; onChange: (value: boolean) => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={styles.reminderToggleRow}>
      <Text style={[styles.settingLabel, { color: theme.text }]}>{label}</Text>
      <View style={[styles.reminderToggle, { backgroundColor: value ? theme.primary : theme.cardSoft }]}><View style={[styles.reminderToggleKnob, { backgroundColor: value ? "#fff" : theme.textSubtle, transform: [{ translateX: value ? 18 : 2 }] }]} /></View>
    </Pressable>
  );
}


function NavButton({ label, active, compact, theme, onPress }: { label: string; active: boolean; compact: boolean; theme: NativeThemePalette; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.navButton, active && styles.navButtonActive, active && { backgroundColor: theme.primary }]}
    >
      <Text
        adjustsFontSizeToFit
        ellipsizeMode="clip"
        maxFontSizeMultiplier={1.15}
        minimumFontScale={compact ? 0.7 : 0.78}
        numberOfLines={1}
        style={[
          styles.navText,
          compact && styles.navTextCompact,
          { color: theme.primary },
          active && styles.navTextActive,
          active && { color: theme.white },
        ]}
      >
        {label}
      </Text>
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
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        danger && styles.dangerButton,
        pressed && !disabled && styles.primaryButtonPressed,
        disabled && styles.primaryButtonDisabled,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.secondaryButton, disabled && styles.secondaryButtonDisabled]}>
      <Text style={[styles.secondaryButtonText, disabled && styles.secondaryButtonTextDisabled]}>{label}</Text>
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
  const localizedSuffix = suffix === "cards" ? t("ui.unit-cards") : suffix === "years" ? t("ui.unit-year") : suffix;
  const displayValue =
    suffix === "years" && value < 1
      ? `${Math.max(1, Math.round(value * 12))} ${t("ui.unit-month")}`
      : `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} ${localizedSuffix}`;
  return (
    <View style={styles.settingCard}>
      <View>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingValue}>{displayValue}</Text>
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

function createSettingsThemeStyles(theme: NativeThemePalette) {
  return StyleSheet.create({
    screen: { backgroundColor: theme.background },
    hero: { backgroundColor: theme.primary, borderColor: theme.primary },
    heroEyebrow: { color: theme.primaryGlow },
    heroTitle: { color: theme.white },
    heroCopy: { color: theme.primaryGlow },
    card: { backgroundColor: theme.card, borderColor: theme.border, shadowColor: theme.ink },
    label: { color: theme.primary },
    text: { color: theme.text },
    muted: { color: theme.textMuted },
    secondaryButton: { backgroundColor: theme.cardSoft, borderColor: theme.border },
    signOutButton: { backgroundColor: theme.dangerSoft, borderColor: theme.danger },
  });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  shell: { flex: 1, backgroundColor: colors.background },
  shellHighContrast: { backgroundColor: "#fffbeb" },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 110 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  recapContent: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 142 },
  heroTitle: { color: colors.text, fontSize: 28, fontWeight: "800", letterSpacing: -0.45 },
  muted: { color: colors.textMuted, fontSize: 14 },
  mutedSmall: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  settingsLinkButton: { alignSelf: "flex-start", paddingVertical: 2 },
  settingsLinkText: { fontSize: 12, fontWeight: "800" },
  centerText: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  insightText: { color: colors.primary, fontSize: 14, fontWeight: "800", lineHeight: 20, textAlign: "center" },
  eyebrow: { color: colors.primaryBright, fontSize: 11, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" },
  warning: { marginTop: 12, borderRadius: 14, backgroundColor: "#f3f6f8", color: "#274b61", padding: 12, fontSize: 12 },
  toastWrap: { position: "absolute", top: 58, left: 18, right: 18, zIndex: 1000 },
  toast: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#cbd8e0", padding: 14, shadowColor: "#1f2937", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  toastSuccess: { borderColor: "#86efac", backgroundColor: "#f0fdf4" },
  toastWarning: { borderColor: "#a7bdca", backgroundColor: "#f3f6f8" },
  toastError: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  toastTitle: { color: "#1f2937", fontSize: 13, fontWeight: "700" },
  toastDetail: { marginTop: 2, color: "#64748b", fontSize: 12, lineHeight: 16, fontWeight: "600" },
  backgroundTrimStatus: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 92,
    zIndex: 900,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    backgroundColor: "#203345",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#1f2937",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  backgroundTrimFinished: { backgroundColor: "#2f7d68" },
  backgroundTrimPressed: { opacity: 0.86 },
  backgroundTrimCopy: { flex: 1 },
  backgroundTrimTitle: { color: "#ffffff", fontSize: 13, fontWeight: "900" },
  backgroundTrimDetail: { marginTop: 2, color: "#dbe7ee", fontSize: 11, fontWeight: "700" },
  trimSetChoices: { flexDirection: "row", gap: 10 },
  trimSetChoice: { flex: 1, alignItems: "center", borderRadius: 16, borderWidth: 1, borderColor: "#b8c9d3", backgroundColor: "#f3f6f8", paddingVertical: 14 },
  trimSetChoiceValue: { color: "#203345", fontSize: 20, fontWeight: "900" },
  trimSetChoiceLabel: { marginTop: 2, color: "#64748b", fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  trimResultIcon: { backgroundColor: "#2f7d68", borderColor: "#2f7d68" },
  trimBeforeAfter: { flexDirection: "row", alignItems: "center", gap: 10 },
  trimResultMetric: { flex: 1, borderRadius: 16, backgroundColor: "#f3f6f8", padding: 14 },
  trimResultLabel: { color: "#64748b", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
  trimResultValue: { marginTop: 5, color: "#203345", fontSize: 18, fontWeight: "900" },
  trimSavedCard: { alignItems: "center", borderRadius: 18, backgroundColor: "#edf5ef", padding: 16 },
  trimSavedLabel: { color: "#547567", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  trimSavedValue: { marginTop: 4, color: "#2f7d68", fontSize: 28, fontWeight: "900" },
  trimFailedText: { marginTop: 6, color: "#9a5b38", fontSize: 11, fontWeight: "700" },
  confirmBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "rgba(31, 41, 55, 0.34)" },
  confirmSheet: { width: "100%", maxWidth: 420, borderRadius: 26, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#cbd8e0", padding: 20, gap: 12, shadowColor: "#1f2937", shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 16 }, elevation: 8 },
  confirmIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#e5ebef", borderWidth: 1, borderColor: "#cbd8e0" },
  confirmTitle: { color: "#111827", fontSize: 21, fontWeight: "700" },
  confirmDetail: { color: "#64748b", fontSize: 13, lineHeight: 19, fontWeight: "700" },
  confirmActions: { marginTop: 4, gap: 10 },

  // Swipe
  swipeHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14, borderRadius: 22, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 16 },
  swipeHeaderCopy: { flex: 1 },
  swipeTitle: { marginTop: 5, color: "#1f2937", fontSize: 18, fontWeight: "700" },
  swipeTitleLarge: { fontSize: 22 },
  swipeSubtitle: { marginTop: 5, color: "#64748b", fontSize: 12, lineHeight: 17 },
  swipeStatusColumn: { alignItems: "flex-end", gap: 8 },
  queuePill: { overflow: "hidden", borderRadius: 999, backgroundColor: "#e5ebef", color: "#315f7d", paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: "700" },
  timerPill: { overflow: "hidden", borderRadius: 999, backgroundColor: "#f4efe3", color: "#806226", paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: "700" },
  trimBadge: { overflow: "hidden", borderRadius: 999, backgroundColor: "#f3f6f8", color: "#315f7d", paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: "700" },
  deck: { marginTop: 18, height: 492 },
  animatedCard: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  photoCard: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden", borderRadius: 24, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0" },
  swipeTint: { ...StyleSheet.absoluteFillObject, borderRadius: 24 },
  keepTint: { backgroundColor: "rgba(34, 197, 94, 0.48)" },
  deleteTint: { backgroundColor: "rgba(239, 68, 68, 0.48)" },
  stackedCard: { transform: [{ scale: 0.96 }], opacity: 0.58 },
  photoImage: { width: "100%", height: "100%" },
  photoShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(31, 41, 55, 0.12)" },
  photoTop: { position: "absolute", top: 14, left: 14, right: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(15, 23, 42, 0.72)", color: "#f8fafc", paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: "800" },
  pillSaving: { color: "#86efac", fontWeight: "700" },
  trimmedLabel: { overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(34, 197, 94, 0.92)", color: "#ffffff", paddingHorizontal: 9, paddingVertical: 6, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  photoBottom: { position: "absolute", left: 18, right: 18, bottom: 18 },
  photoTitle: { color: "#f8fafc", fontSize: 25, fontWeight: "700" },
  photoMeta: { marginTop: 4, color: "#cbd5e1", fontSize: 13, fontWeight: "600" },
  reasonRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reason: { overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(248, 250, 252, 0.18)", color: "#f8fafc", paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  reasonTrimmed: { overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(79, 120, 146, 0.9)", color: "#f3f6f8", paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  actions: { marginTop: 20, flexDirection: "row", gap: 10 },
  actionButton: { flex: 1, minHeight: 76, alignItems: "center", justifyContent: "center", borderRadius: 17, paddingVertical: 15, paddingHorizontal: 8, borderWidth: 1 },
  actionButtonLarge: { paddingVertical: 19 },
  actionButtonDisabled: { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1", opacity: 0.75 },
  actionKeep: { backgroundColor: "#dcfce7", borderColor: "#22c55e" },
  actionTrim: { backgroundColor: "#e5ebef", borderColor: "#4f7892" },
  actionDelete: { backgroundColor: "#fee2e2", borderColor: "#ef4444" },
  actionText: { color: "#1f2937", fontSize: 14, lineHeight: 17, fontWeight: "700", textAlign: "center" },
  actionTextLarge: { fontSize: 17 },
  actionTextDisabled: { color: "#94a3b8" },

  // FIX 2: Delete review list - proper bottom padding so buttons aren't hidden
  reviewScreen: { flex: 1 },
  reviewList: { marginTop: 18, marginBottom: 12, flex: 1 },
  reviewListContent: { paddingBottom: 16 },
  reviewActionFooter: { gap: 10 },
  applyProgressCard: {
    borderRadius: 18,
    backgroundColor: "#f3f6f8",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#cbd8e0",
    padding: 13,
    gap: 10,
  },
  applyProgressHeader: { gap: 2 },
  applyProgressTitle: { color: "#1f2937", fontSize: 13, fontWeight: "700" },
  applyProgressDetail: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  applyProgressTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#e5ebef",
  },
  applyProgressFill: {
    width: "68%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#315f7d",
  },
  reviewRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, backgroundColor: "#ffffff", padding: 10, marginBottom: 8 },
  reviewThumb: { width: 58, height: 58, borderRadius: 14 },
  reviewMoveButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0" },
  reviewMoveButtonDisabled: { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" },
  checkbox: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: "#d1d5db",
    alignItems: "center", justifyContent: "center", backgroundColor: "#fff",
  },
  checkboxOn: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  checkboxMark: { color: "#fff", fontWeight: "700", fontSize: 14 },
  reviewCopy: { flex: 1 },
  reviewTitle: { color: "#1f2937", fontSize: 14, fontWeight: "800" },
  reviewTrimmedLabel: { alignSelf: "flex-start", marginTop: 3, marginBottom: 3, overflow: "hidden", borderRadius: 999, backgroundColor: "#dcfce7", color: "#15803d", paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  actionLogRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 12 },
  actionLogRowCompact: { padding: 8, marginBottom: 4, borderRadius: 14 },
  compactActionList: { gap: 4 },
  actionLogDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: "#4f7892" },
  emptyPanel: { borderRadius: 20, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 18, gap: 10 },
  statGrid: { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 10 },
  miniStat: { minWidth: "30%", flexGrow: 1, borderRadius: 18, backgroundColor: "#ffffff", padding: 16 },
  miniStatValue: { color: "#1f2937", fontSize: 24, fontWeight: "700" },
  recapTop: { alignItems: "center", gap: 12 },
  recapBadgeWrap: { width: 118, height: 96, alignItems: "center", justifyContent: "center" },
  recapBadge: { width: 74, height: 74, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "#22c55e", borderWidth: 2, borderColor: "#86efac", shadowColor: "#22c55e", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 5 },
  recapBadgeIcon: { color: "#ffffff", fontSize: 38, fontWeight: "700" },
  recapImpactCard: { width: "100%", overflow: "hidden", position: "relative", borderRadius: 22, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#bbf7d0", padding: 16, gap: 12, shadowColor: "#22c55e", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 3 },
  recapImpactShine: { position: "absolute", top: -28, bottom: -28, left: 0, width: 72, backgroundColor: "rgba(255,255,255,0.62)" },
  recapImpactHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  recapCleanBadge: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#dcfce7", borderWidth: 1, borderColor: "#86efac" },
  recapImpactValue: { color: "#315f7d", fontSize: 34, fontWeight: "700" },
  recapSuccessStrip: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, backgroundColor: "#f0fdf4", borderWidth: StyleSheet.hairlineWidth, borderColor: "#bbf7d0", paddingHorizontal: 12, paddingVertical: 10 },
  recapSuccessText: { color: "#15803d", fontSize: 12, fontWeight: "700" },

  // Stats redesign
  statsContent: { gap: 14, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 120 },
  statsHero: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", borderRadius: 24, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 18, gap: 12 },
  statsHeroLeft: { flex: 1, gap: 6 },
  statsHeroTitle: { color: "#1f2937", fontSize: 24, fontWeight: "700" },
  statsHeroCopy: { color: "#64748b", fontSize: 12, lineHeight: 18 },
  levelRowInline: { marginTop: 4 },
  levelLabel: { color: "#315f7d", fontSize: 12, fontWeight: "800" },
  levelBarTrack: { height: 6, borderRadius: 999, backgroundColor: "#e5ebef", marginTop: 4 },
  levelBarFill: { height: "100%", borderRadius: 999, backgroundColor: "#315f7d" },
  statsActionStrip: { flexDirection: "row", gap: 10 },
  statsActionBtn: { flex: 1, alignItems: "center", borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", paddingVertical: 14, gap: 4 },
  statsActionIcon: { color: "#315f7d", fontSize: 18, fontWeight: "700" },
  statsActionLabel: { color: "#1f2937", fontSize: 12, fontWeight: "800" },
  impactSummaryRow: { flexDirection: "row", gap: 8 },
  impactPill: { flex: 1, alignItems: "center", borderRadius: 18, backgroundColor: "#ffffff", borderWidth: 1, paddingVertical: 12, paddingHorizontal: 4 },
  impactPillValue: { fontSize: 16, fontWeight: "700" },
  impactPillLabel: { color: "#64748b", fontSize: 10, fontWeight: "700", marginTop: 2 },
  streakRow: { flexDirection: "row", borderRadius: 20, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", overflow: "hidden" },
  streakHalf: { flex: 1, alignItems: "center", padding: 16, gap: 4 },
  streakBigNum: { color: "#315f7d", fontSize: 40, fontWeight: "700", lineHeight: 44 },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 6 },
  sectionBadge: { color: "#315f7d", fontSize: 12, fontWeight: "700" },

  // Common section / dashboard
  dashboardContent: { gap: 14 },
  dashboardHero: { borderRadius: 24, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 18, gap: 16 },
  dashboardHeroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  dashboardCopy: { color: "#475569", fontSize: 14, lineHeight: 21 },
  healthScore: { minWidth: 74, alignItems: "center", borderRadius: 20, backgroundColor: "#e5ebef", paddingVertical: 10, paddingHorizontal: 12 },
  healthValue: { color: "#315f7d", fontSize: 27, fontWeight: "700" },
  healthLabel: { color: "#ea580c", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickAction: { flex: 1, minWidth: "30%", borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 14, gap: 5 },
  quickActionLabel: { color: "#1f2937", fontSize: 14, fontWeight: "700" },
  quickActionDetail: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  sectionTitleRow: { marginTop: 5, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  sectionTitle: { color: "#1f2937", fontSize: 18, fontWeight: "700" },
  sectionDetail: { color: "#315f7d", fontSize: 12, fontWeight: "700" },
  progressTrack: { height: 8, overflow: "hidden", borderRadius: 999, backgroundColor: "#e5ebef" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: "#315f7d" },
  progressTrim: { backgroundColor: "#4f7892" },
  progressDelete: { backgroundColor: "#f87171" },
  challengeCard: { borderRadius: 20, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 16, gap: 11 },
  streakCard: { flexDirection: "row", alignItems: "center", borderRadius: 20, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 16, gap: 14 },
  streakValue: { color: "#315f7d", fontSize: 44, fontWeight: "700", lineHeight: 48 },
  streakDivider: { alignSelf: "stretch", width: StyleSheet.hairlineWidth, backgroundColor: "#cbd8e0" },
  streakCopy: { flex: 1, gap: 5 },
  challengeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  challengeTitle: { flex: 1, color: "#1f2937", fontSize: 14, fontWeight: "700" },
  challengeValue: { color: "#ea580c", fontSize: 16, fontWeight: "700" },
  impactPanel: { borderRadius: 20, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 16, gap: 15 },
  impactHeader: { gap: 3 },
  impactValue: { color: "#1f2937", fontSize: 30, fontWeight: "700" },
  impactRow: { gap: 8 },
  impactLabelRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  impactLabel: { color: "#475569", fontSize: 13, fontWeight: "800" },
  impactAmount: { color: "#1f2937", fontSize: 13, fontWeight: "700" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { minWidth: "47%", flexGrow: 1, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 15 },
  metricValue: { color: "#1f2937", fontSize: 23, fontWeight: "700" },
  activityPanel: { height: 148, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8, borderRadius: 20, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 14 },
  activityDay: { flex: 1, alignItems: "center", gap: 7 },
  activityBarTrack: { width: "100%", height: 78, justifyContent: "flex-end", overflow: "hidden", borderRadius: 999, backgroundColor: "#e5ebef" },
  activityBar: { width: "100%", borderRadius: 999, backgroundColor: "#4f7892" },
  activityLabel: { color: "#64748b", fontSize: 10, fontWeight: "800" },
  activityValue: { color: "#1f2937", fontSize: 11, fontWeight: "700" },
  achievementGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  achievementCard: { minWidth: "47%", flexGrow: 1, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 14, gap: 9 },
  achievementUnlocked: { backgroundColor: "#ecfdf5", borderColor: "#86efac" },
  achievementStatus: { alignSelf: "flex-start", borderRadius: 999, backgroundColor: "#e5ebef", paddingHorizontal: 8, paddingVertical: 4 },
  achievementStatusText: { color: "#315f7d", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  achievementTitle: { color: "#1f2937", fontSize: 14, fontWeight: "700" },

  // Games
  gamesHero: { borderRadius: 24, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 18, gap: 8 },
  gamesVisualHero: { overflow: "hidden", borderRadius: 26, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 18, gap: 14, shadowColor: colors.ink, shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  gamesHeroCopy: { flex: 1, gap: 4 },
  gameTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  heroPhotoStrip: { height: 118, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  heroPhoto: { width: "31%", height: 104, borderRadius: 18, backgroundColor: "#e5ebef", borderWidth: 3, borderColor: "#ffffff" },
  heroPhotoRaised: { height: 118, transform: [{ translateY: -4 }] },
  heroPhotoFallback: { flex: 1, height: 112, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#4f7892" },
  focusPanel: { borderRadius: 24, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 16, gap: 14 },
  focusHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  focusTitle: { color: "#1f2937", fontSize: 18, fontWeight: "700", marginTop: 4 },
  focusFolderScroll: { gap: 10, paddingRight: 4 },
  focusFolderCard: { width: 118, borderRadius: 16, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 9 },
  focusFolderThumbWrap: { position: "relative" },
  focusFolderThumb: { width: "100%", height: 74, borderRadius: 12, backgroundColor: "#e5ebef" },
  focusFolderThumbEmpty: { alignItems: "center", justifyContent: "center" },
  focusFolderIcon: { position: "absolute", right: 6, top: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
  focusFolderLabel: { marginTop: 8, color: "#1f2937", fontSize: 13, fontWeight: "700" },
  focusFolderMeta: { marginTop: 2, color: "#64748b", fontSize: 10, fontWeight: "700" },
  homeStatRow: { flexDirection: "row", gap: 8 },
  homeStat: { flex: 1, borderRadius: 16, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 12 },
  homeStatValue: { color: "#315f7d", fontSize: 22, fontWeight: "700" },
  scanQuickCard: { borderRadius: 20, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 16 },
  scanQuickCopy: { flex: 1, gap: 3 },
  scanMiniButton: { alignSelf: "center", borderRadius: 16, backgroundColor: "#315f7d", paddingHorizontal: 16, paddingVertical: 11 },
  scanMiniButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  gameGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  primaryGameCard: { width: "100%", borderRadius: 24, backgroundColor: "#315f7d", padding: 20, gap: 8, shadowColor: "#4f7892", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 6 },
  primaryGameVisualCard: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 26, backgroundColor: colors.primary, padding: 20, gap: 14, shadowColor: colors.ink, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 6 },
  primaryGameArt: { width: 92, height: 82, borderRadius: 20, borderWidth: 2, borderColor: "rgba(255,255,255,0.75)" },
  primaryGamePhotoStrip: { flexDirection: "row", alignItems: "center", width: 92 },
  primaryGamePhoto: { width: 38, height: 54, marginRight: -18, borderRadius: 12, borderWidth: 2, borderColor: "rgba(255,255,255,0.75)", backgroundColor: "#cbd8e0" },
  primaryGamePhotoRaised: { transform: [{ translateY: -5 }] },
  primaryGamePhotoPlaceholder: { width: 80, height: 58, borderRadius: 16 },
  primaryGameText: { flex: 1, gap: 8 },
  primaryGameIcons: { flexDirection: "row", gap: 7 },
  primaryGameBadge: { alignSelf: "flex-start", borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.22)", paddingHorizontal: 10, paddingVertical: 5 },
  primaryGameBadgeText: { color: "#ffffff", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  primaryGameTitle: { color: "#ffffff", fontSize: 32, fontWeight: "700" },
  primaryGameDetail: { color: "#e5ebef", fontSize: 14, fontWeight: "800" },
  gameCard: { width: "48%", minHeight: 134, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#cbd8e0", padding: 14, gap: 10 },
  gameCardActive: { backgroundColor: "#e5ebef", borderColor: "#4f7892" },
  gameIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0" },
  gameIconActive: { backgroundColor: "#4f7892", borderColor: "#4f7892" },
  gameIconText: { color: "#315f7d", fontSize: 13, fontWeight: "700" },
  gameIconTextActive: { color: "#ffffff" },
  gameCopy: { gap: 4 },
  gameTitle: { color: "#1f2937", fontSize: 15, fontWeight: "700" },
  gameTitleActive: { color: "#274b61" },
  gameDetail: { color: "#64748b", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  gameDetailActive: { color: "#274b61" },
  visualGameCard: { width: "48%", overflow: "hidden", borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 9, gap: 9 },
  visualGameCardActive: { backgroundColor: "#e5ebef", borderColor: "#4f7892" },
  visualGameImageWrap: { position: "relative", height: 94, overflow: "hidden", borderRadius: 16, backgroundColor: "#f3f6f8" },
  visualGameImage: { width: "100%", height: "100%" },
  visualGameFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: "#f3f6f8" },
  placeholderPhoto: { width: "100%", height: "100%", overflow: "hidden", borderRadius: 12 },
  placeholderSun: { position: "absolute", right: 14, top: 12, width: 24, height: 24, borderRadius: 12, opacity: 0.9 },
  placeholderHillBack: { position: "absolute", left: -18, right: 34, bottom: -16, height: 58, borderTopRightRadius: 58, opacity: 0.55 },
  placeholderHillFront: { position: "absolute", left: 24, right: -20, bottom: -18, height: 70, borderTopLeftRadius: 68, opacity: 0.78 },
  visualGameIcon: { position: "absolute", right: 8, top: 8, width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "rgba(249, 115, 22, 0.92)" },
  photoAccessCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 14 },
  photoAccessIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#f3f6f8" },
  photoAccessCopy: { flex: 1, gap: 2 },
  photoAccessLabel: { color: "#64748b", fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  photoAccessValue: { color: "#1f2937", fontSize: 16, fontWeight: "700" },
  photoAccessButton: { overflow: "hidden", borderRadius: 999, backgroundColor: "#315f7d", color: "#ffffff", paddingHorizontal: 12, paddingVertical: 7, fontSize: 12, fontWeight: "700" },

  // Mini game shared
  miniGameHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  miniGameHeaderCopy: { flex: 1 },
  tokenPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, backgroundColor: "#f4efe3", borderWidth: StyleSheet.hairlineWidth, borderColor: "#3f6f8d", paddingHorizontal: 10, paddingVertical: 7 },
  tokenPillText: { color: "#66552f", fontSize: 13, fontWeight: "700" },
  backButton: { borderRadius: 999, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", paddingHorizontal: 14, paddingVertical: 10 },
  backButtonText: { color: "#315f7d", fontSize: 13, fontWeight: "700" },

  // This or That
  thisThatRow: { flexDirection: "row", gap: 10 },
  thisThatActionRow: { flexDirection: "row", gap: 10 },
  pairSecondaryButton: { flex: 1, alignItems: "center", borderRadius: 18, borderWidth: 1, borderColor: "#cbd8e0", backgroundColor: "#ffffff", paddingVertical: 14, paddingHorizontal: 12 },
  pairSecondaryText: { color: "#315f7d", fontSize: 14, fontWeight: "700" },
  pairDangerButton: { flex: 1, alignItems: "center", borderRadius: 18, backgroundColor: "#dc2626", paddingVertical: 14, paddingHorizontal: 12 },
  pairDangerText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  choicePhoto: { flex: 1, aspectRatio: 0.72, overflow: "hidden", borderRadius: 22, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0" },
  choiceImage: { width: "100%", height: "100%" },
  choiceShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(31, 41, 55, 0.18)" },
  choiceBadge: { position: "absolute", top: 10, right: 10, overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.88)", color: "#315f7d", paddingHorizontal: 9, paddingVertical: 4, fontSize: 12, fontWeight: "700" },
  trimmedChoiceBadge: { position: "absolute", top: 10, left: 10, overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(34, 197, 94, 0.92)", color: "#ffffff", paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  choiceFooter: { position: "absolute", left: 10, right: 10, bottom: 10 },
  choiceTitle: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  choiceMeta: { marginTop: 3, color: "#e5ebef", fontSize: 12, fontWeight: "800" },
  loserSummaryRow: { flexDirection: "row", gap: 8 },
  deleteSummary: { color: "#dc2626", fontSize: 13, fontWeight: "700" },
  trimSummary: { color: "#315f7d", fontSize: 13, fontWeight: "700" },
  skipSummary: { color: "#64748b", fontSize: 13, fontWeight: "700" },
  loserColumns: { flexDirection: "row", gap: 10 },
  loserColumn: { flex: 1, minHeight: 170, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: 2, padding: 10, gap: 8 },
  loserColumnDelete: { borderColor: "#ef4444" },
  loserColumnTrim: { borderColor: "#4f7892" },
  loserColumnSkip: { borderColor: "#cbd5e1", minHeight: 112 },
  loserThumbGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  loserThumb: { width: 56, height: 66, overflow: "hidden", borderRadius: 12, backgroundColor: "#111827" },
  loserThumbImage: { width: "100%", height: "100%" },
  trimmedLoserBadge: { position: "absolute", top: 3, left: 3, right: 3, overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(34, 197, 94, 0.92)", color: "#ffffff", paddingHorizontal: 4, paddingVertical: 2, fontSize: 7, fontWeight: "700", textAlign: "center", textTransform: "uppercase" },
  loserThumbText: { position: "absolute", left: 3, right: 3, bottom: 3, overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(15,23,42,0.72)", color: "#ffffff", fontSize: 8, fontWeight: "700", textAlign: "center" },

  // Storage budget
  budgetShell: { flex: 1 },
  budgetContentWithFloating: { paddingTop: 118 },
  floatingBudget: { position: "absolute", top: 22, left: 20, right: 20, zIndex: 10, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.96)", borderWidth: 1, borderColor: "#cbd8e0", padding: 12, shadowColor: "#4f7892", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 16, elevation: 5 },
  floatingBudgetLabel: { color: "#315f7d", fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  floatingBudgetValue: { marginTop: 2, color: "#1f2937", fontSize: 18, fontWeight: "700" },
  floatingBudgetOver: { color: "#dc2626" },
  floatingBudgetTrack: { marginTop: 7, height: 7, overflow: "hidden", borderRadius: 999, backgroundColor: "#e5ebef" },
  floatingBudgetFill: { height: "100%", borderRadius: 999 },
  budgetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  budgetTile: { width: "31.8%", aspectRatio: 1, overflow: "hidden", borderRadius: 16, backgroundColor: "#ffffff", borderWidth: 2, borderColor: "#cbd8e0", opacity: 0.72 },
  budgetTileKept: { borderColor: "#22c55e", opacity: 1 },
  budgetImage: { width: "100%", height: "100%" },
  budgetStatus: { position: "absolute", top: 6, left: 6, overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(254, 226, 226, 0.92)", color: "#b91c1c", paddingHorizontal: 7, paddingVertical: 3, fontSize: 10, fontWeight: "700" },
  budgetStatusKept: { backgroundColor: "rgba(220, 252, 231, 0.92)", color: "#15803d" },
  trimmedTileBadge: { position: "absolute", top: 6, right: 6, maxWidth: "58%", overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(34, 197, 94, 0.92)", color: "#ffffff", paddingHorizontal: 6, paddingVertical: 3, fontSize: 8, fontWeight: "700", textTransform: "uppercase" },
  budgetSize: { position: "absolute", left: 6, right: 6, bottom: 6, color: "#ffffff", fontSize: 11, fontWeight: "700" },
  budgetDecisionCard: { gap: 14, borderRadius: 22, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 16 },
  budgetDecisionTitle: { color: "#1f2937", fontSize: 21, fontWeight: "700" },
  budgetChoiceRow: { gap: 10 },
  budgetChoice: { borderRadius: 18, borderWidth: 1, borderColor: "#cbd8e0", backgroundColor: "#f3f6f8", padding: 14 },
  budgetChoiceSelected: { borderColor: "#315f7d", backgroundColor: "#e5ebef" },
  budgetChoiceTitle: { color: "#1f2937", fontSize: 15, fontWeight: "700" },
  budgetChoiceTitleSelected: { color: "#315f7d" },
  budgetChoiceDetail: { marginTop: 3, color: "#64748b", fontSize: 12, fontWeight: "700" },
  budgetDecisionActions: { gap: 10 },
  beforeAfterRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  beforeAfterCard: { flex: 1, borderRadius: 16, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 12 },
  beforeAfterLabel: { color: "#64748b", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  beforeAfterValueRed: { marginTop: 5, color: "#dc2626", fontSize: 15, fontWeight: "700" },
  beforeAfterValueGreen: { marginTop: 5, color: "#15803d", fontSize: 15, fontWeight: "700" },

  fullPhotoOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.96)", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  fullPhotoClose: { position: "absolute", top: 54, right: 22, zIndex: 2, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  fullPhotoImage: { width: "100%", height: "78%" },
  fullPhotoCaption: { position: "absolute", left: 20, right: 20, bottom: 38, borderRadius: 18, backgroundColor: "rgba(15, 23, 42, 0.72)", padding: 14 },
  fullPhotoTitle: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  fullPhotoTrimmed: { alignSelf: "flex-start", marginTop: 7, overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(34, 197, 94, 0.92)", color: "#ffffff", paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  fullPhotoMeta: { marginTop: 3, color: "#cbd5e1", fontSize: 12, fontWeight: "700" },

  // Memory Lane
  memoryCard: { height: 420, overflow: "hidden", borderRadius: 24, backgroundColor: "#ffffff" },
  memoryImage: { width: "100%", height: "100%" },
  memorySummaryList: { gap: 10 },
  memorySummaryItem: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", paddingHorizontal: 14, paddingVertical: 12 },
  memorySummaryBullet: { width: 8, height: 8, borderRadius: 4 },
  memorySummaryText: { flex: 1, color: "#1f2937", fontSize: 16, fontWeight: "700" },
  memorySummaryValue: { fontSize: 18, fontWeight: "700" },
  yearGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  yearButton: { minWidth: "47%", flexGrow: 1, alignItems: "center", borderRadius: 18, backgroundColor: "#e5ebef", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", paddingVertical: 16 },
  yearButtonText: { color: "#274b61", fontSize: 22, fontWeight: "700" },

  // Onboarding
  onboardingContent: { justifyContent: "center", gap: 14 },
  onboardingSteps: { gap: 10 },
  onboardingStep: { borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 16, gap: 6 },

  // Scan
  scanPanel: { borderRadius: 24, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 18, gap: 16 },
  scanHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  scanTotal: { marginTop: 3, color: "#1f2937", fontSize: 34, fontWeight: "700" },
  scanCapacity: { flexShrink: 1, color: "#274b61", fontSize: 12, fontWeight: "800", lineHeight: 18, textAlign: "right" },
  scanMetricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  scanMetric: { minWidth: "47%", flexGrow: 1, borderRadius: 16, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 13 },
  scanMetricValue: { color: "#1f2937", fontSize: 20, fontWeight: "700" },
  storageBars: { gap: 13 },
  storageBarBlock: { gap: 7 },
  storageTrack: { height: 13, overflow: "hidden", borderRadius: 999, backgroundColor: "#e5ebef" },
  storageFill: { minWidth: 4, height: "100%", borderRadius: 999 },
  storageFillNow: { backgroundColor: "#4f7892" },
  storageFillTrim: { backgroundColor: "#22c55e" },
  storageFillDelete: { backgroundColor: "#ef4444" },
  scanFootnote: { color: "#64748b", fontSize: 12, lineHeight: 18 },

  // Pro reports and automation
  reportIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0" },
  reportButtonRow: { flexDirection: "row", gap: 10 },
  reportButton: { flex: 1, minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", paddingHorizontal: 12 },
  reportButtonActive: { backgroundColor: "#4f7892", borderColor: "#4f7892" },
  reportButtonText: { color: "#315f7d", fontSize: 13, fontWeight: "700" },
  reportButtonTextActive: { color: "#ffffff" },
  reportModalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15, 23, 42, 0.38)" },
  reportModalSheet: { maxHeight: "92%", borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#f3f6f8", padding: 16, paddingBottom: 28, gap: 12 },
  reportDashboardCard: { borderRadius: 24, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 18, gap: 16 },
  reportModalTitle: { color: "#1f2937", fontSize: 25, fontWeight: "700" },
  reportBeforeAfterRow: { flexDirection: "row", gap: 10 },
  reportBeforeAfterCard: { flex: 1, borderRadius: 18, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 14, gap: 4 },
  reportBeforeAfterValue: { color: "#1f2937", fontSize: 20, fontWeight: "700" },
  reportProgressPanel: { borderRadius: 20, backgroundColor: "#f0fdf4", borderWidth: StyleSheet.hairlineWidth, borderColor: "#bbf7d0", padding: 16, gap: 8 },
  reportProgressValue: { color: "#16a34a", fontSize: 36, fontWeight: "700" },
  reportStackedTrack: { height: 12, flexDirection: "row", overflow: "hidden", borderRadius: 999, backgroundColor: "#dcfce7" },
  reportStackedTrim: { height: "100%", backgroundColor: "#4f7892" },
  reportStackedDelete: { height: "100%", backgroundColor: "#ef4444" },
  reportLegendRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  reportLegendTrim: { color: "#315f7d", fontSize: 11, fontWeight: "700" },
  reportLegendDelete: { color: "#b91c1c", fontSize: 11, fontWeight: "700" },
  reportModalActions: { gap: 10 },
  automationCard: { borderRadius: 20, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 16, gap: 14 },
  automationTitleBlock: { flex: 1, gap: 2 },
  dayToggleRow: { flexDirection: "row", gap: 7 },
  dayToggle: { flex: 1, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0" },
  dayToggleActive: { backgroundColor: "#4f7892", borderColor: "#4f7892" },
  dayToggleText: { color: "#274b61", fontSize: 12, fontWeight: "700" },
  dayToggleTextActive: { color: "#ffffff" },
  reminderToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  reminderToggle: { width: 42, height: 24, borderRadius: 14, justifyContent: "center" },
  reminderToggleKnob: { width: 20, height: 20, borderRadius: 10 },
  languagePickerButton: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  languagePickerText: { flex: 1, flexShrink: 1, fontSize: 15, fontWeight: "800" },
  languagePickerTextCompact: { fontSize: 14 },
  languageModal: { flex: 1, paddingHorizontal: 20 },
  languageModalHeader: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  languageSearch: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  languageList: { paddingVertical: 10 },
  reminderTimeButton: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  reminderTimeText: { flex: 1, fontSize: 15, fontWeight: "800" },
  reminderModalHeader: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  reminderModalTitle: { flex: 1, minWidth: 0 },
  reminderDoneButton: { minHeight: 44, minWidth: 54, alignItems: "flex-end", justifyContent: "center" },
  reminderPickerBody: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60, gap: 24 },
  nativeTimePicker: { width: "100%", maxWidth: 360, height: 216 },
  languageRow: { minHeight: 58, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 10 },
  languageRowCompact: { minHeight: 54, gap: 7 },
  languageNative: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: "800" },
  languageNativeCompact: { fontSize: 15 },
  languageEnglish: { flexShrink: 1, maxWidth: 160, fontSize: 13, textAlign: "right" },
  languageEnglishCompact: { maxWidth: 122, fontSize: 12 },
  automationTimes: { gap: 8 },
  automationTimeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeAdjustButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#e5ebef" },
  timeValue: { flex: 1, textAlign: "center", color: "#1f2937", fontSize: 18, fontWeight: "700" },
  timeRemoveButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0" },
  addTimeButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 14, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0" },
  addTimeText: { color: "#315f7d", fontSize: 13, fontWeight: "700" },
  automationTargetRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, borderRadius: 16, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 13 },

  // Level progress
  levelRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  levelCopy: { minWidth: 92 },
  levelTitle: { color: "#1f2937", fontSize: 18, fontWeight: "700" },
  levelProgress: { flex: 1, gap: 7 },

  // Settings
  settingCard: { marginTop: 12, borderRadius: 20, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  settingsHero: { borderRadius: 26, backgroundColor: colors.primary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.primary, padding: 20, gap: 8 },
  settingsEyebrow: { color: colors.primaryGlow, fontSize: 11, fontWeight: "800", letterSpacing: 1.6, textTransform: "uppercase" },
  settingsHeroTitle: { color: colors.white, fontSize: 29, fontWeight: "800", letterSpacing: -0.5 },
  settingsHeroCopy: { color: "#dce8e4", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  settingsReloadWrap: { marginTop: 24 },
  accountCard: { marginTop: 12, borderRadius: 24, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 18, gap: 14, shadowColor: colors.ink, shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  accountHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  accountIcon: { width: 46, height: 46, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  accountIconSignedOut: { backgroundColor: colors.cardSoft },
  accountCopy: { flex: 1, gap: 3 },
  accountStatus: { color: colors.text, fontSize: 15, fontWeight: "800" },
  accountStatusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.textSubtle },
  accountStatusDotActive: { backgroundColor: colors.sage },
  accountActions: { flexDirection: "row", flexWrap: "nowrap", gap: 7 },
  accountSecondaryButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.cardSoft, paddingHorizontal: 9 },
  accountManageButton: { flex: 1, minWidth: 0 },
  accountSecondaryText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  accountSignOutButton: { minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.danger, backgroundColor: colors.dangerSoft, paddingHorizontal: 14 },
  accountSignOutText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  accountSignInButton: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 16, backgroundColor: colors.primary, paddingHorizontal: 16 },
  accountSignInText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  restorePurchaseCard: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 16 },
  restorePurchaseIcon: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#f3f6f8" },
  restorePurchaseCopy: { flex: 1, gap: 3 },
  restorePurchaseAction: { color: "#315f7d", fontSize: 13, fontWeight: "700" },
  booleanCopy: { flex: 1, gap: 4 },
  toggleTrack: { width: 54, height: 32, justifyContent: "center", borderRadius: 999, backgroundColor: "#cbd8e0", padding: 4 },
  toggleTrackActive: { backgroundColor: "#4f7892" },
  toggleKnob: { width: 24, height: 24, borderRadius: 999, backgroundColor: "#f3f6f8" },
  toggleKnobActive: { transform: [{ translateX: 22 }], backgroundColor: "#ffffff" },
  settingCardVertical: { marginTop: 12, borderRadius: 20, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 16, gap: 12 },
  trimKindCompact: { width: "100%", marginTop: 0 },
  trimKindGrid: { gap: 8 },
  trimKindOption: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 15, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 12 },
  trimKindOptionActive: { backgroundColor: "#e5ebef", borderColor: "#4f7892" },
  trimKindOptionLocked: { opacity: 0.62 },
  trimKindLabel: { color: "#334155", fontSize: 13, fontWeight: "700" },
  trimKindLabelActive: { color: "#315f7d" },
  proPill: { overflow: "hidden", borderRadius: 999, backgroundColor: "#1f2937", color: "#ffffff", paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: "700" },
  dropdownButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 16, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 14, gap: 12 },
  dropdownTitle: { color: "#1f2937", fontSize: 17, fontWeight: "700" },
  dropdownChevron: { color: "#315f7d", fontSize: 14, fontWeight: "700" },
  dropdownList: { gap: 7 },
  dropdownOption: { borderRadius: 14, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 12, gap: 3 },
  dropdownOptionActive: { backgroundColor: "#e5ebef", borderColor: "#4f7892" },
  dropdownOptionTitle: { color: "#1f2937", fontSize: 14, fontWeight: "700" },
  dropdownOptionTitleActive: { color: "#274b61" },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  radioOuter: { width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 2, borderColor: "#cbd8e0", backgroundColor: "#ffffff" },
  radioOuterActive: { borderColor: "#315f7d" },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#315f7d" },
  qualityPreview: { marginTop: 12, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", padding: 16, gap: 12 },
  qualityThumbButton: { borderRadius: 14, overflow: "hidden" },
  qualityThumb: { width: 58, height: 58, borderRadius: 14 },
  qualityRow: { gap: 6 },
  qualityLabel: { color: "#1f2937", fontSize: 13, fontWeight: "700" },
  qualityTrack: { height: 8, overflow: "hidden", borderRadius: 999, backgroundColor: "#f1f5f9" },
  qualityFill: { height: "100%", borderRadius: 999 },
  qualityModalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.96)", paddingHorizontal: 12, paddingTop: 84, paddingBottom: 34 },
  qualityModalContent: { flex: 1, justifyContent: "center", gap: 18 },
  qualityModalImage: { width: "100%", height: "68%" },
  qualityCompareStrip: { flexDirection: "row", gap: 8 },
  qualityCompareItem: { flex: 1, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", padding: 8, gap: 6 },
  qualityCompareItemActive: { borderColor: "#4f7892", backgroundColor: "rgba(79, 120, 146, 0.16)" },
  qualityCompareThumb: { width: "100%", height: 76, borderRadius: 12, backgroundColor: "#111827" },
  qualityCompareLabel: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  qualityCompareSize: { color: "#cbd5e1", fontSize: 11, fontWeight: "800" },
  settingLabel: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  settingValue: { marginTop: 4, color: colors.text, fontSize: 20, fontWeight: "700" },
  stepper: { flexDirection: "row", gap: 8 },
  stepperButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#e5ebef" },
  stepperText: { color: "#315f7d", fontSize: 22, fontWeight: "700" },
  segmented: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segment: { flex: 1, minWidth: "30%", alignItems: "center", borderRadius: 14, backgroundColor: "#f3f6f8", borderWidth: StyleSheet.hairlineWidth, borderColor: "#cbd8e0", paddingVertical: 10, paddingHorizontal: 8 },
  segmentActive: { backgroundColor: "#4f7892", borderColor: "#4f7892" },
  segmentText: { color: "#274b61", fontSize: 12, fontWeight: "800" },
  segmentTextActive: { color: "#ffffff" },
  themeOptionRow: { flexDirection: "row", gap: 6 },
  themeOption: { flex: 1, minWidth: 0, alignItems: "center", gap: 6, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 3, paddingVertical: 8 },
  themeSwatch: { width: 28, height: 28, overflow: "hidden", alignItems: "flex-end", justifyContent: "flex-end", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  themeSwatchAccent: { width: 14, height: 14, borderTopLeftRadius: 10 },
  themeOptionText: { fontSize: 10, fontWeight: "700" },

  // Buttons
  primaryButton: { width: "100%", alignItems: "center", borderRadius: 18, backgroundColor: colors.primary, paddingVertical: 15, paddingHorizontal: 18 },
  primaryButtonPressed: { transform: [{ scale: 0.985 }], opacity: 0.86 },
  primaryButtonDisabled: { backgroundColor: "#a7bdca", opacity: 0.72 },
  dangerButton: { backgroundColor: "#dc2626" },
  primaryButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  secondaryButton: { width: "100%", alignItems: "center", borderRadius: 18, borderWidth: 1, borderColor: "#cbd8e0", backgroundColor: "#ffffff", paddingVertical: 14, paddingHorizontal: 18 },
  secondaryButtonDisabled: { opacity: 0.55 },
  secondaryButtonText: { color: "#315f7d", fontSize: 14, fontWeight: "800" },
  secondaryButtonTextDisabled: { color: "#9ca3af" },

  // Nav
  bottomNav: { position: "absolute", left: 10, right: 10, bottom: 10, flexDirection: "row", gap: 3, borderRadius: 28, backgroundColor: "rgba(255, 253, 248, 0.98)", borderWidth: 1, borderColor: colors.border, padding: 5, shadowColor: colors.ink, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 22, elevation: 8 },
  navButton: { flex: 1, minWidth: 0, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 15, paddingHorizontal: 2, paddingVertical: 7 },
  navButtonActive: { backgroundColor: colors.primary },
  navText: { width: "100%", minWidth: 0, color: colors.primary, fontSize: 12, lineHeight: 14, fontWeight: "700", textAlign: "center", includeFontPadding: false },
  navTextCompact: { fontSize: 11, lineHeight: 13 },
  navTextActive: { color: "#ffffff" },
});
