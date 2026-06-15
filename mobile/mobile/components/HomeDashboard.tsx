import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, radius, shadow, spacing, type, tiles } from "../constants/design";
import {
  Card,
  FAB,
  IconTile,
  Pill,
  ProgressRing,
  SectionHeader,
  Skeleton,
} from "./ui/primitives";
import type { NativePhoto } from "../lib/native-photo-source";
import type {
  NativeActionLogEntry,
  NativeDailyStats,
  NativeStats,
} from "../lib/native-store";

type Category = {
  key: "large" | "old" | "screenshots" | "similar";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  estMB: number;
  thumb?: string;
};

export type HomeDashboardProps = {
  stats: NativeStats;
  today: NativeDailyStats;
  queue: NativePhoto[];
  recentPhotos: NativePhoto[];
  totalFreedMB: number;
  potentialMB: number;
  scanBusy: boolean;
  scanInProgressText?: string;
  tokens: number;
  isPro: boolean;
  adBusy?: boolean;
  onStartSwipe: () => void;
  onOpenTrim: () => void;
  onOpenGames: () => void;
  onOpenShop: () => void;
  onWatchAd: () => void;
  onQuickScan: () => void;
  onPickCategory: (key: Category["key"]) => void;
  onShare: () => void;
};


const CAT_DEFS: { key: Category["key"]; label: string; icon: keyof typeof Ionicons.glyphMap; match: (p: NativePhoto) => boolean; estPerPhoto?: number }[] = [
  { key: "large", label: "Large", icon: "albums-outline", match: (p) => p.sizeMB >= 4 },
  { key: "old", label: "Old", icon: "time-outline", match: (p) => Date.now() - p.creationTime > 5 * 365.25 * 24 * 3600 * 1000 },
  { key: "screenshots", label: "Screens", icon: "phone-portrait-outline", match: (p) => p.cleanupReasons.includes("Screenshot") || p.title.toLowerCase().includes("screen") },
  { key: "similar", label: "Similar", icon: "copy-outline", match: (p) => p.cleanupReasons.includes("Similar") },
];

