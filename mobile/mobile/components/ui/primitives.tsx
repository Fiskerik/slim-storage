import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { colors, radius, shadow, spacing, type, motion } from "../../constants/design";

// ─── Card ────────────────────────────────────────────────────────────────────

export function Card({
  children,
  style,
  tone = "default",
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: "default" | "soft" | "warm";
  padded?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        tone === "soft" && { backgroundColor: colors.cardSoft, borderColor: colors.borderSoft },
        tone === "warm" && { backgroundColor: "#fff1e3", borderColor: colors.border },
        padded && { padding: spacing.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ─── Pill / chip ─────────────────────────────────────────────────────────────

export function Pill({
  icon,
  label,
  value,
  tone = "primary",
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  value: string;
  tone?: "primary" | "sage" | "honey" | "danger" | "neutral";
}) {
  const palette = {
    primary: { bg: colors.primarySoft, fg: colors.primary },
    sage: { bg: colors.sageSoft, fg: colors.sageDeep },
    honey: { bg: colors.honeySoft, fg: "#92400e" },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    neutral: { bg: "#f1f5f9", fg: "#334155" },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      {icon ? <Ionicons name={icon} size={14} color={palette.fg} /> : null}
      <Text style={[styles.pillValue, { color: palette.fg }]}>{value}</Text>
      {label ? <Text style={[styles.pillLabel, { color: palette.fg }]}>{label}</Text> : null}
    </View>
  );
}

// ─── IconTile (big tap target) ───────────────────────────────────────────────

export function IconTile({
  icon,
  label,
  hint,
  bg,
  accent,
  onPress,
  large,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  bg: string;
  accent: string;
  onPress: () => void;
  large?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
      style={{ flex: large ? undefined : 1, minWidth: large ? "100%" : 0 }}
    >
      <Animated.View
        style={[
          styles.iconTile,
          { backgroundColor: bg, transform: [{ scale }] },
          large && styles.iconTileLarge,
        ]}
      >
        <View
          style={[
            styles.iconTileBubble,
            { backgroundColor: "rgba(255,255,255,0.55)", borderColor: accent + "33" },
          ]}
        >
          <Ionicons name={icon} size={large ? 28 : 22} color={accent} />
        </View>
        <Text style={[styles.iconTileLabel, { color: accent }]}>{label}</Text>
        {hint ? <Text style={styles.iconTileHint}>{hint}</Text> : null}
      </Animated.View>
    </Pressable>
  );
}

// ─── ProgressRing (animated, no SVG) ─────────────────────────────────────────
// Two half-circles clipped, rotated by progress * 360.

export function ProgressRing({
  progress,
  size = 132,
  thickness = 12,
  trackColor = "#fde6cf",
  fillColor = colors.primaryBright,
  children,
}: {
  progress: number; // 0..1
  size?: number;
  thickness?: number;
  trackColor?: string;
  fillColor?: string;
  children?: ReactNode;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const clamped = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: clamped,
      duration: motion.ring,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, clamped]);

  const rotateFirst = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0deg", "180deg", "180deg"],
  });
  const rotateSecond = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0deg", "0deg", "180deg"],
  });

  const half = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Track */}
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: thickness,
          borderColor: trackColor,
        }}
      />
      {/* Two halves */}
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          overflow: "hidden",
        }}
      >
        <View style={{ position: "absolute", width: half, height: size, left: 0, overflow: "hidden" }}>
          <Animated.View
            style={{
              position: "absolute",
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: thickness,
              borderColor: "transparent",
              borderTopColor: fillColor,
              borderRightColor: fillColor,
              left: 0,
              transform: [{ rotate: "-135deg" }, { rotate: rotateFirst }],
            }}
          />
        </View>
        <View style={{ position: "absolute", width: half, height: size, right: 0, overflow: "hidden" }}>
          <Animated.View
            style={{
              position: "absolute",
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: thickness,
              borderColor: "transparent",
              borderTopColor: fillColor,
              borderRightColor: fillColor,
              right: 0,
              transform: [{ rotate: "45deg" }, { rotate: rotateSecond }],
            }}
          />
        </View>
      </View>
      <View style={{ alignItems: "center", justifyContent: "center" }}>{children}</View>
    </View>
  );
}

