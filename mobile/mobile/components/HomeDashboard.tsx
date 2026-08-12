import { t } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, radius, shadow, spacing, type, tiles } from "../constants/design";
import {
  Card,
  IconTile,
  Pill,
  ProgressRing,
  SectionHeader,
} from "./ui/primitives";
import type {
  NativeCleanupCategory,
  NativeLibraryScan,
  NativePhoto,
} from "../lib/native-photo-source";
import type {
  NativeActionLogEntry,
  NativeDailyStats,
  NativeSettings,
  NativeStats,
} from "../lib/native-store";

type Category = {
  key: NativeCleanupCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  estMB: number;
  thumb?: string;
};

export type DailyRewardState = {
  canClaimToday: boolean;
  claimedToday: boolean;
  rewardAmount: number;
  nextResetLabel: string;
};

export type HomeDashboardProps = {
  stats: NativeStats;
  today: NativeDailyStats;
  queue: NativePhoto[];
  recentPhotos: NativePhoto[];
  totalFreedMB: number;
  potentialMB: number;
  scan: NativeLibraryScan | null;
  scanBusy: boolean;
  scanComplete: boolean;
  scanInProgressText?: string;
  tokens: number;
  isPro: boolean;
  hasUnlimitedTrims?: boolean;
  adBusy?: boolean;
  onStartSwipe: () => void;
  onOpenTrim: () => void;
  onOpenGames: () => void;
  onOpenShop: () => void;
  onWatchAd: () => void;
  onQuickScan: () => void;
  onDeepClean: () => void;
  onOptimizeStorage: () => void;
  onOpenRecentlyDeleted: () => void;
  onPickCategory: (key: Category["key"]) => void;
  onShare: () => void;
};


const CAT_DEFS: Array<{
  key: Category["key"];
  label: (settings: NativeSettings) => string;
  icon: keyof typeof Ionicons.glyphMap;
  match: (p: NativePhoto, settings: NativeSettings) => boolean;
}> = [
  { key: "large", label: (s) => `>${formatThresholdMB(s.minSizeMB)}`, icon: "albums-outline", match: (p, s) => p.sizeMB >= s.minSizeMB },
  { key: "old", label: (s) => `>${formatAgeThreshold(s.minAgeYears)}`, icon: "time-outline", match: (p, s) => ageYears(p.creationTime) >= s.minAgeYears },
  { key: "screenshots", label: () => t("ui.home-screens"), icon: "phone-portrait-outline", match: (p) => p.cleanupReasons.includes("Screenshot") || p.title.toLowerCase().includes("screen") },
  { key: "live", label: () => t("ui.home-live"), icon: "radio-button-on-outline", match: (p) => p.cleanupReasons.includes(t("ui.live-photo")) },
  { key: "duplicates", label: () => t("ui.similar-photos"), icon: "copy-outline", match: (p) => p.cleanupReasons.includes("Similar") },
  { key: "bursts", label: () => t("ui.home-bursts"), icon: "sparkles-outline", match: (p) => p.cleanupReasons.includes("Burst") },
];