export function HomeDashboard(props: HomeDashboardProps) {
  const {
    stats,
    today,
    queue,
    recentPhotos,
    totalFreedMB,
    potentialMB,
    scanBusy,
    tokens,
    isPro,
    adBusy,
    onStartSwipe,
    onOpenTrim,
    onOpenGames,
    onOpenShop,
    onWatchAd,
    onQuickScan,
    onPickCategory,
    onShare,
  } = props;


  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [float]);
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  const categories: Category[] = useMemo(
    () =>
      CAT_DEFS.map((def) => {
        const matched = queue.filter(def.match);
        const sumMB = matched.reduce((s, p) => s + p.sizeMB, 0);
        return {
          key: def.key,
          label: def.label,
          icon: def.icon,
          count: matched.length || estimateCountFor(stats, def.key),
          estMB: sumMB || estimateMBFor(stats, def.key),
          thumb: matched[0]?.uri,
        };
      }),
    [queue, stats],
  );

  const target = Math.max(potentialMB, totalFreedMB + 200, 1);
  const ringProgress = Math.min(1, totalFreedMB / target);

  const freedDisplay = formatMB(totalFreedMB);
  const potentialDisplay = formatMB(target);

  const heroThumbs = recentPhotos.slice(0, 3);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>Trimswipe</Text>
            <Text style={styles.headerTitle}>Hey 👋</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={onOpenShop} hitSlop={10} style={styles.tokenChip}>
              <Ionicons name="flash" size={14} color={colors.honey} />
              <Text style={styles.tokenChipValue}>{isPro ? "∞" : tokens}</Text>
            </Pressable>
            <Pressable onPress={onShare} hitSlop={10} style={styles.shareBtn}>
              <Ionicons name="share-outline" size={18} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {!isPro ? (
          <Pressable onPress={onWatchAd} disabled={adBusy} style={styles.adBanner}>
            <View style={styles.adBannerIcon}>
              <Ionicons name="play-circle" size={22} color={colors.sage} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.adBannerTitle}>Watch a short ad</Text>
              <Text style={styles.adBannerSub}>Earn +5 Trim Tokens</Text>
            </View>
            <Ionicons
              name={adBusy ? "hourglass-outline" : "add-circle"}
              size={22}
              color={colors.sage}
            />
          </Pressable>
        ) : null}


        {/* Hero ring */}
        <Card style={styles.hero} tone="warm">
          <View style={styles.heroLeft}>
            <Text style={styles.eyebrow}>Reclaimed</Text>
            <Text style={styles.heroFreed}>{freedDisplay}</Text>
            <Text style={styles.heroSub}>of ~{potentialDisplay} possible</Text>
            <View style={styles.pillRow}>
              <Pill icon="flame" value={String(streakOf(stats))} label="streak" tone="honey" />
              <Pill icon="checkmark-done" value={String(stats.reviewed)} label="reviewed" tone="sage" />
            </View>
          </View>
          <Animated.View style={{ transform: [{ translateY: floatY }] }}>
            <ProgressRing progress={ringProgress} size={132} thickness={11}>
              <View style={styles.thumbStack}>
                {heroThumbs.length === 0 ? (
                  <Ionicons name="images-outline" size={28} color={colors.primary} />
                ) : (
                  heroThumbs.map((p, i) => (
                    <Image
                      key={p.id}
                      source={{ uri: p.uri }}
                      style={[
                        styles.thumbStackImg,
                        {
                          marginLeft: i === 0 ? 0 : -10,
                          zIndex: heroThumbs.length - i,
                        },
                      ]}
                      contentFit="cover"
                    />
                  ))
                )}
              </View>
              <Text style={styles.ringPct}>{Math.round(ringProgress * 100)}%</Text>
            </ProgressRing>
          </Animated.View>
        </Card>

        {/* Quick actions 2x2 */}
        <SectionHeader title="Quick actions" />
        <View style={styles.tileGrid}>
          <View style={styles.tileRow}>
            <IconTile
              icon="search-outline"
              label="Scan"
              hint={scanBusy ? "Scanning…" : "Find savings"}
              bg={tiles.scan.bg}
              accent={tiles.scan.accent}
              onPress={() => {
                void Haptics.selectionAsync();
                onQuickScan();
              }}
            />
            <IconTile
              icon="layers-outline"
              label="Swipe"
              hint={`${queue.length || "—"} in deck`}
              bg={tiles.swipe.bg}
              accent={tiles.swipe.accent}
              onPress={() => {
                void Haptics.selectionAsync();
                onStartSwipe();
              }}
            />
          </View>
          <View style={styles.tileRow}>
            <IconTile
              icon="cut-outline"
              label="Trim"
              hint="Strip metadata"
              bg={tiles.trim.bg}
              accent={tiles.trim.accent}
              onPress={() => {
                void Haptics.selectionAsync();
                onOpenTrim();
              }}
            />
            <IconTile
              icon="game-controller-outline"
              label="Games"
              hint="Cleanup mini games"
              bg={tiles.games.bg}
              accent={tiles.games.accent}
              onPress={() => {
                void Haptics.selectionAsync();
                onOpenGames();
              }}
            />
          </View>
        </View>

        {/* Today snapshot */}
        <SectionHeader
          title="Today"
          action={
            <Text style={styles.sectionAction}>{formatMB(today.mbFreed)} freed</Text>
          }
        />
        <Card style={styles.todayCard}>
          <TodayStat icon="checkmark-circle-outline" tint={colors.sage} value={today.kept} label="Kept" />
          <View style={styles.todayDivider} />
          <TodayStat icon="cut-outline" tint={colors.honey} value={today.trimmed} label="Trimmed" />
          <View style={styles.todayDivider} />
          <TodayStat icon="trash-outline" tint={colors.danger} value={today.deleted} label="Deleted" />
        </Card>

        {/* Categories carousel */}
        <SectionHeader title="Problem photos" action={<Text style={styles.sectionAction}>Tap to swipe →</Text>} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catScroll}
        >
          {scanBusy && queue.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <View key={i} style={{ marginRight: 12 }}>
                  <Skeleton width={140} height={170} radius={radius.lg} />
                </View>
              ))
            : categories.map((c) => (
                <CategoryCard key={c.key} category={c} onPress={() => onPickCategory(c.key)} />
              ))}
        </ScrollView>

        {/* Recent activity */}
        <SectionHeader title="Recent activity" />
        <RecentList entries={stats.actionLog.slice(0, 5)} />

        <View style={{ height: 110 }} />
      </ScrollView>

      <FAB icon="flash-outline" label="Quick scan" onPress={onQuickScan} />
    </View>
  );
}

function CategoryCard({ category, onPress }: { category: Category; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
      onPress={onPress}
    >
      <Animated.View style={[styles.catCard, { transform: [{ scale }] }]}>
        <View style={styles.catThumbWrap}>
          {category.thumb ? (
            <Image source={{ uri: category.thumb }} style={styles.catThumb} contentFit="cover" />
          ) : (
            <View style={[styles.catThumb, styles.catThumbEmpty]}>
              <Ionicons name={category.icon} size={28} color={colors.primary} />
            </View>
          )}
          <View style={styles.catIconBubble}>
            <Ionicons name={category.icon} size={14} color={colors.primary} />
          </View>
        </View>
        <Text style={styles.catLabel}>{category.label}</Text>
        <Text style={styles.catCount}>{category.count} · {formatMB(category.estMB)}</Text>
      </Animated.View>
    </Pressable>
  );
}