// ─── Animated bar chart ──────────────────────────────────────────────────────

export function BarChart({
  data,
  height = 120,
  maxValue,
}: {
  data: { label: string; value: number; sub?: number; tone?: "trim" | "delete" | "mixed" }[];
  height?: number;
  maxValue?: number;
}) {
  const top = Math.max(1, maxValue ?? Math.max(...data.map((d) => d.value), 1));
  return (
    <View style={[styles.chart, { height: height + 28 }]}>
      {data.map((d) => (
        <BarColumn key={d.label} label={d.label} value={d.value} sub={d.sub} max={top} height={height} tone={d.tone} />
      ))}
    </View>
  );
}

function BarColumn({
  label,
  value,
  sub,
  max,
  height,
  tone = "mixed",
}: {
  label: string;
  value: number;
  sub?: number;
  max: number;
  height: number;
  tone?: "trim" | "delete" | "mixed";
}) {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, {
      toValue: 1,
      duration: motion.slow,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [grow, value, max]);
  const target = Math.max(0, Math.min(1, value / max));
  const barH = grow.interpolate({ inputRange: [0, 1], outputRange: [0, target * height] });
  const subTarget = sub != null ? Math.max(0, Math.min(target, sub / max)) : 0;
  const subH = grow.interpolate({ inputRange: [0, 1], outputRange: [0, subTarget * height] });
  const color =
    tone === "trim" ? colors.sage : tone === "delete" ? colors.danger : colors.primaryBright;
  return (
    <View style={styles.chartCol}>
      <View style={[styles.chartTrack, { height }]}>
        <Animated.View
          style={[styles.chartBar, { height: barH, backgroundColor: color + "55", borderColor: color }]}
        />
        {sub != null ? (
          <Animated.View
            style={[styles.chartBar, { height: subH, backgroundColor: color }]}
          />
        ) : null}
      </View>
      <Text style={styles.chartLabel}>{label}</Text>
    </View>
  );
}

// ─── Donut (trim vs delete share) ────────────────────────────────────────────

export function DonutSplit({
  trim,
  del,
  size = 120,
  thickness = 16,
}: {
  trim: number;
  del: number;
  size?: number;
  thickness?: number;
}) {
  const total = trim + del;
  const trimShare = total > 0 ? trim / total : 0;
  return (
    <ProgressRing
      progress={trimShare}
      size={size}
      thickness={thickness}
      trackColor={colors.danger + "55"}
      fillColor={colors.sage}
    >
      <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
        {Math.round(trimShare * 100)}%
      </Text>
      <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "700" }}>TRIM</Text>
    </ProgressRing>
  );
}

// ─── BeforeAfterSlider (no SVG) ──────────────────────────────────────────────

