import { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { colors, radius, spacing } from "../../constants/design";

export type ApplyStatus = "idle" | "applying" | "success" | "warning" | "failed";

type Props = {
  status: ApplyStatus;
  label: string;
  applyingLabel: string;
  successLabel?: string;
  warningLabel?: string;
  failedLabel?: string;
  disabled?: boolean;
  danger?: boolean;
  onPress: () => void;
};

export function ApplyStatusButton({
  status,
  label,
  applyingLabel,
  successLabel = label,
  warningLabel = label,
  failedLabel = label,
  disabled,
  danger,
  onPress,
}: Props) {
  const reducedMotion = useReducedMotion();
  const iconProgress = useSharedValue(status === "idle" ? 0 : 1);
  useEffect(() => {
    iconProgress.value = withTiming(status === "idle" ? 0 : 1, { duration: reducedMotion ? 120 : 180, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
  }, [iconProgress, reducedMotion, status]);
  const iconStyle = useAnimatedStyle(() => ({
    opacity: 0.86 + iconProgress.value * 0.14,
    transform: [{ scale: 0.82 + iconProgress.value * 0.18 }],
  }));
  const icon = status === "success" ? "checkmark" : status === "warning" ? "warning-outline" : status === "failed" ? "alert-circle-outline" : null;
  const text = status === "applying" ? applyingLabel : status === "success" ? successLabel : status === "warning" ? warningLabel : status === "failed" ? failedLabel : label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || status === "applying" }}
      disabled={disabled || status === "applying"}
      onPress={onPress}
      style={({ pressed }) => [styles.button, danger && styles.danger, pressed && styles.pressed, (disabled || status === "applying") && styles.disabled]}
    >
      {status === "applying" ? <ActivityIndicator color={colors.white} size="small" /> : icon ? <Animated.View style={iconStyle}><Ionicons name={icon} size={19} color={colors.white} /></Animated.View> : <Ionicons name="sparkles-outline" size={19} color={colors.white} />}
      <Text style={styles.text}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 50, paddingHorizontal: spacing.lg, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary },
  danger: { backgroundColor: colors.danger },
  pressed: { opacity: 0.86 },
  disabled: { opacity: 0.55 },
  text: { color: colors.white, fontSize: 14, fontWeight: "900" },
});