export function HomeDashboard(props: HomeDashboardProps) {
  useTranslation();
  const {
    stats,
    today,
    queue,
    recentPhotos,
    totalFreedMB,
    potentialMB,
    scan,
    scanBusy,
    scanComplete,
    tokens,
    isPro,
    hasUnlimitedTrims = isPro,
    adBusy,
    onStartSwipe,
    onOpenTrim,
    onOpenGames,
    onOpenShop,
    onWatchAd,
    onQuickScan,
    onDeepClean,
    onOptimizeStorage,
    onOpenRecentlyDeleted,
    onPickCategory,
    onShare,
  } = props;
  const [detailsOpen, setDetailsOpen] = useState(false);


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
  const categories: Category[] = CAT_DEFS.map((def) => {
    const matched = queue.filter((photo) => def.match(photo, stats.settings));
    const sumMB = matched.reduce((s, p) => s + p.sizeMB, 0);
    const scanEstimate = scan ? estimateCategoryFromScan(scan, def.key) : null;
    return {
      key: def.key,
      label: def.label(stats.settings),
      icon: def.icon,
      count: matched.length || scanEstimate?.count || estimateCountFor(stats, def.key),
      estMB: sumMB || scanEstimate?.mb || estimateMBFor(stats, def.key),
      thumb: matched[0]?.uri,
    };
  });
  const recommended =
    categories
      .filter((category) => category.count > 0)
      .sort((a, b) => b.estMB - a.estMB)[0] ?? categories[0];

  const target = Math.max(potentialMB, totalFreedMB + 200, 1);
  const ringProgress = Math.min(1, totalFreedMB / target);

  const freedDisplay = formatMB(totalFreedMB);
  const potentialDisplay = formatMB(target);

  const heroThumbs = recentPhotos.slice(0, 3);
  const dailyGoalMB = Math.max(5, stats.settings.dailyGoalMB);
  const dailyGoalProgress = Math.min(1, today.mbFreed / dailyGoalMB);
  const dailyGoalComplete = dailyGoalProgress >= 1;
  const scanHint = scanBusy
    ? props.scanInProgressText ?? t("ui.home-scanning")
    : scanComplete
      ? t("ui.scanning-completed")
      : t("ui.find-savings");
  const scanBg = scanComplete ? colors.sageSoft : "#e3ebf0";
  const scanAccent = scanComplete ? colors.sageDeep : tiles.scan.accent;
  const healthScore = libraryHealthScore(stats, scan, today);
  const projectedFreed = scan
    ? scan.trimSavingsMB + scan.deleteSavingsMB
    : potentialMB;
  const oneTapCount = scan
    ? scan.screenshotCount + scan.duplicateRemovalCount + scan.burstCount
    : Math.max(0, Math.round(stats.reviewed * 0.2));
  const oneTapSavings = scan
    ? scan.screenshotSavingsMB + scan.duplicateDeleteSavingsMB + scan.burstDeleteSavingsMB
    : Math.max(50, stats.mbFreed * 0.25);
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>{t("ui.trimswipe")}</Text>
            <Text style={styles.headerTitle}>{t("ui.hey")}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={onOpenShop} hitSlop={10} style={styles.tokenChip}>
              <Ionicons name="flash" size={14} color={colors.honey} />
              <Text style={styles.tokenChipValue}>{hasUnlimitedTrims ? String.fromCharCode(8734) : tokens}</Text>
            </Pressable>
            <Pressable onPress={() => setDetailsOpen(true)} hitSlop={10} style={styles.shareBtn}>
              <Ionicons name="search-outline" size={18} color={colors.primary} />
            </Pressable>
            <Pressable onPress={onShare} hitSlop={10} style={styles.shareBtn}>
              <Ionicons name="share-outline" size={17} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* Today snapshot */}
        <SectionHeader
          title={t("ui.today")}
          action={
            <Text style={styles.sectionAction}>{t("ui.home-freed", { value: formatMB(today.mbFreed) })}</Text>
          }
        />
        <View style={styles.todayCard}>
          <View style={styles.todayStatsRow}>
            <TodayStat icon="checkmark-circle-outline" tint={colors.sage} value={today.kept} label={t("ui.kept")} />
            <View style={styles.todayDivider} />
            <TodayStat icon="cut-outline" tint={colors.honey} value={today.trimmed} label={t("ui.trimmed")} />
            <View style={styles.todayDivider} />
            <TodayStat icon="trash-outline" tint={colors.danger} value={today.deleted} label={t("ui.deleted")} />
          </View>
          <View style={styles.embeddedGoal}>
            <View style={styles.embeddedGoalTop}>
              <Text style={styles.embeddedGoalTitle}>{t("ui.daily-goal")}</Text>
              <Text style={styles.embeddedGoalValue}>{formatMB(today.mbFreed)} / {dailyGoalMB} MB</Text>
            </View>
            <View style={styles.goalTrack}>
              <View
                style={[
                  styles.goalFill,
                  {
                    width: `${dailyGoalProgress * 100}%`,
                    backgroundColor: dailyGoalComplete ? colors.sage : colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.goalHint}>
              {dailyGoalComplete ? t("ui.goal-complete") : t("ui.home-left-today", { value: formatMB(Math.max(0, dailyGoalMB - today.mbFreed)) })}
            </Text>
          </View>
        </View>

        {!isPro ? (
          <Pressable onPress={onWatchAd} disabled={adBusy} style={styles.adBanner}>
            <View style={styles.adBannerIcon}>
              <Ionicons name="play-circle" size={22} color={colors.sage} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.adBannerTitle}>{t("ui.watch-a-short-ad")}</Text>
              <Text style={styles.adBannerSub}>{t("ui.earn-5-tokens")}</Text>
            </View>
            <Ionicons
              name={adBusy ? "hourglass-outline" : "add-circle"}
              size={22}
              color={colors.sage}
            />
          </Pressable>
        ) : null}

        <SectionHeader title={t("ui.recommended-cleanup")} />
        <Pressable
          onPress={() => recommended && onPickCategory(recommended.key)}
          style={styles.recommendedCard}
        >
          <View style={styles.recommendedIcon}>
            <Ionicons name={recommended?.icon ?? "sparkles-outline"} size={22} color={colors.white} />
          </View>
          <View style={styles.recommendedCopy}>
            <Text style={styles.recommendedTitle}>{recommended?.label ?? t("ui.review-photos")}</Text>
            <Text style={styles.recommendedHint}>
              {recommended ? t("ui.home-photos-possible", { count: recommended.count, value: formatMB(recommended.estMB) }) : t("ui.find-the-next-best-cleanup-set")}
            </Text>
          </View>
          <View style={styles.reviewButton}>
            <Text style={styles.reviewButtonText}>{t("ui.review-now")}</Text>
          </View>
        </Pressable>

        {/* Quick actions 2x2 */}
        <SectionHeader title={t("ui.quick-actions")} />
        <View style={styles.tileGrid}>
          <View style={styles.tileRow}>
            <IconTile
              icon="search-outline"
              label={t("ui.quick-scan")}
              hint={scanHint}
              bg={scanBg}
              accent={scanAccent}
              onPress={() => {
                void Haptics.selectionAsync();
                onQuickScan();
              }}
            />
            <IconTile
              icon="layers-outline"
              label={t("ui.swipe")}
              hint={t("ui.home-in-deck", { count: queue.length })}
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
              icon="bag-outline"
              label={t("ui.deep-clean")}
              hint={isPro ? t("ui.guided-full-scan") : t("ui.pro-guided-scan")}
              bg={tiles.trim.bg}
              accent={tiles.trim.accent}
              onPress={() => {
                void Haptics.selectionAsync();
                onDeepClean();
              }}
            />
            <IconTile
              icon="game-controller-outline"
              label={t("ui.games")}
              hint={t("ui.cleanup-mini-games")}
              bg={tiles.games.bg}
              accent={tiles.games.accent}
              onPress={() => {
                void Haptics.selectionAsync();
                onOpenGames();
              }}
            />
          </View>
        </View>

        <SectionHeader title={t("ui.storage-actions")} />
        <View style={styles.storageActionRow}>
          <Pressable onPress={() => onPickCategory("screenshots")} style={[styles.storageActionCard, styles.nukeActionCard]}>
            <View style={[styles.storageActionIcon, { backgroundColor: colors.danger }]}>
              <Ionicons name="trash-outline" size={21} color={colors.white} />
            </View>
            <Text style={styles.storageActionTitle}>{t("ui.nuke")}</Text>
            <Text style={styles.storageActionHint}>{t("ui.home-items-possible", { count: oneTapCount, value: formatMB(oneTapSavings) })}</Text>
          </Pressable>

          <Pressable onPress={onOptimizeStorage} style={[styles.storageActionCard, styles.cloudActionCard]}>
            <View style={[styles.storageActionIcon, { backgroundColor: colors.info }]}>
              <Ionicons name="cloud-outline" size={21} color={colors.white} />
            </View>
            <Text style={styles.storageActionTitle}>{t("ui.cloud")}</Text>
            <Text style={styles.storageActionHint}>{t("ui.optimize-storage")}</Text>
          </Pressable>
        </View>

        {/* Recent activity */}
        <SectionHeader title={t("ui.recent-activity")} />
        <RecentList entries={stats.actionLog.slice(0, 5)} onOpenRecentlyDeleted={onOpenRecentlyDeleted} />

        <View style={{ height: 110 }} />
      </ScrollView>
      <Modal visible={detailsOpen} animationType="fade" transparent onRequestClose={() => setDetailsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailModal}>
            <View style={styles.detailModalHeader}>
              <Text style={styles.detailModalTitle}>{t("ui.library-snapshot")}</Text>
              <Pressable onPress={() => setDetailsOpen(false)} hitSlop={10} style={styles.modalClose}>
                <Ionicons name="close" size={18} color={colors.primary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailModalContent}>
              <Card style={[styles.hero, styles.modalHero]} tone="warm">
                <View style={styles.heroLeft}>
                  <Text style={styles.heroEyebrow}>{t("ui.reclaimed")}</Text>
                  <Text style={styles.heroFreed}>{freedDisplay}</Text>
                  <Text style={styles.heroSub}>{t("ui.home-of-possible", { value: potentialDisplay })}</Text>
                  <View style={styles.pillRow}>
                    <Pill icon="flame" value={String(streakOf(stats))} label={t("ui.streak")} tone="honey" />
                    <Pill icon="checkmark-done" value={String(stats.reviewed)} label={t("ui.reviewed")} tone="sage" />
                  </View>
                  <View style={styles.heroBreakdown}>
                    <BreakdownLine color={colors.sage} label={t("ui.trim")} value={formatMB(stats.trimMbFreed)} />
                    <BreakdownLine color={colors.danger} label={t("ui.delete")} value={formatMB(stats.deleteMbFreed)} />
                  </View>
                </View>
                <Animated.View style={{ transform: [{ translateY: floatY }] }}>
                  <ProgressRing
                    progress={ringProgress}
                    size={116}
                    thickness={10}
                    fillColor={colors.sage}
                    trackColor={colors.borderSoft}
                  >
                    <View style={styles.thumbStack}>
                      {heroThumbs.length === 0 ? (
                        <Ionicons name="images-outline" size={26} color={colors.primary} />
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
                            resizeMode="cover"
                          />
                        ))
                      )}
                    </View>
                    <Text style={styles.ringPct}>{Math.round(ringProgress * 100)}%</Text>
                  </ProgressRing>
                </Animated.View>
              </Card>
              <Card style={styles.healthCard}>
                <ProgressRing progress={healthScore / 100} size={82} thickness={8}>
                  <Text style={styles.healthValue}>{healthScore}</Text>
                  <Text style={styles.healthLabel}>{t("ui.score")}</Text>
                </ProgressRing>
                <View style={styles.healthCopy}>
                  <Text style={styles.goalTitle}>
                    {healthScore >= 82 ? t("ui.looking-tidy") : t("ui.easy-wins-are-waiting")}
                  </Text>
                  <Text style={styles.goalHint}>
                    {t("ui.home-projected-savings", { value: formatMB(projectedFreed) })}
                  </Text>
                </View>
              </Card>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
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
      <View style={styles.todayCompactStat}>
        <Ionicons name={icon} size={18} color={tint} />
        <Text style={[styles.todayValue, { color: tint }]}>{value}</Text>
      </View>
      <Text style={styles.todayLabel}>{label}</Text>
    </View>
  );
}