export function BeforeAfterSlider({
  beforeUri,
  afterUri,
  width,
  height,
  savedLabel,
}: {
  beforeUri: string;
  afterUri?: string;
  width: number;
  height: number;
  savedLabel?: string;
}) {
  const splitX = useRef(new Animated.Value(width / 2)).current;
  const lastX = useRef(width / 2);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          splitX.stopAnimation((v) => (lastX.current = v));
        },
        onPanResponderMove: (_, g) => {
          const next = Math.max(20, Math.min(width - 20, lastX.current + g.dx));
          splitX.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          lastX.current = Math.max(20, Math.min(width - 20, lastX.current + g.dx));
        },
      }),
    [splitX, width],
  );

  return (
    <View
      {...responder.panHandlers}
      style={{
        width,
        height,
        borderRadius: radius.lg,
        overflow: "hidden",
        backgroundColor: colors.cardSoft,
      }}
    >
      <Image source={{ uri: afterUri ?? beforeUri }} style={{ width, height }} contentFit="cover" />
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height,
          width: splitX,
          overflow: "hidden",
          borderRightWidth: 2,
          borderRightColor: colors.white,
        }}
      >
        <Image source={{ uri: beforeUri }} style={{ width, height }} contentFit="cover" />
        <View style={[styles.sliderBadge, { left: 12 }]}>
          <Text style={styles.sliderBadgeText}>Before</Text>
        </View>
      </Animated.View>
      <View style={[styles.sliderBadge, { right: 12, top: 12 }]}>
        <Text style={styles.sliderBadgeText}>After</Text>
        {savedLabel ? <Text style={styles.sliderSaved}>{savedLabel}</Text> : null}
      </View>
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: Animated.subtract(splitX, new Animated.Value(18)) as unknown as number,
          height,
          width: 36,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View style={styles.sliderHandle}>
          <Ionicons name="code-outline" size={18} color={colors.primary} />
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

export function Skeleton({ width, height, radius: r = radius.md }: { width: number | string; height: number; radius?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(a, { toValue: 0, duration: 800, useNativeDriver: false }),
      ]),
    ).start();
  }, [a]);
  const bg = a.interpolate({ inputRange: [0, 1], outputRange: ["#f1f5f9", "#e2e8f0"] });
  return <Animated.View style={{ width: width as number, height, borderRadius: r, backgroundColor: bg }} />;
}

// ─── PageDots ────────────────────────────────────────────────────────────────

export function PageDots({ count, index }: { count: number; index: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === index && styles.dotActive,
          ]}
        />
      ))}
    </View>
  );
}

// ─── FAB ─────────────────────────────────────────────────────────────────────

export function FAB({
  icon,
  onPress,
  label,
  bottom = 96,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label?: string;
  bottom?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPressIn={() => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
      onPress={onPress}
      style={[styles.fabWrap, { bottom }]}
    >
      <Animated.View style={[styles.fab, { transform: [{ scale }] }]}>
        <Ionicons name={icon} size={22} color={colors.white} />
        {label ? <Text style={styles.fabLabel}>{label}</Text> : null}
      </Animated.View>
    </Pressable>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      {action}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.soft,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  pillValue: { fontSize: 13, fontWeight: "800" },
  pillLabel: { fontSize: 11, fontWeight: "700", opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.6 },

  iconTile: {
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: "flex-start",
    gap: spacing.sm,
    minHeight: 110,
    justifyContent: "space-between",
    ...shadow.soft,
  },
  iconTileLarge: {
    paddingVertical: spacing.xl,
    minHeight: 140,
  },
  iconTileBubble: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconTileLabel: { fontSize: 16, fontWeight: "800" },
  iconTileHint: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },

  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  chartCol: { flex: 1, alignItems: "center", gap: 6 },
  chartTrack: {
    width: "100%",
    backgroundColor: "#fff7ed",
    borderRadius: radius.sm,
    justifyContent: "flex-end",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSoft,
  },
  chartBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    borderWidth: 0,
  },
  chartLabel: { fontSize: 10, color: colors.textMuted, fontWeight: "700", letterSpacing: 0.4 },

  sliderHandle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  sliderBadge: {
    position: "absolute",
    top: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    borderRadius: radius.pill,
  },
  sliderBadgeText: { color: colors.white, fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  sliderSaved: { color: colors.honeySoft, fontSize: 10, fontWeight: "800" },

  dotsRow: { flexDirection: "row", gap: 6, justifyContent: "center" },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.primaryBright,
  },

  fabWrap: {
    position: "absolute",
    right: 18,
    zIndex: 50,
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.press,
  },
  fabLabel: { color: colors.white, fontWeight: "800", fontSize: 13, letterSpacing: 0.3 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionHeaderTitle: type.subtitle,
});
