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
  loadNativeStats,
  saveNativeStats,
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

const SWIPE_THRESHOLD = 110;

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

    commitStats((current) => ({
      ...current,
      sessions: current.sessions + 1,
    }));

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
      commitStats((current) => ({
        ...current,
        reviewed: current.reviewed + 1,
        kept: current.kept + 1,
      }));
      advance();
      return;
    }

    if (action === "delete") {
      session.deleted += 1;
      session.freed += photo.sizeMB;
      pendingDeletesRef.current = [...pendingDeletesRef.current, photo];
      setPendingDeletes(pendingDeletesRef.current);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      commitStats((current) => ({
        ...current,
        reviewed: current.reviewed + 1,
        deleted: current.deleted + 1,
        mbFreed: +(current.mbFreed + photo.sizeMB).toFixed(2),
      }));
      advance();
      return;
    }

    const estimated = estimateTrimSavings(photo);
    session.trimmed += 1;
    session.freed += estimated;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    commitStats((current) => ({
      ...current,
      reviewed: current.reviewed + 1,
      trimmed: current.trimmed + 1,
      mbFreed: +(current.mbFreed + estimated).toFixed(2),
    }));
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
    commitStats((current) => ({
      ...current,
      deleted: Math.max(0, current.deleted - photos.length),
      mbFreed: Math.max(0, current.mbFreed - photos.reduce((sum, photo) => sum + photo.sizeMB, 0)),
    }));
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
          <StatsScreen stats={stats} />
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
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>{queueCount} left</Text>
          <Text style={styles.focusText}>{targetLabel(settings)}</Text>
        </View>
        {trimmingCount > 0 ? <Text style={styles.trimBadge}>Trimming {trimmingCount}</Text> : null}
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

function StatsScreen({ stats }: { stats: NativeStats }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heroTitle}>Your cleanup</Text>
      <Text style={styles.muted}>Since {stats.startedAt}</Text>
      <View style={styles.bigStat}>
        <Text style={styles.bigStatValue}>{formatMB(stats.mbFreed)}</Text>
        <Text style={styles.muted}>Estimated storage freed</Text>
      </View>
      <View style={styles.statGrid}>
        <MiniStat label="Reviewed" value={stats.reviewed} />
        <MiniStat label="Kept" value={stats.kept} />
        <MiniStat label="Trimmed" value={stats.trimmed} />
        <MiniStat label="Deleted" value={stats.deleted} />
        <MiniStat label="Sessions" value={stats.sessions} />
      </View>
    </ScrollView>
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
    backgroundColor: "#0f172a",
  },
  shell: {
    flex: 1,
    backgroundColor: "#0f172a",
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  focusText: {
    marginTop: 4,
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
  },
  trimBadge: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#334155",
    color: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "700",
  },
  warning: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: "#78350f",
    color: "#ffedd5",
    padding: 12,
    fontSize: 12,
  },
  deck: {
    marginTop: 18,
    height: 500,
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
    borderRadius: 28,
    backgroundColor: "#1e293b",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#334155",
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
    borderRadius: 18,
    paddingVertical: 15,
    borderWidth: 1,
  },
  actionKeep: {
    backgroundColor: "#14532d",
    borderColor: "#22c55e",
  },
  actionTrim: {
    backgroundColor: "#2563eb",
    borderColor: "#60a5fa",
  },
  actionDelete: {
    backgroundColor: "#7f1d1d",
    borderColor: "#ef4444",
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
  bigStat: {
    marginTop: 18,
    marginBottom: 14,
    borderRadius: 24,
    backgroundColor: "#1e293b",
    padding: 22,
  },
  bigStatValue: {
    color: "#f8fafc",
    fontSize: 36,
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
