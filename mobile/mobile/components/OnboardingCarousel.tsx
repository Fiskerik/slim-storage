import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, radius, shadow, spacing, type } from "../constants/design";
import { PageDots, ProgressRing } from "./ui/primitives";
import type {
  NativeLibraryScan,
  NativeLibraryScanProgress,
} from "../lib/native-photo-source";

export type OnboardingCarouselProps = {
  scan: NativeLibraryScan | null;
  scanBusy: boolean;
  scanError: string | null;
  scanProgress: NativeLibraryScanProgress | null;
  permissionDenied: boolean;
  permissionLimited: boolean;
  onScan: () => void;
  onDone: () => void;
};

const SLIDES = 4;

export function OnboardingCarousel({
  scan,
  scanBusy,
  scanError,
  scanProgress,
  permissionDenied,
  permissionLimited,
  onScan,
  onDone,
}: OnboardingCarouselProps) {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const width = Dimensions.get("window").width;

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(SLIDES - 1, next));
    void Haptics.selectionAsync();
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
    setIndex(clamped);
  };

  const last = index === SLIDES - 1;

  return (
    <View style={styles.flex}>
      <View style={styles.topBar}>
        <Text style={type.eyebrow}>Welcome</Text>
        {!last ? (
          <Pressable onPress={onDone} hitSlop={10}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          if (i !== index) {
            setIndex(i);
            void Haptics.selectionAsync();
          }
        }}
        style={styles.flex}
      >
        <SlideHero width={width} />
        <SlideBeforeAfter width={width} />
        <SlideGestures width={width} />
        <SlideScan
          width={width}
          scan={scan}
          scanBusy={scanBusy}
          scanError={scanError}
          scanProgress={scanProgress}
          permissionDenied={permissionDenied}
          permissionLimited={permissionLimited}
          onScan={onScan}
        />
      </ScrollView>

      <View style={styles.bottomBar}>
        <PageDots count={SLIDES} index={index} />
        <View style={styles.bottomActions}>
          <Pressable
            onPress={() => goTo(index - 1)}
            disabled={index === 0}
            style={[styles.navBtn, index === 0 && { opacity: 0 }]}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          {!last ? (
            <Pressable onPress={() => goTo(index + 1)} style={styles.nextBtn}>
              <Text style={styles.nextText}>Next</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.white} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onDone();
              }}
              style={styles.nextBtn}
            >
              <Text style={styles.nextText}>Get started</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.white} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Slides ──────────────────────────────────────────────────────────────────

function SlideHero({ width }: { width: number }) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [float]);
  const y = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  return (
    <View style={[styles.slide, { width }]}>
      <Animated.View style={[styles.heroIcon, { transform: [{ translateY: y }] }]}>
        <Ionicons name="cut" size={72} color={colors.primary} />
      </Animated.View>
      <Text style={styles.slideTitle}>Meet TrimSwipe</Text>
      <Text style={styles.slideBody}>
        Slim your camera roll with quick swipes. Keep what matters, trim metadata, delete the clutter — all on-device.
      </Text>
    </View>
  );
}

function SlideBeforeAfter({ width }: { width: number }) {
  const before = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(before, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.delay(500),
        Animated.timing(before, { toValue: 0, duration: 600, useNativeDriver: false }),
      ]),
    ).start();
  }, [before]);
  const num = before.interpolate({ inputRange: [0, 1], outputRange: [12.4, 8.9] });
  return (
    <View style={[styles.slide, { width }]}>
      <ProgressRing progress={0.7} size={180} thickness={14}>
        <View style={{ alignItems: "center" }}>
          <Animated.Text style={styles.bigGB}>
            {/* RN can't directly interpolate text — bind via listener pattern */}
            <BeforeAfterNumber anim={num} />
          </Animated.Text>
          <Text style={styles.bigGBLabel}>GB used</Text>
        </View>
      </ProgressRing>
      <Text style={[styles.slideTitle, { marginTop: spacing.xxl }]}>Reclaim real space</Text>
      <Text style={styles.slideBody}>
        Trim strips bulky metadata. Delete clears the heaviest mistakes. Watch your gigabytes shrink as you go.
      </Text>
    </View>
  );
}

function BeforeAfterNumber({ anim }: { anim: Animated.AnimatedInterpolation<number> }) {
  const [value, setValue] = useState("12.4");
  useEffect(() => {
    const id = anim.addListener((s) => setValue(s.value.toFixed(1)));
    return () => anim.removeListener(id);
  }, [anim]);
  return <>{value}</>;
}

function SlideGestures({ width }: { width: number }) {
  return (
    <View style={[styles.slide, { width }]}>
      <View style={styles.gestureCard}>
        <View style={styles.gestureRow}>
          <GestureLabel icon="arrow-back-outline" tint={colors.sage} label="Swipe left" hint="Keep" />
          <GestureLabel icon="arrow-up-outline" tint={colors.honey} label="Swipe up" hint="Trim" />
          <GestureLabel icon="arrow-forward-outline" tint={colors.danger} label="Swipe right" hint="Delete" />
        </View>
        <View style={styles.fakePhoto}>
          <Ionicons name="image" size={42} color={colors.primary} />
          <Text style={styles.fakePhotoLabel}>One decision per photo</Text>
        </View>
      </View>
      <Text style={[styles.slideTitle, { marginTop: spacing.xxl }]}>Swipe to decide</Text>
      <Text style={styles.slideBody}>
        Three swipes, three outcomes. Or tap the buttons — whatever feels faster for you.
      </Text>
    </View>
  );
}

