import { useMemo } from "react";
import {
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
import type {
  NativeActionLogEntry,
  NativeDailyStats,
  NativeStats,
} from "../lib/native-store";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKLY_TARGET_MB = 500;

export type StatsDashboardProps = {
  stats: NativeStats;
  onShare: () => void;
};

export function StatsDashboard({
  stats,
  onShare,
}: StatsDashboardProps) {
  const today = dailyFor(stats, dateKey());
  const week = sumDays(stats, 7);
  const weekRing = Math.min(1, week.mbFreed / WEEKLY_TARGET_MB);
  const streak = currentStreak(stats);
  const level = levelInfo(stats);

  const chartData = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.now() - (6 - i) * DAY_MS);
        const key = dateKey(d);
        const day = dailyFor(stats, key);
        return {
          label: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1),
          value: day.mbFreed,
          sub: day.trimMbFreed,
        };
      }),
    [stats],
  );

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
          <Text style={type.eyebrow}>Your impact</Text>
          <Text style={styles.title}>Stats</Text>
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
            <Pill icon="flame" value={String(streak)} label="streak" tone="honey" />
            <Pill icon="aperture-outline" value={String(stats.reviewed)} label="reviewed" tone="sage" />
          </View>
        </View>
        <ProgressRing progress={weekRing} size={130} thickness={12}>
          <Text style={styles.ringNum}>{Math.round(weekRing * 100)}%</Text>
          <Text style={styles.ringHint}>WEEKLY</Text>
        </ProgressRing>
      </Card>

      {/* 7-day chart */}
      <SectionHeader title="7-day savings" action={<Text style={styles.action}>MB freed / day</Text>} />
      <Card>
        <BarChart data={chartData} height={120} />
        <View style={styles.legend}>
          <LegendDot color={colors.primaryBright} label="Total" />
          <LegendDot color={colors.sage} label="From trim" />
        </View>
      </Card>

      {/* Trim vs Delete donut */}
      <SectionHeader title="Trim vs Delete" />
      <Card style={styles.donutRow}>
        <DonutSplit trim={stats.trimMbFreed} del={stats.deleteMbFreed} size={120} thickness={14} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <SplitRow color={colors.sage} label="Trim" value={formatMB(stats.trimMbFreed)} count={stats.trimmed} />
          <SplitRow color={colors.danger} label="Delete" value={formatMB(stats.deleteMbFreed)} count={stats.deleted} />
          <SplitRow color={colors.primaryBright} label="Total" value={formatMB(stats.mbFreed)} count={stats.reviewed} />
        </View>
      </Card>

      {/* Today snapshot row */}
      <SectionHeader title="Today" />
      <View style={styles.smallGrid}>
        <SmallStat icon="checkmark-circle-outline" tint={colors.sage} value={today.kept} label="Kept" />
        <SmallStat icon="cut-outline" tint={colors.honey} value={today.trimmed} label="Trimmed" />
        <SmallStat icon="trash-outline" tint={colors.danger} value={today.deleted} label="Deleted" />
      </View>

      {/* Top space hogs */}
      <SectionHeader
        title="Top space hogs"
        action={topHogs.length > 0 ? <Text style={styles.action}>{topHogs.length} of last 60</Text> : undefined}
      />
      {topHogs.length === 0 ? (
        <Card style={styles.empty}>
          <Ionicons name="leaf-outline" size={22} color={colors.sage} />
          <Text style={styles.emptyTitle}>Nothing reclaimed yet</Text>
          <Text style={styles.emptyHint}>Start a round to see your biggest wins here.</Text>
        </Card>
      ) : (
        <Card padded={false} style={{ overflow: "hidden" }}>
          {topHogs.map((e, i) => (
            <HogRow entry={e} key={e.id} divider={i !== 0} max={topHogs[0].mbFreed} />
          ))}
        </Card>
      )}

      {/* Badges */}
      <SectionHeader title="Badges" action={<Text style={styles.action}>{badges.filter((b) => b.unlocked).length}/{badges.length}</Text>} />
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

function SplitRow({
  color,
  label,
  value,
  count,
}: {
  color: string;
  label: string;
  value: string;
  count: number;
}) {
  return (
    <View style={styles.splitRow}>
      <View style={[styles.dotBlock, { backgroundColor: color }]} />
      <Text style={styles.splitLabel}>{label}</Text>
      <Text style={styles.splitValue}>{value}</Text>
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
  const titles = ["Fresh Start", "Space Saver", "Camera Roll Pro", "Storage Guardian"];
  const title = titles[Math.min(titles.length - 1, Math.floor((level - 1) / 3))];
  return { level, title };
}
function formatMB(v: number) {
  if (!Number.isFinite(v) || v <= 0) return "0 MB";
  return v >= 1024 ? `${(v / 1024).toFixed(2)} GB` : `${v.toFixed(1)} MB`;
}

function buildBadges(stats: NativeStats) {
  const week = sumDays(stats, 7);
  const today = dailyFor(stats, dateKey());
  return [
    {
      title: "First trim",
      hint: "Trim your very first photo",
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
      title: "1 GB freed",
      hint: `${formatMB(stats.mbFreed)} of 1 GB`,
      icon: "rocket-outline" as const,
      progress: Math.min(1, stats.mbFreed / 1024),
      unlocked: stats.mbFreed >= 1024,
    },
    {
      title: "7-day streak",
      hint: `${currentStreak(stats)}/7 days`,
      icon: "flame-outline" as const,
      progress: Math.min(1, currentStreak(stats) / 7),
      unlocked: currentStreak(stats) >= 7,
    },
    {
      title: "Daily 10",
      hint: `${Math.min(today.reviewed, 10)}/10 today`,
      icon: "sunny-outline" as const,
      progress: Math.min(1, today.reviewed / 10),
      unlocked: today.reviewed >= 10,
    },
    {
      title: "Weekly saver",
      hint: `${formatMB(week.mbFreed)} of ${formatMB(WEEKLY_TARGET_MB)}`,
      icon: "trophy-outline" as const,
      progress: Math.min(1, week.mbFreed / WEEKLY_TARGET_MB),
      unlocked: week.mbFreed >= WEEKLY_TARGET_MB,
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
  ringNum: { fontSize: 18, fontWeight: "900", color: colors.text },
  ringHint: { fontSize: 9, fontWeight: "800", color: colors.textMuted, letterSpacing: 1.2 },

  legend: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md, justifyContent: "center" },
  legendDot: { flexDirection: "row", gap: 6, alignItems: "center" },
  dotBlock: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, fontWeight: "700", color: colors.textMuted },

  donutRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  splitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  splitLabel: { fontSize: 13, fontWeight: "800", color: colors.text, flex: 1 },
  splitValue: { fontSize: 13, fontWeight: "900", color: colors.text },
  splitCount: { fontSize: 11, color: colors.textMuted, fontWeight: "700" },

  action: { fontSize: 12, fontWeight: "700", color: colors.primary },

  smallGrid: { flexDirection: "row", gap: spacing.md },
  smallStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: 4,
  },
  smallStatValue: { fontSize: 22, fontWeight: "900" },
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
  hogSize: { fontSize: 12, fontWeight: "900", color: colors.text },

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
    backgroundColor: "#fff1e3",
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