function BreakdownLine({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.breakdownLine}>
      <View style={[styles.breakdownDot, { backgroundColor: color }]} />
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={styles.breakdownValue}>{value}</Text>
    </View>
  );
}

function RecentList({ entries, onOpenRecentlyDeleted }: { entries: NativeActionLogEntry[]; onOpenRecentlyDeleted: () => void }) {
  if (entries.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <Ionicons name="sparkles-outline" size={20} color={colors.primaryBright} />
        <Text style={styles.emptyTitle}>{t("ui.no-activity-yet")}</Text>
        <Text style={styles.emptyHint}>{t("ui.tap-swipe-to-start-your-first-round")}</Text>
      </Card>
    );
  }
  return (
    <Card padded={false} style={{ overflow: "hidden" }}>
      {entries.map((e, i) => (
        <Pressable
          key={e.id}
          disabled={e.action !== "delete"}
          onPress={e.action === "delete" ? onOpenRecentlyDeleted : undefined}
          style={[styles.recentRow, i !== 0 && styles.recentRowDivider, e.action === "delete" && styles.recentRowAction]}
        >
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
              {e.mbFreed > 0 ? t("ui.home-saved", { value: formatMB(e.mbFreed) }) : t("ui.home-kept")} {t("ui.list-separator")}{" "}
              {timeAgo(e.createdAt)}
            </Text>
          </View>
          {e.action === "delete" ? (
            <View style={styles.restorePill}>
              <Ionicons name="refresh-outline" size={13} color={colors.danger} />
              <Text style={styles.restorePillText}>{t("ui.restore")}</Text>
            </View>
          ) : (
            <Ionicons
              name={e.action === "trim" ? "cut-outline" : "checkmark-outline"}
              size={16}
              color={colors.textSubtle}
            />
          )}
        </Pressable>
      ))}
    </Card>
  );
}

