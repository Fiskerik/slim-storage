import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { colors, radius, spacing } from "../../constants/design";

export function CleanupSkeleton({ rows = 1, style }: { rows?: number; style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    shimmer.value = withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never });
    return () => {
      shimmer.value = 0;
    };
  }, [reducedMotion, shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 0.55 : 0.35 + shimmer.value * 0.35,
    transform: [{ translateX: shimmer.value * 26 - 13 }],
  }));

  return (
    <View style={[styles.container, style]} accessibilityElementsHidden>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.row}>
          <View style={styles.image}>
            <Animated.View pointerEvents="none" style={[styles.shimmer, shimmerStyle]} />
          </View>
          <View style={styles.copy}>
            <View style={[styles.line, styles.lineLong]} />
            <View style={[styles.line, styles.lineShort]} />
            <View style={[styles.line, styles.lineTiny]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", gap: spacing.sm },
  row: { minHeight: 88, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  image: { width: 72, height: 72, overflow: "hidden", borderRadius: radius.sm, backgroundColor: colors.borderSoft },
  copy: { flex: 1, gap: 9 },
  line: { height: 10, borderRadius: 5, backgroundColor: colors.borderSoft },
  lineLong: { width: "84%" },
  lineShort: { width: "64%" },
  lineTiny: { width: "42%", height: 7 },
  shimmer: { position: "absolute", top: -12, bottom: -12, left: "35%", width: 22, backgroundColor: colors.white, transform: [{ rotate: "16deg" }] },
});