function TodayStat({
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
    <View style={styles.todayStat}>
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={[styles.todayValue, { color: tint }]}>{value}</Text>
      <Text style={styles.todayLabel}>{label}</Text>
    </View>
  );
}

function RecentList({ entries }: { entries: NativeActionLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <Ionicons name="sparkles-outline" size={20} color={colors.primaryBright} />
        <Text style={styles.emptyTitle}>No activity yet</Text>
        <Text style={styles.emptyHint}>Tap Swipe to start your first round.</Text>
      </Card>
    );
  }
  return (
    <Card padded={false} style={{ overflow: "hidden" }}>
      {entries.map((e, i) => (
        <View key={e.id} style={[styles.recentRow, i !== 0 && styles.recentRowDivider]}>
          <View
            style={[
              styles.recentDot,
              {
                backgroundColor:
                  e.action === "delete"
                    ? colors.danger
                    : e.action === "trim"
                      ? colors.honey
                      : colors.sage,
              },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.recentTitle} numberOfLines={1}>
              {actionLabel(e.action)} {e.title}
            </Text>
            <Text style={styles.recentMeta}>
              {e.mbFreed > 0 ? `${formatMB(e.mbFreed)} saved` : "kept"} ·{" "}
              {timeAgo(e.createdAt)}
            </Text>
          </View>
          <Ionicons
            name={
              e.action === "delete"
                ? "trash-outline"
                : e.action === "trim"
                  ? "cut-outline"
                  : "checkmark-outline"
            }
            size={16}
            color={colors.textSubtle}
          />
        </View>
      ))}
    </Card>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────

function formatMB(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  return value >= 1024 ? `${(value / 1024).toFixed(2)} GB` : `${value.toFixed(1)} MB`;
}
function actionLabel(a: string) {
  if (a === "delete") return "Deleted";
  if (a === "trim") return "Trimmed";
  return "Kept";
}
function timeAgo(iso: string) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
function streakOf(stats: NativeStats): number {
  const dayMs = 24 * 3600 * 1000;
  let streak = 0;
  for (let i = 0; i < 60; i += 1) {
    const d = new Date(Date.now() - i * dayMs);
    const key = d.toISOString().slice(0, 10);
    const day = stats.dailyActivity[key];
    if (day && day.reviewed > 0) streak += 1;
    else break;
  }
  return streak;
}
function estimateCountFor(stats: NativeStats, _key: Category["key"]): number {
  return Math.max(0, Math.round(stats.reviewed * 0.15));
}
function estimateMBFor(stats: NativeStats, _key: Category["key"]): number {
  return Math.max(0, Math.round(stats.mbFreed * 0.1));
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: type.eyebrow,
  headerTitle: { ...type.display, marginTop: 4, color: colors.text },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  hero: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  heroLeft: { flex: 1, gap: 4 },
  heroFreed: { ...type.display, color: colors.primary, marginTop: 4 },
  heroSub: { ...type.body, color: colors.textMuted, marginTop: -2 },
  pillRow: { flexDirection: "row", gap: 8, marginTop: spacing.md, flexWrap: "wrap" },
  thumbStack: { flexDirection: "row", alignItems: "center" },
  thumbStackImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.cardSoft,
  },
  ringPct: { marginTop: 6, fontSize: 12, fontWeight: "800", color: colors.text },

  tileGrid: { gap: spacing.md },
  tileRow: { flexDirection: "row", gap: spacing.md },

  todayCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
  },
  todayStat: { flex: 1, alignItems: "center", gap: 4 },
  todayValue: { fontSize: 24, fontWeight: "900" },
  todayLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  todayDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: colors.border },

  sectionAction: { fontSize: 12, fontWeight: "700", color: colors.primary },

  catScroll: { paddingRight: spacing.xl, gap: 12 },
  catCard: {
    width: 150,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.soft,
  },
  catThumbWrap: { position: "relative" },
  catThumb: {
    width: "100%",
    height: 110,
    borderRadius: radius.md,
    backgroundColor: colors.cardSoft,
  },
  catThumbEmpty: { alignItems: "center", justifyContent: "center" },
  catIconBubble: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: { marginTop: 10, fontSize: 14, fontWeight: "800", color: colors.text },
  catCount: { marginTop: 2, fontSize: 11, color: colors.textMuted, fontWeight: "600" },

  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  recentRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
  },
  recentDot: { width: 10, height: 10, borderRadius: 5 },
  recentTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  recentMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: "600" },

  emptyCard: { alignItems: "center", gap: 6, paddingVertical: spacing.xl },
  emptyTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  emptyHint: { fontSize: 12, color: colors.textMuted },
});