function GestureLabel({
  icon,
  tint,
  label,
  hint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  hint: string;
}) {
  return (
    <View style={styles.gestureItem}>
      <View style={[styles.gestureIcon, { backgroundColor: tint + "22" }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={[styles.gestureLabel, { color: tint }]}>{hint}</Text>
      <Text style={styles.gestureHint}>{label}</Text>
    </View>
  );
}

function SlideScan({
  width,
  scan,
  scanBusy,
  scanError,
  scanProgress,
  permissionDenied,
  permissionLimited,
  onScan,
}: {
  width: number;
} & Pick<
  OnboardingCarouselProps,
  "scan" | "scanBusy" | "scanError" | "scanProgress" | "permissionDenied" | "permissionLimited" | "onScan"
>) {
  const progressText = scanProgress?.total
    ? `Scanning ${scanProgress.scanned}/${scanProgress.total}…`
    : scanProgress
      ? `Scanning ${scanProgress.scanned}…`
      : "Scanning…";

  return (
    <ScrollView contentContainerStyle={[styles.slide, { width }]}>
      <View style={styles.scanIcon}>
        <Ionicons name="search" size={42} color={colors.primary} />
      </View>
      <Text style={styles.slideTitle}>Scan your library</Text>
      <Text style={styles.slideBody}>
        We estimate how much space you can reclaim — entirely on-device. Nothing leaves your phone.
      </Text>

      {scan ? (
        <View style={styles.scanResultCard}>
          <View style={styles.scanResultRow}>
            <Text style={styles.scanResultBig}>{formatMB(scan.totalSizeMB)}</Text>
            <Text style={styles.scanResultLabel}>Photos use</Text>
          </View>
          <View style={styles.scanSplit}>
            <ScanSplit label="Trim can save" value={formatMB(scan.trimSavingsMB)} tone={colors.sage} />
            <ScanSplit label="Delete can save" value={formatMB(scan.deleteSavingsMB)} tone={colors.danger} />
          </View>
        </View>
      ) : null}

      {permissionLimited ? (
        <Text style={styles.warn}>Limited photo access is enabled — some photos may be hidden.</Text>
      ) : null}
      {scanError ? <Text style={styles.warn}>{scanError}</Text> : null}

      <Pressable disabled={scanBusy} onPress={onScan} style={[styles.scanBtn, scanBusy && { opacity: 0.6 }]}>
        {scanBusy ? <ActivityIndicator color={colors.white} /> : <Ionicons name="flash" size={18} color={colors.white} />}
        <Text style={styles.scanBtnText}>{scanBusy ? progressText : scan ? "Scan again" : "Scan now"}</Text>
      </Pressable>

      {permissionDenied ? (
        <Pressable onPress={() => Linking.openSettings()} style={styles.linkBtn}>
          <Text style={styles.linkText}>Open iOS Settings</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function ScanSplit({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={[styles.scanSplitItem, { borderColor: tone + "55" }]}>
      <Text style={[styles.scanSplitValue, { color: tone }]}>{value}</Text>
      <Text style={styles.scanSplitLabel}>{label}</Text>
    </View>
  );
}

function formatMB(v: number) {
  if (!Number.isFinite(v) || v <= 0) return "0 MB";
  return v >= 1024 ? `${(v / 1024).toFixed(2)} GB` : `${v.toFixed(0)} MB`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  skip: { fontSize: 13, fontWeight: "700", color: colors.textMuted },

  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxl,
    gap: spacing.md,
  },
  heroIcon: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  slideTitle: { ...type.display, color: colors.text, textAlign: "center", marginTop: spacing.lg },
  slideBody: { ...type.body, color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing.md },

  bigGB: { fontSize: 28, fontWeight: "900", color: colors.primary },
  bigGBLabel: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 1.2 },

  gestureCard: {
    width: "100%",
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadow.card,
  },
  gestureRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  gestureItem: { flex: 1, alignItems: "center", gap: 4 },
  gestureIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  gestureLabel: { fontSize: 13, fontWeight: "900" },
  gestureHint: { fontSize: 10, color: colors.textMuted, fontWeight: "700", textAlign: "center" },
  fakePhoto: {
    height: 140,
    borderRadius: radius.md,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fakePhotoLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "700" },

  scanIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  scanResultCard: {
    width: "100%",
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadow.soft,
    marginTop: spacing.md,
  },
  scanResultRow: { alignItems: "center" },
  scanResultBig: { fontSize: 28, fontWeight: "900", color: colors.text },
  scanResultLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },

  scanSplit: { flexDirection: "row", gap: spacing.sm },
  scanSplitItem: { flex: 1, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, alignItems: "center", gap: 2, backgroundColor: colors.backgroundAlt },
  scanSplitValue: { fontSize: 16, fontWeight: "900" },
  scanSplitLabel: { fontSize: 10, color: colors.textMuted, fontWeight: "700", textAlign: "center" },

  warn: {
    width: "100%",
    backgroundColor: colors.honeySoft,
    color: "#92400e",
    fontSize: 12,
    fontWeight: "700",
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },

  scanBtn: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: spacing.xxl,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.press,
  },
  scanBtnText: { color: colors.white, fontWeight: "900", letterSpacing: 0.3 },
  linkBtn: { marginTop: spacing.sm },
  linkText: { color: colors.primary, fontWeight: "800", textDecorationLine: "underline" },

  bottomBar: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  bottomActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.press,
  },
  nextText: { color: colors.white, fontWeight: "900", letterSpacing: 0.3 },
});
