import { t } from "../lib/i18n";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, shadow, spacing, type } from "../constants/design";
import {
  BarChart,
  Card,
  DonutSplit,
  Pill,
  ProgressRing,
  SectionHeader,
} from "./ui/primitives";
import {
  StorageBreakdownBar,
  type StorageBreakdownSegment,
} from "./ui/StorageBreakdownBar";
import type {
  NativeActionLogEntry,
  NativeDailyStats,
  NativeStats,
} from "../lib/native-store";
import type { NativeLibraryScan } from "../lib/native-photo-source";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKLY_TARGET_MB = 500;
type ChartPeriod = "week" | "month" | "year";
type SavingsBucket = {
  key: string;
  label: string;
  dayLabel: string;
  value: number;
  sub: number;
  deleteMbFreed: number;
};

export type StatsDashboardProps = {
  stats: NativeStats;
  scan: NativeLibraryScan | null;
  scanBusy: boolean;
  scanComplete: boolean;
  scanInProgressText?: string;
  onQuickScan: () => void;
  onOpenTrimmable: () => void;
  onShare: () => void;
};

export function StatsDashboard({
  stats,
  scan,
  scanBusy,
  scanComplete,
  scanInProgressText,
  onQuickScan,
  onOpenTrimmable,
  onShare,
}: StatsDashboardProps) {
  const today = dailyFor(stats, dateKey());
  const week = sumDays(stats, 7);
  const weekRing = Math.min(1, week.mbFreed / WEEKLY_TARGET_MB);
  const streak = currentStreak(stats);
  const level = levelInfo(stats);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("week");
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | undefined>(() => dateKey());

  const chartData = useMemo(
    () => buildSavingsBuckets(stats, chartPeriod),
    [chartPeriod, stats],
  );
  const selectedBucket = chartData.find((item) => item.key === selectedBucketKey) ?? chartData[chartData.length - 1];
  const chartTitle = chartPeriod === "week" ? "7-day savings" : chartPeriod === "month" ? t("ui.monthly-savings") : t("ui.yearly-savings");
  const removableMB = scan?.deleteSavingsMB ?? 0;
  const deviceStorage = scan ? buildDeviceStorageSegments(scan) : null;
  const photoStorage = scan ? buildPhotoStorageSegments(scan) : [];

  const topHogs = useMemo(
    () =>
      [...stats.actionLog]
        .filter((e) => e.mbFreed > 0)
        .sort((a, b) => b.mbFreed - a.mbFreed)
        .slice(0, 5),
    [stats.actionLog],
  );

  const badges = useMemo(() => buildBadges(stats), [stats]);

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View>
          <Text style={type.eyebrow}>{t("ui.your-impact")}</Text>
          <Text style={styles.title}>{t("ui.stats")}</Text>
        </View>
        <Pressable onPress={onShare} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="share-outline" size={18} color={colors.primary} />
        </Pressable>
      </View>

      {/* Weekly goal ring */}
      <Card style={styles.heroCard} tone="warm">
        <View style={styles.heroLeft}>
          <Pill icon="trophy-outline" value={`Lv ${level.level}`} label={level.title} tone="primary" />
          <Text style={styles.heroFreed}>{formatMB(week.mbFreed)}</Text>
          <Text style={styles.heroSub}>this week · goal {formatMB(WEEKLY_TARGET_MB)}</Text>
          <View style={styles.pillRow}>
            <Pill icon="flame" value={String(streak)} label={t("ui.streak")} tone="honey" />
            <Pill icon="aperture-outline" value={String(stats.reviewed)} label={t("ui.reviewed")} tone="sage" />
          </View>
        </View>
        <ProgressRing progress={weekRing} size={130} thickness={12}>
          <Text style={styles.ringNum}>{Math.round(weekRing * 100)}%</Text>
          <Text style={styles.ringHint}>{t("ui.weekly")}</Text>
        </ProgressRing>
      </Card>

      <SectionHeader
        title={t("ui.quick-scan")}
        action={scanComplete ? <Text style={styles.action}>{t("ui.latest-hunch")}</Text> : undefined}
      />
      <Card style={styles.scanCard}>
        <View style={styles.scanHeader}>
          <View style={styles.scanIcon}>
            {scanBusy ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="search-outline" size={21} color={colors.primary} />
            )}
          </View>
          <View style={styles.scanCopy}>
            <Text style={styles.scanTitle}>
              {scanBusy ? t("ui.scanning-library") : scan ? t("ui.storage-hunch") : t("ui.run-a-quick-scan")}
            </Text>
            <Text style={styles.scanHint}>
              {scanBusy
                ? scanInProgressText ?? t("ui.checking-photos")
                : scan
                  ? `Last checked ${new Date(scan.scannedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                  : t("ui.estimate-library-size-trim-potential-screenshots")}
            </Text>
          </View>
          <Pressable
            onPress={onQuickScan}
            disabled={scanBusy}
            style={[styles.scanButton, scanBusy && styles.scanButtonDisabled]}
          >
            <Text style={styles.scanButtonText}>{scanBusy ? "Scanning" : t("ui.quick-scan")}</Text>
          </Pressable>
        </View>
        {scan ? (
          <>
            <View style={styles.scanMetricGrid}>
              <ScanMetric label={t("ui.photos")} value={formatCount(scan.assetCount)} />
              <ScanMetric label={t("ui.photo-size")} value={formatMB(scan.totalSizeMB)} />
              <ScanMetric label={t("ui.trimmable")} value={formatMB(scan.trimSavingsMB)} accent={colors.sage} onPress={onOpenTrimmable} />
              <ScanMetric label={t("ui.removable")} value={formatMB(removableMB)} accent={colors.danger} />
            </View>
            <View style={styles.storageOverview}>
              {deviceStorage ? (
                <StorageBreakdownBar
                  title={t("ui.device-storage")}
                  totalLabel={`${formatMB(deviceStorage.capacityMB)} total`}
                  segments={deviceStorage.segments}
                  formatValue={formatMB}
                />
              ) : null}
              <StorageBreakdownBar
                title={t("ui.photo-library-by-type")}
                totalLabel={`${formatMB(scan.totalSizeMB)} total`}
                segments={photoStorage}
                formatValue={formatMB}
              />
              <Text style={styles.storageNote}>
                Photo storage is estimated from the scanned library because iOS exposes device
                capacity and free space, not an exact Photos category.{"\n"}
                {scan.similarityAnalysis === "vision"
                  ? t("ui.similar-includes-only-on-device-vision-matches-a")
                  : t("ui.similar-photo-savings-are-omitted-because-on-dev")}
              </Text>
            </View>
            <View style={styles.scanBreakdown}>
              <ScanBreakdownRow
                icon="phone-portrait-outline"
                label={t("ui.screenshots")}
                count={scan.screenshotCount}
                value={scan.screenshotSavingsMB}
                color={colors.primary}
              />
              <ScanBreakdownRow
                icon="warning-outline"
                label={t("ui.possible-mistakes")}
                count={scan.mistakeCount}
                value={scan.mistakeDeleteSavingsMB}
                color={colors.honey}
              />
              <ScanBreakdownRow
                icon="copy-outline"
                label={scan.similarityAnalysis === "vision" ? t("ui.similar-verified") : t("ui.similar-not-analyzed")}
                count={scan.duplicateRemovalCount}
                value={scan.duplicateDeleteSavingsMB}
                color={colors.info}
              />
              <ScanBreakdownRow
                icon="sparkles-outline"
                label={t("ui.burst-extras")}
                count={scan.burstCount}
                value={scan.burstDeleteSavingsMB}
                color={colors.sage}
              />
            </View>
          </>
        ) : null}
      </Card>

      {/* Savings chart */}
      <SectionHeader title={chartTitle} action={<Text style={styles.action}>{t("ui.trim-delete")}</Text>} />
      <Card>
        <View style={styles.chartTabs}>
          {([
            ["week", "Week"],
            ["month", "Month"],
            ["year", "Year"],
          ] as const).map(([period, label]) => {
            const active = chartPeriod === period;
            return (
              <Pressable
                key={period}
                onPress={() => {
                  setChartPeriod(period);
                  setSelectedBucketKey(undefined);
                }}
                style={[styles.chartTab, active && styles.chartTabActive]}
              >
                <Text style={[styles.chartTabText, active && styles.chartTabTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <BarChart
          data={chartData}
          height={120}
          selectedKey={selectedBucket?.key}
          onSelect={(bucket) => setSelectedBucketKey(bucket.key)}
        />
        <View style={styles.legend}>
          <LegendDot color={colors.sage} label={t("ui.trim")} />
          <LegendDot color={colors.danger} label={t("ui.delete")} />
        </View>
        {selectedBucket ? (
          <View style={styles.dayBreakdown}>
            <Text style={styles.dayBreakdownTitle}>{selectedBucket.dayLabel}</Text>
            <BreakdownPill color={colors.sage} label={t("ui.trim")} value={formatMB(selectedBucket.sub ?? 0)} />
            <BreakdownPill color={colors.danger} label={t("ui.delete")} value={formatMB(selectedBucket.deleteMbFreed)} />
            <BreakdownPill color={colors.textSubtle} label={t("ui.total")} value={formatMB(selectedBucket.value)} />
          </View>
        ) : null}
      </Card>

      {/* Trim vs Delete donut */}
      <SectionHeader title={t("ui.trim-vs-delete")} />
      <Card style={styles.donutRow}>
        <DonutSplit trim={stats.trimMbFreed} del={stats.deleteMbFreed} size={120} thickness={14} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <SplitRow color={colors.sage} label={t("ui.trim")} value={formatMB(stats.trimMbFreed)} count={stats.trimmed} total={stats.trimMbFreed + stats.deleteMbFreed} rawValue={stats.trimMbFreed} />
          <SplitRow color={colors.danger} label={t("ui.delete")} value={formatMB(stats.deleteMbFreed)} count={stats.deleted} total={stats.trimMbFreed + stats.deleteMbFreed} rawValue={stats.deleteMbFreed} />
          <SplitRow color={colors.textSubtle} label={t("ui.total")} value={formatMB(stats.trimMbFreed + stats.deleteMbFreed)} count={stats.trimmed + stats.deleted} />
        </View>
      </Card>

      {/* Today snapshot row */}
      <SectionHeader title={t("ui.today")} />
      <View style={styles.smallGrid}>
        <SmallStat icon="checkmark-circle-outline" tint={colors.sage} value={today.kept} label={t("ui.kept")} />
        <SmallStat icon="cut-outline" tint={colors.honey} value={today.trimmed} label={t("ui.trimmed")} />
        <SmallStat icon="trash-outline" tint={colors.danger} value={today.deleted} label={t("ui.deleted")} />
      </View>

      {/* Top space hogs */}
      <SectionHeader
        title={t("ui.top-space-hogs")}
        action={topHogs.length > 0 ? <Text style={styles.action}>{topHogs.length} of last 60</Text> : undefined}
      />
      {topHogs.length === 0 ? (
        <Card style={styles.empty}>
          <Ionicons name="leaf-outline" size={22} color={colors.sage} />
          <Text style={styles.emptyTitle}>{t("ui.nothing-reclaimed-yet")}</Text>
          <Text style={styles.emptyHint}>{t("ui.start-a-round-to-see-your-biggest-wins-here")}</Text>
        </Card>
      ) : (
        <Card padded={false} style={{ overflow: "hidden" }}>
          {topHogs.map((e, i) => (
            <HogRow entry={e} key={e.id} divider={i !== 0} max={topHogs[0].mbFreed} />
          ))}
        </Card>
      )}

      {/* Badges */}
      <SectionHeader title={t("ui.badges")} action={<Text style={styles.action}>{badges.filter((b) => b.unlocked).length}/{badges.length}</Text>} />
      <View style={styles.badgeGrid}>
        {badges.map((b) => (
          <BadgeCard key={b.title} {...b} />
        ))}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendDot}>
      <View style={[styles.dotBlock, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function BreakdownPill({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.breakdownPill}>
      <View style={[styles.dotBlock, { backgroundColor: color }]} />
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={styles.breakdownValue}>{value}</Text>
    </View>
  );
}

function SmallStat({
  icon,
  tint,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  value: number;
  label: string;
}) {
  return (
    <Card style={styles.smallStat}>
      <Ionicons name={icon} size={18} color={tint} />
      <Text style={[styles.smallStatValue, { color: tint }]}>{value}</Text>
      <Text style={styles.smallStatLabel}>{label}</Text>
    </Card>
  );
}

function ScanMetric({ label, value, accent = colors.text, onPress }: { label: string; value: string; accent?: string; onPress?: () => void }) {
  const content = (
    <>
      <Text style={styles.scanMetricLabel}>{label}</Text>
      <Text style={[styles.scanMetricValue, { color: accent }]} numberOfLines={1}>{value}</Text>
      {onPress ? <Text style={styles.scanMetricAction}>{t("ui.review-photos")}</Text> : null}
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.scanMetric, styles.scanMetricButton, pressed && styles.scanMetricPressed]}>
      {content}
    </Pressable>
  ) : <View style={styles.scanMetric}>{content}</View>;
}

function ScanBreakdownRow({
  icon,
  label,
  count,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count: number;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.scanBreakdownRow}>
      <View style={[styles.scanBreakdownIcon, { backgroundColor: color + "1f" }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text style={styles.scanBreakdownLabel}>{label}</Text>
      <Text style={styles.scanBreakdownCount}>{formatCount(count)}</Text>
      <Text style={styles.scanBreakdownValue}>{formatMB(value)}</Text>
    </View>
  );
}

function buildDeviceStorageSegments(scan: NativeLibraryScan): {
  capacityMB: number;
  segments: StorageBreakdownSegment[];
} | null {
  if (!scan.deviceCapacityMB || scan.deviceCapacityMB <= 0 || scan.freeSpaceMB == null) return null;

  const capacityMB = scan.deviceCapacityMB;
  const availableMB = Math.min(capacityMB, Math.max(0, scan.freeSpaceMB));
  const usedMB = Math.max(0, capacityMB - availableMB);
  const photosMB = Math.min(usedMB, Math.max(0, scan.totalSizeMB));
  const otherUsedMB = Math.max(0, usedMB - photosMB);

  return {
    capacityMB,
    segments: [
      { key: "photos", label: t("ui.photos-est"), valueMB: photosMB, color: colors.honey },
      { key: "other-used", label: t("ui.other-used"), valueMB: otherUsedMB, color: colors.primaryBright },
      { key: "available", label: "Available", valueMB: availableMB, color: colors.cardSoft },
    ],
  };
}

function buildPhotoStorageSegments(scan: NativeLibraryScan): StorageBreakdownSegment[] {
  return [
    {
      key: "screenshots",
      label: "Screenshots",
      valueMB: scan.storageByType.screenshotsMB,
      color: colors.primaryBright,
    },
    { key: "live", label: t("ui.live-photos"), valueMB: scan.storageByType.livePhotosMB, color: colors.sage },
    {
      key: "similar",
      label: scan.similarityAnalysis === "vision" ? t("ui.similar-verified") : t("ui.similar-unavailable"),
      valueMB: scan.storageByType.similarPhotosMB,
      color: colors.honey,
    },
    {
      key: "other",
      label: t("ui.other-photos"),
      valueMB: scan.storageByType.otherPhotosMB,
      color: colors.textSubtle,
    },
  ];
}

function SplitRow({
  color,
  label,
  value,
  count,
  total,
  rawValue,
}: {
  color: string;
  label: string;
  value: string;
  count: number;
  total?: number;
  rawValue?: number;
}) {
  const pct = total && rawValue != null && total > 0 ? ` (${Math.round((rawValue / total) * 100)}%)` : "";
  return (
    <View style={styles.splitRow}>
      <View style={[styles.dotBlock, { backgroundColor: color }]} />
      <Text style={styles.splitLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.splitValue}>{value}{pct}</Text>
      <Text style={styles.splitCount}>· {count}</Text>
    </View>
  );
}

function HogRow({ entry, divider, max }: { entry: NativeActionLogEntry; divider: boolean; max: number }) {
  const pct = Math.max(0.1, Math.min(1, entry.mbFreed / Math.max(1, max)));
  return (
    <View style={[styles.hogRow, divider && styles.hogDivider]}>
      <View
        style={[
          styles.hogDot,
          {
            backgroundColor:
              entry.action === "trim"
                ? colors.sage
                : entry.action === "delete"
                  ? colors.danger
                  : colors.textSubtle,
          },
        ]}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.hogTitle} numberOfLines={1}>{entry.title}</Text>
        <View style={styles.hogTrack}>
          <View
            style={[
              styles.hogFill,
              {
                width: `${pct * 100}%`,
                backgroundColor:
                  entry.action === "trim"
                    ? colors.sage
                    : entry.action === "delete"
                      ? colors.danger
                      : colors.primary,
              },
            ]}
          />
        </View>
      </View>
      <Text style={styles.hogSize}>{formatMB(entry.mbFreed)}</Text>
    </View>
  );
}

function BadgeCard({
  title,
  hint,
  icon,
  progress,
  unlocked,
}: {
  title: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  progress: number;
  unlocked: boolean;
}) {
  return (
    <View style={[styles.badge, unlocked && styles.badgeUnlocked]}>
      <View style={[styles.badgeIcon, unlocked && styles.badgeIconUnlocked]}>
        <Ionicons name={icon} size={20} color={unlocked ? colors.white : colors.textSubtle} />
      </View>
      <Text style={[styles.badgeTitle, unlocked && { color: colors.primary }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.badgeHint} numberOfLines={2}>{hint}</Text>
      <View style={styles.badgeTrack}>
        <View style={[styles.badgeFill, { width: `${Math.max(4, Math.min(100, progress * 100))}%` }]} />
      </View>
    </View>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────

function dateKey(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 10);
}
function dailyFor(stats: NativeStats, key: string): NativeDailyStats {
  return (
    stats.dailyActivity[key] ?? {
      reviewed: 0,
      kept: 0,
      trimmed: 0,
      deleted: 0,
      mbFreed: 0,
      trimMbFreed: 0,
      deleteMbFreed: 0,
      sessions: 0,
    }
  );
}
function sumDays(stats: NativeStats, days: number): NativeDailyStats {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - i * DAY_MS);
    return dailyFor(stats, dateKey(d));
  }).reduce((sum, day) => ({
    reviewed: sum.reviewed + day.reviewed,
    kept: sum.kept + day.kept,
    trimmed: sum.trimmed + day.trimmed,
    deleted: sum.deleted + day.deleted,
    mbFreed: sum.mbFreed + day.mbFreed,
    trimMbFreed: sum.trimMbFreed + day.trimMbFreed,
    deleteMbFreed: sum.deleteMbFreed + day.deleteMbFreed,
    sessions: sum.sessions + day.sessions,
  }));
}
function emptyBucket(): NativeDailyStats {
  return {
    reviewed: 0,
    kept: 0,
    trimmed: 0,
    deleted: 0,
    mbFreed: 0,
    trimMbFreed: 0,
    deleteMbFreed: 0,
    sessions: 0,
  };
}
function addDailyStats(sum: NativeDailyStats, day: NativeDailyStats): NativeDailyStats {
  return {
    reviewed: sum.reviewed + day.reviewed,
    kept: sum.kept + day.kept,
    trimmed: sum.trimmed + day.trimmed,
    deleted: sum.deleted + day.deleted,
    mbFreed: sum.mbFreed + day.mbFreed,
    trimMbFreed: sum.trimMbFreed + day.trimMbFreed,
    deleteMbFreed: sum.deleteMbFreed + day.deleteMbFreed,
    sessions: sum.sessions + day.sessions,
  };
}
function bucketFromStats(key: string, label: string, dayLabel: string, stats: NativeDailyStats): SavingsBucket {
  return {
    key,
    label,
    dayLabel,
    value: +stats.mbFreed.toFixed(2),
    sub: +stats.trimMbFreed.toFixed(2),
    deleteMbFreed: +stats.deleteMbFreed.toFixed(2),
  };
}
function buildSavingsBuckets(stats: NativeStats, period: ChartPeriod): SavingsBucket[] {
  if (period === "week") {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * DAY_MS);
      const key = dateKey(d);
      const day = dailyFor(stats, key);
      return bucketFromStats(
        key,
        d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1),
        d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
        day,
      );
    });
  }

  const now = new Date();
  if (period === "month") {
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekCount = Math.ceil(daysInMonth / 7);
    return Array.from({ length: weekCount }, (_, index) => {
      const startDay = index * 7 + 1;
      const endDay = Math.min(daysInMonth, startDay + 6);
      let sum = emptyBucket();
      for (let day = startDay; day <= endDay; day += 1) {
        sum = addDailyStats(sum, dailyFor(stats, dateKey(new Date(year, month, day))));
      }
      const monthLabel = new Date(year, month, startDay).toLocaleDateString(undefined, { month: "short" });
      return bucketFromStats(
        `${year}-${String(month + 1).padStart(2, "0")}-w${index + 1}`,
        `W${index + 1}`,
        `${monthLabel} ${startDay}-${endDay}`,
        sum,
      );
    });
  }

  const year = now.getFullYear();
  return Array.from({ length: 12 }, (_, month) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let sum = emptyBucket();
    for (let day = 1; day <= daysInMonth; day += 1) {
      sum = addDailyStats(sum, dailyFor(stats, dateKey(new Date(year, month, day))));
    }
    const date = new Date(year, month, 1);
    return bucketFromStats(
      `${year}-${String(month + 1).padStart(2, "0")}`,
      date.toLocaleDateString(undefined, { month: "short" }).slice(0, 1),
      date.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      sum,
    );
  });
}
function currentStreak(stats: NativeStats): number {
  let streak = 0;
  for (let i = 0; i < 90; i += 1) {
    const d = new Date(Date.now() - i * DAY_MS);
    if (dailyFor(stats, dateKey(d)).reviewed > 0) streak += 1;
    else break;
  }
  return streak;
}
function levelInfo(stats: NativeStats) {
  const points = stats.reviewed + stats.mbFreed / 25 + stats.trimmed * 0.6 + stats.deleted * 0.8;
  const level = Math.max(1, Math.floor(points / 25) + 1);
  const titles = [t("ui.fresh-start"), t("ui.space-saver"), t("ui.camera-roll-pro"), t("ui.storage-guardian")];
  const title = titles[Math.min(titles.length - 1, Math.floor((level - 1) / 3))];
  return { level, title };
}
function formatMB(v: number) {
  if (!Number.isFinite(v) || v <= 0) return t("ui.0-mb");
  return v >= 1024 ? `${(v / 1024).toFixed(2)} GB` : `${v.toFixed(1)} MB`;
}
function formatCount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Math.max(0, Math.round(value)).toLocaleString();
}

function buildBadges(stats: NativeStats) {
  const week = sumDays(stats, 7);
  const today = dailyFor(stats, dateKey());
  const streak = currentStreak(stats);
  const cleanups = stats.trimmed + stats.deleted;
  return [
    {
      title: t("ui.first-trim"),
      hint: t("ui.trim-your-very-first-photo"),
      icon: "cut-outline" as const,
      progress: stats.trimmed >= 1 ? 1 : 0,
      unlocked: stats.trimmed >= 1,
    },
    {
      title: "100 trimmed",
      hint: `${Math.min(stats.trimmed, 100)}/100 trims`,
      icon: "albums-outline" as const,
      progress: Math.min(1, stats.trimmed / 100),
      unlocked: stats.trimmed >= 100,
    },
    {
      title: "30 reviewed",
      hint: `${Math.min(stats.reviewed, 30)}/30 photos`,
      icon: "images-outline" as const,
      progress: Math.min(1, stats.reviewed / 30),
      unlocked: stats.reviewed >= 30,
    },
    {
      title: "100 reviewed",
      hint: `${Math.min(stats.reviewed, 100)}/100 photos`,
      icon: "albums-outline" as const,
      progress: Math.min(1, stats.reviewed / 100),
      unlocked: stats.reviewed >= 100,
    },
    {
      title: t("ui.consistency-3"),
      hint: `${Math.min(streak, 3)}/3 active days`,
      icon: "calendar-outline" as const,
      progress: Math.min(1, streak / 3),
      unlocked: streak >= 3,
    },
    {
      title: t("ui.1-gb-freed"),
      hint: `${formatMB(stats.mbFreed)} of 1 GB`,
      icon: "rocket-outline" as const,
      progress: Math.min(1, stats.mbFreed / 1024),
      unlocked: stats.mbFreed >= 1024,
    },
    {
      title: t("ui.250-mb-freed"),
      hint: `${formatMB(stats.mbFreed)} of 250 MB`,
      icon: "sparkles-outline" as const,
      progress: Math.min(1, stats.mbFreed / 250),
      unlocked: stats.mbFreed >= 250,
    },
    {
      title: "7-day streak",
      hint: `${streak}/7 days`,
      icon: "flame-outline" as const,
      progress: Math.min(1, streak / 7),
      unlocked: streak >= 7,
    },
    {
      title: t("ui.daily-10"),
      hint: `${Math.min(today.reviewed, 10)}/10 today`,
      icon: "sunny-outline" as const,
      progress: Math.min(1, today.reviewed / 10),
      unlocked: today.reviewed >= 10,
    },
    {
      title: t("ui.daily-25"),
      hint: `${Math.min(today.reviewed, 25)}/25 today`,
      icon: "sunny" as const,
      progress: Math.min(1, today.reviewed / 25),
      unlocked: today.reviewed >= 25,
    },
    {
      title: t("ui.cleanup-50"),
      hint: `${Math.min(cleanups, 50)}/50 trims or deletes`,
      icon: "checkmark-done-outline" as const,
      progress: Math.min(1, cleanups / 50),
      unlocked: cleanups >= 50,
    },
    {
      title: t("ui.weekly-saver"),
      hint: `${formatMB(week.mbFreed)} of ${formatMB(WEEKLY_TARGET_MB)}`,
      icon: "trophy-outline" as const,
      progress: Math.min(1, week.mbFreed / WEEKLY_TARGET_MB),
      unlocked: week.mbFreed >= WEEKLY_TARGET_MB,
    },
    {
      title: t("ui.weekly-rhythm"),
      hint: `${Math.min(week.reviewed, 50)}/50 this week`,
      icon: "pulse-outline" as const,
      progress: Math.min(1, week.reviewed / 50),
      unlocked: week.reviewed >= 50,
    },
  ];
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 40 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  title: { ...type.display, color: colors.text, marginTop: 4 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  heroCard: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  heroLeft: { flex: 1, gap: 6 },
  heroFreed: { ...type.display, color: colors.primary, marginTop: 6 },
  heroSub: { ...type.body, color: colors.textMuted },
  pillRow: { flexDirection: "row", gap: 8, marginTop: spacing.md, flexWrap: "wrap" },
  ringNum: { fontSize: 18, fontWeight: "700", color: colors.text },
  ringHint: { fontSize: 9, fontWeight: "800", color: colors.textMuted, letterSpacing: 1.2 },

  scanCard: { gap: spacing.md },
  scanHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  scanIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  scanCopy: { flex: 1, minWidth: 0 },
  scanTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  scanHint: { marginTop: 2, fontSize: 11, fontWeight: "700", color: colors.textMuted, lineHeight: 16 },
  scanButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  scanButtonDisabled: { opacity: 0.55 },
  scanButtonText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  scanMetricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  scanMetric: {
    width: "48%",
    borderRadius: radius.md,
    backgroundColor: colors.cardSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  scanMetricLabel: { fontSize: 10, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },
  scanMetricValue: { marginTop: 5, fontSize: 17, fontWeight: "700" },
  scanMetricAction: { marginTop: 3, fontSize: 10, fontWeight: "800", color: colors.primary },
  scanMetricButton: { borderWidth: 1, borderColor: colors.sage },
  scanMetricPressed: { opacity: 0.72 },
  storageOverview: {
    gap: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.lg,
  },
  storageNote: { fontSize: 10, lineHeight: 15, fontWeight: "600", color: colors.textSubtle },
  scanBreakdown: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  scanBreakdownRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  scanBreakdownIcon: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  scanBreakdownLabel: { flex: 1, fontSize: 12, fontWeight: "800", color: colors.text },
  scanBreakdownCount: { fontSize: 11, fontWeight: "800", color: colors.textMuted },
  scanBreakdownValue: { width: 72, textAlign: "right", fontSize: 12, fontWeight: "700", color: colors.text },

  chartTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: spacing.md,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.cardSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSoft,
  },
  chartTab: {
    flex: 1,
    alignItems: "center",
    borderRadius: radius.pill,
    paddingVertical: 9,
  },
  chartTabActive: { backgroundColor: colors.primary },
  chartTabText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  chartTabTextActive: { color: colors.white },
  legend: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md, justifyContent: "center" },
  legendDot: { flexDirection: "row", gap: 6, alignItems: "center" },
  dotBlock: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
  dayBreakdown: {
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.md,
    gap: 8,
  },
  dayBreakdownTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  breakdownPill: { flexDirection: "row", alignItems: "center", gap: 8 },
  breakdownLabel: { flex: 1, fontSize: 12, fontWeight: "800", color: colors.text },
  breakdownValue: { fontSize: 12, fontWeight: "700", color: colors.text },

  donutRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  splitRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  splitLabel: { fontSize: 11, fontWeight: "800", color: colors.text, width: 42 },
  splitValue: { flex: 1, fontSize: 11, fontWeight: "700", color: colors.text },
  splitCount: { fontSize: 10, color: colors.textMuted, fontWeight: "700" },

  action: { fontSize: 12, fontWeight: "700", color: colors.primary },

  smallGrid: { flexDirection: "row", gap: spacing.md },
  smallStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: 4,
  },
  smallStatValue: { fontSize: 22, fontWeight: "700" },
  smallStatLabel: { fontSize: 10, color: colors.textMuted, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },

  hogRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  hogDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft },
  hogDot: { width: 10, height: 10, borderRadius: 5 },
  hogTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  hogTrack: {
    marginTop: 6,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderSoft,
    overflow: "hidden",
  },
  hogFill: { height: "100%", borderRadius: 3 },
  hogSize: { fontSize: 12, fontWeight: "700", color: colors.text },

  empty: { alignItems: "center", gap: 6, paddingVertical: spacing.xl },
  emptyTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  emptyHint: { fontSize: 12, color: colors.textMuted },

  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  badge: {
    width: "47%",
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSoft,
    gap: 4,
    ...shadow.soft,
  },
  badgeUnlocked: {
    borderColor: colors.primary,
    backgroundColor: "#eaf0f4",
  },
  badgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.borderSoft,
  },
  badgeIconUnlocked: { backgroundColor: colors.primary },
  badgeTitle: { marginTop: 6, fontSize: 13, fontWeight: "800", color: colors.text },
  badgeHint: { fontSize: 11, color: colors.textMuted, fontWeight: "600", minHeight: 28 },
  badgeTrack: { marginTop: 6, height: 4, borderRadius: 2, backgroundColor: colors.borderSoft, overflow: "hidden" },
  badgeFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 2 },
});