// Helpers

function formatMB(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return t("ui.0-mb");
  return value >= 1024
    ? t("ui.storage-gb", { value: (value / 1024).toFixed(2) })
    : t("ui.storage-mb", { value: value.toFixed(1) });
}
function formatThresholdMB(value: number): string {
  return t("ui.threshold-mb", { value: Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1) });
}
function ageYears(createdAt: number): number {
  return (Date.now() - createdAt) / (365.25 * 24 * 3600 * 1000);
}
function formatAgeThreshold(years: number): string {
  if (years < 1) {
    const months = Math.max(1, Math.round(years * 12));
    return t("ui.age-months", { count: months });
  }
  return t("ui.age-years", { count: Number.isInteger(years) ? years.toFixed(0) : years.toFixed(1) });
}
function estimateCategoryFromScan(scan: NativeLibraryScan, key: NativeCleanupCategory): { count: number; mb: number } {
  const map: Record<NativeCleanupCategory, { count: number; mb: number }> = {
    large: { count: scan.largeCount, mb: scan.largeSavingsMB },
    old: { count: scan.oldCount, mb: scan.oldSavingsMB },
    screenshots: { count: scan.screenshotCount, mb: scan.screenshotSavingsMB },
    live: { count: scan.livePhotoCount, mb: scan.livePhotoSavingsMB },
    duplicates: { count: scan.duplicateRemovalCount, mb: scan.duplicateDeleteSavingsMB },
    bursts: { count: scan.burstCount, mb: scan.burstDeleteSavingsMB },
    mistakes: { count: scan.mistakeCount, mb: scan.mistakeDeleteSavingsMB },
  };
  return map[key];
}
function libraryHealthScore(stats: NativeStats, scan: NativeLibraryScan | null, today: NativeDailyStats): number {
  const scanBurden = scan
    ? Math.min(32, (scan.deleteSavingsMB + scan.trimSavingsMB) / Math.max(1, scan.totalSizeMB) * 100)
    : 18;
  const momentum = Math.min(22, today.reviewed * 1.4 + streakOf(stats) * 3);
  const reclaimed = Math.min(24, stats.mbFreed / 80);
  return Math.round(Math.max(32, Math.min(99, 46 - scanBurden + momentum + reclaimed)));
}
function actionLabel(a: string) {
  if (a === "delete") return t("ui.action-deleted");
  if (a === "trim") return t("ui.action-trimmed");
  return t("ui.action-kept");
}
function timeAgo(iso: string) {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return t("ui.not-available");
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("ui.time-just-now");
  if (minutes < 60) return t("ui.time-minutes-ago", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("ui.time-hours-ago", { count: hours });
  const days = Math.floor(hours / 24);
  return t("ui.time-days-ago", { count: days });
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  tokenChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.honeySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.honey,
  },
  tokenChipValue: { fontWeight: "700", color: colors.honey, fontSize: 14 },
  adBanner: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.sageSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.sage,
  },
  adBannerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.white, alignItems: "center", justifyContent: "center",
  },
  adBannerTitle: { fontSize: 14, fontWeight: "800", color: colors.sageDeep },
  adBannerSub: { fontSize: 12, color: colors.sageDeep, fontWeight: "600", marginTop: 1 },


  hero: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  heroLeft: { flex: 1, gap: 4 },
  heroEyebrow: { ...type.eyebrow, color: colors.sageDeep },
  heroFreed: { ...type.display, color: colors.sageDeep, marginTop: 4 },
  heroSub: { ...type.body, color: colors.textMuted, marginTop: -2 },
  pillRow: { flexDirection: "row", gap: 8, marginTop: spacing.md, flexWrap: "wrap" },
  heroBreakdown: { marginTop: 4, gap: 4 },
  breakdownLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  breakdownDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownLabel: { flex: 1, fontSize: 11, fontWeight: "800", color: colors.textMuted },
  breakdownValue: { fontSize: 11, fontWeight: "700", color: colors.text },
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

  healthCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  healthCopy: { flex: 1, gap: 4 },
  healthValue: { color: colors.primary, fontSize: 24, fontWeight: "700" },
  healthLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  cleanupHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.dangerSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
    padding: spacing.lg,
    ...shadow.soft,
  },
  cleanupIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
  },
  cleanupTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  cleanupHint: { color: "#991b1b", fontSize: 12, fontWeight: "700", marginTop: 2 },
  optimizeCard: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.infoSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.info,
    padding: spacing.lg,
  },

  tileGrid: { gap: spacing.md },
  tileRow: { flexDirection: "row", gap: spacing.md },
  storageActionRow: { flexDirection: "row", gap: spacing.md },
  storageActionCard: {
    flex: 1,
    minHeight: 118,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.soft,
  },
  nukeActionCard: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  cloudActionCard: { backgroundColor: colors.infoSoft, borderColor: colors.info },
  storageActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  storageActionTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  storageActionHint: { color: colors.textMuted, fontSize: 11, fontWeight: "700", lineHeight: 15 },

  dailyGoalCard: { gap: spacing.md },
  dailyGoalTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  goalTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  goalHint: { marginTop: 2, fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  goalPercent: { color: colors.primary, fontSize: 22, fontWeight: "700" },
  goalTrack: {
    height: 10,
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.borderSoft,
  },
  goalFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  embeddedGoal: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
    gap: 7,
  },
  embeddedGoalTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  embeddedGoalTitle: { fontSize: 12, fontWeight: "700", color: colors.text },
  embeddedGoalValue: { fontSize: 12, fontWeight: "700", color: colors.primary },

  weeklyCard: { gap: spacing.lg },
  weeklyDays: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  weeklyDay: { flex: 1, alignItems: "center", gap: 6 },
  weeklyDot: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: colors.cardSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  weeklyDotDone: { backgroundColor: colors.sageSoft, borderColor: colors.sage },
  weeklyDotClaimed: { backgroundColor: colors.primary, borderColor: colors.primary },
  weeklyDotToday: { borderWidth: 2 },
  weeklyDotText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  weeklyDotTextActive: { color: colors.sageDeep },
  weeklyLabel: { fontSize: 10, color: colors.textMuted, fontWeight: "800" },
  weeklyFooter: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  claimButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  claimButtonDisabled: { backgroundColor: colors.border, opacity: 0.8 },
  claimButtonText: { color: colors.white, fontSize: 13, fontWeight: "700" },

  todayCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    ...shadow.card,
  },
  todayStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  todayStat: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  todayCompactStat: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  todayValue: { fontSize: 22, fontWeight: "700" },
  todayLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  todayDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: colors.border },

  sectionAction: { fontSize: 12, fontWeight: "700", color: colors.primary },

  recommendedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.soft,
  },
  recommendedIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  recommendedCopy: { flex: 1, gap: 3 },
  recommendedTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  recommendedHint: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  reviewButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reviewButtonText: { color: colors.primary, fontSize: 12, fontWeight: "700" },

  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: "rgba(15, 23, 42, 0.36)",
  },
  detailModal: {
    maxHeight: "86%",
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.card,
  },
  detailModalContent: { gap: spacing.md, paddingBottom: 2 },
  detailModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  detailModalTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  modalHero: { marginTop: 0 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },

  catScroll: { paddingRight: spacing.xl, gap: 12 },
  filterPanel: {
    marginBottom: spacing.md,
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.soft,
  },
  filterSlider: { gap: 8 },
  filterSliderHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  filterSliderLabel: { fontSize: 12, fontWeight: "700", color: colors.text },
  filterSliderValue: { fontSize: 12, fontWeight: "700", color: colors.primary },
  filterTrack: { height: 24, justifyContent: "center" },
  filterRail: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.borderSoft,
  },
  filterFill: {
    position: "absolute",
    left: 0,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  filterThumb: {
    position: "absolute",
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  filterRangeRow: { flexDirection: "row", justifyContent: "space-between" },
  filterRangeText: { fontSize: 10, fontWeight: "700", color: colors.textMuted },
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
  recentRowAction: { backgroundColor: "#f3f6f8" },
  recentRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
  },
  recentDot: { width: 10, height: 10, borderRadius: 5 },
  recentTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  recentMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: "600" },
  restorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: "#fee2e2",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  restorePillText: { color: colors.danger, fontSize: 11, fontWeight: "700" },

  emptyCard: { alignItems: "center", gap: 6, paddingVertical: spacing.xl },
  emptyTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  emptyHint: { fontSize: 12, color: colors.textMuted },
});
