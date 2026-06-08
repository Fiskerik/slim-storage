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
  trimPhoto,
  type NativePhoto,
} from "../lib/native-photo-source";
import {
  DEFAULT_NATIVE_STATS,
  EMPTY_DAILY_STATS,
  loadNativeStats,
  saveNativeStats,
  type NativeDailyStats,
  type NativeSettings,
  type NativeStats,
} from "../lib/native-store";

type Screen = "swipe" | "stats" | "settings";
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
  if (settings.targetMode === "old-and-large") {
    return `${settings.minAgeYears}+ yrs and ${settings.minSizeMB}+ MB`;
  }
  return `${settings.minSizeMB}+ MB or ${settings.minAgeYears}+ yrs`;
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

function currentStreak(stats: NativeStats): number {
  let streak = 0;
  let cursor = new Date();

  while (dailyFor(stats, dateKey(cursor)).reviewed > 0) {
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

export function NativeTrimSwipeApp() {
  const [screen, setScreen] = useState<Screen>("swipe");
  const [stats, setStats] = useState<NativeStats>(DEFAULT_NATIVE_STATS);
  const [queue, setQueue] = useState<NativePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [permissionLimited, setPermissionLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recap, setRecap] = useState<SessionRecap | null>(null);
  const [pendingDeletes, setPendingDeletes] = useState<NativePhoto[]>([]);
  const [trimmingCount, setTrimmingCount] = useState(0);
  const sessionRef = useRef<SessionRecap>({ kept: 0, trimmed: 0, deleted: 0, freed: 0 });
  const pendingDeletesRef = useRef<NativePhoto[]>([]);

  const settings = roundSettings(stats.settings);
  const top = queue[0];
  const next = queue[1];

  useEffect(() => {
    let cancelled = false;
    loadNativeStats().then((loaded) => {
      if (cancelled) return;
      setStats(loaded);
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

  async function loadRound() {
    setLoading(true);
    setError(null);
    setRecap(null);
    setPendingDeletes([]);
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
      const photos = await loadPhotoRound(settings.cardsPerRound, settings);
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
    void loadRound();
    // Run once after initial settings load. Manual reload picks up later settings changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.startedAt]);

  function finishIfNeeded(rest: NativePhoto[]) {
    if (rest.length > 0) return;

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

    setRecap({ ...sessionRef.current });
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
        withDailyActivity(
          {
            ...current,
            reviewed: current.reviewed + 1,
            kept: current.kept + 1,
          },
          { reviewed: 1, kept: 1 },
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
      );
      advance();
      return;
    }

    const estimated = estimateTrimSavings(photo);
    session.trimmed += 1;
    session.freed += estimated;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    commitStats((current) =>
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.shell}>
        {screen === "swipe" ? (
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
            onAction={handleAction}
            onReload={loadRound}
            onOpenSettings={() => Linking.openSettings()}
            onConfirmDeletes={confirmDeletes}
            onUndoDeletes={undoPendingDeletes}
          />
        ) : screen === "stats" ? (
          <StatsScreen
            stats={stats}
            onStartRound={() => {
              setScreen("swipe");
              void loadRound();
            }}
            onOpenSettings={() => setScreen("settings")}
          />
        ) : (
          <SettingsScreen settings={settings} onChange={updateSettings} onReload={loadRound} />
        )}
        <BottomNav screen={screen} onChange={setScreen} />
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
  onAction,
  onReload,
  onOpenSettings,
  onConfirmDeletes,
  onUndoDeletes,
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
  onAction: (photo: NativePhoto, action: Action) => void;
  onReload: () => void;
  onOpenSettings: () => void;
  onConfirmDeletes: (photos: NativePhoto[]) => void;
  onUndoDeletes: () => void;
}) {
  if (loading) {
    return (
      <Centered>
        <ActivityIndicator color="#f8fafc" size="large" />
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
    return <Recap recap={recap} onNext={onReload} />;
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
          <Text style={styles.swipeTitle}>{targetLabel(settings)}</Text>
          <Text style={styles.swipeSubtitle}>A cleaner set of photos, one quick decision at a time.</Text>
        </View>
        <View style={styles.swipeStatusColumn}>
          <Text style={styles.queuePill}>{queueCount} left</Text>
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
        <ActionButton label="Keep" tone="keep" onPress={() => top && onAction(top, "keep")} />
        <ActionButton label="Trim" tone="trim" onPress={() => top && onAction(top, "trim")} />
        <ActionButton label="Delete" tone="delete" onPress={() => top && onAction(top, "delete")} />
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

function Recap({ recap, onNext }: { recap: SessionRecap; onNext: () => void }) {
  const total = recap.kept + recap.trimmed + recap.deleted;
  return (
    <Centered>
      <Text style={styles.heroTitle}>Set complete</Text>
      <Text style={styles.centerText}>
        You reviewed {total} photos and freed about {formatMB(recap.freed)}.
      </Text>
      <View style={styles.statGrid}>
        <MiniStat label="Kept" value={recap.kept} />
        <MiniStat label="Trimmed" value={recap.trimmed} />
        <MiniStat label="Deleted" value={recap.deleted} />
      </View>
      <PrimaryButton label="New set" onPress={onNext} />
    </Centered>
  );
}

function StatsScreen({
  stats,
  onStartRound,
  onOpenSettings,
}: {
  stats: NativeStats;
  onStartRound: () => void;
  onOpenSettings: () => void;
}) {
  const today = dailyFor(stats, dateKey());
  const week = sumDays(stats, 7);
  const streak = currentStreak(stats);
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
        <QuickActionButton label="Tune focus" detail="Big, old, or balanced" onPress={onOpenSettings} />
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
        label="Swipe focus"
        value={settings.targetMode}
        options={[
          ["big-or-old", "Big or old"],
          ["old-and-large", "Old + large"],
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
      <PrimaryButton label="Reload with these settings" onPress={onReload} />
    </ScrollView>
  );
}

function BottomNav({ screen, onChange }: { screen: Screen; onChange: (screen: Screen) => void }) {
  return (
    <View style={styles.bottomNav}>
      <NavButton label="Swipe" active={screen === "swipe"} onPress={() => onChange("swipe")} />
      <NavButton label="Progress" active={screen === "stats"} onPress={() => onChange("stats")} />
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
}: {
  label: string;
  tone: "keep" | "trim" | "delete";
  onPress: () => void;
}) {
  const toneStyle =
    tone === "keep" ? styles.actionKeep : tone === "trim" ? styles.actionTrim : styles.actionDelete;

  return (
    <Pressable onPress={onPress} style={[styles.actionButton, toneStyle]}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({
  label,
  danger,
  onPress,
}: {
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.primaryButton, danger && styles.dangerButton]}>
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
    backgroundColor: "#07111f",
  },
  shell: {
    flex: 1,
    backgroundColor: "#07111f",
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
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0,
  },
  muted: {
    color: "#94a3b8",
    fontSize: 14,
  },
  mutedSmall: {
    color: "#94a3b8",
    fontSize: 12,
  },
  centerText: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  swipeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    borderRadius: 22,
    backgroundColor: "#0f1b2d",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#243247",
    padding: 16,
  },
  swipeHeaderCopy: {
    flex: 1,
  },
  swipeTitle: {
    marginTop: 5,
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
  },
  swipeSubtitle: {
    marginTop: 5,
    color: "#94a3b8",
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
    backgroundColor: "#e0f2fe",
    color: "#075985",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "900",
  },
  eyebrow: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  trimBadge: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#172554",
    color: "#bfdbfe",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "700",
  },
  warning: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: "#4a2c0f",
    color: "#ffedd5",
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
    backgroundColor: "#111c2e",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#243247",
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
    backgroundColor: "rgba(2, 6, 23, 0.22)",
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
  actionKeep: {
    backgroundColor: "#0f2a1d",
    borderColor: "#15803d",
  },
  actionTrim: {
    backgroundColor: "#10214f",
    borderColor: "#2563eb",
  },
  actionDelete: {
    backgroundColor: "#351417",
    borderColor: "#b91c1c",
  },
  actionText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "900",
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
    backgroundColor: "#1e293b",
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
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "800",
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
    backgroundColor: "#1e293b",
    padding: 16,
  },
  miniStatValue: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "900",
  },
  dashboardContent: {
    gap: 14,
  },
  dashboardHero: {
    borderRadius: 24,
    backgroundColor: "#0f1b2d",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#243247",
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
    backgroundColor: "#e0f2fe",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  healthValue: {
    color: "#075985",
    fontSize: 27,
    fontWeight: "900",
  },
  healthLabel: {
    color: "#0369a1",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  dashboardCopy: {
    color: "#cbd5e1",
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
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
  },
  levelProgress: {
    flex: 1,
    gap: 7,
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
  },
  quickAction: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#111c2e",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#243247",
    padding: 14,
    gap: 5,
  },
  quickActionLabel: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "900",
  },
  quickActionDetail: {
    color: "#94a3b8",
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
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
  },
  sectionDetail: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#233048",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#38bdf8",
  },
  progressTrim: {
    backgroundColor: "#60a5fa",
  },
  progressDelete: {
    backgroundColor: "#f87171",
  },
  challengeCard: {
    borderRadius: 20,
    backgroundColor: "#0f1b2d",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#243247",
    padding: 16,
    gap: 11,
  },
  challengeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  challengeTitle: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "900",
  },
  challengeValue: {
    color: "#bae6fd",
    fontSize: 16,
    fontWeight: "900",
  },
  impactPanel: {
    borderRadius: 20,
    backgroundColor: "#0f1b2d",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#243247",
    padding: 16,
    gap: 15,
  },
  impactHeader: {
    gap: 3,
  },
  impactValue: {
    color: "#f8fafc",
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
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "800",
  },
  impactAmount: {
    color: "#f8fafc",
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
    backgroundColor: "#111c2e",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#243247",
    padding: 15,
  },
  metricValue: {
    color: "#f8fafc",
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
    backgroundColor: "#0f1b2d",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#243247",
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
    backgroundColor: "#17243a",
  },
  activityBar: {
    width: "100%",
    borderRadius: 999,
    backgroundColor: "#38bdf8",
  },
  activityLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "800",
  },
  activityValue: {
    color: "#f8fafc",
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
    backgroundColor: "#111827",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#243247",
    padding: 14,
    gap: 9,
    opacity: 0.78,
  },
  achievementUnlocked: {
    backgroundColor: "#102a1d",
    borderColor: "#166534",
    opacity: 1,
  },
  achievementStatus: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#233048",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  achievementStatusText: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  achievementTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "900",
  },
  settingCard: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: "#1e293b",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  settingCardVertical: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: "#1e293b",
    padding: 16,
    gap: 12,
  },
  settingLabel: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "700",
  },
  settingValue: {
    marginTop: 4,
    color: "#f8fafc",
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
    backgroundColor: "#334155",
  },
  stepperText: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "900",
  },
  segmented: {
    flexDirection: "row",
    gap: 8,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#334155",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  segmentActive: {
    backgroundColor: "#2563eb",
  },
  segmentText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "800",
  },
  segmentTextActive: {
    color: "#f8fafc",
  },
  primaryButton: {
    width: "100%",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#2563eb",
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  dangerButton: {
    backgroundColor: "#dc2626",
  },
  primaryButtonText: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    width: "100%",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: "#cbd5e1",
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
    backgroundColor: "rgba(15, 23, 42, 0.94)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#334155",
    padding: 8,
  },
  navButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 11,
  },
  navButtonActive: {
    backgroundColor: "#f8fafc",
  },
  navText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "900",
  },
  navTextActive: {
    color: "#0f172a",
  },
});
