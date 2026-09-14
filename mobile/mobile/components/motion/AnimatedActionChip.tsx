import { useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { colors, radius } from "../../constants/design";

export type ActionChipValue = "keep" | "trim" | "delete";

type Props = {
  action: ActionChipValue;
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
};

const tintFor: Record<ActionChipValue, string> = {
  keep: colors.sageDeep,
  trim: colors.primary,
  delete: colors.danger,
};

const iconFor: Record<ActionChipValue, keyof typeof Ionicons.glyphMap> = {
  keep: "checkmark-circle-outline",
  trim: "cut-outline",
  delete: "trash-outline",
};

export function AnimatedActionChip({ action, label, accessibilityLabel, onPress, disabled, selected = true }: Props) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: reducedMotion ? 120 : 180, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
  }, [action, progress, reducedMotion]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.82 + progress.value * 0.18,
    transform: [{ scale: 0.97 + progress.value * 0.03 }],
  }));
  const tint = tintFor[action];
  const displayTint = selected ? tint : colors.textMuted;
  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled, selected }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.chip, { borderColor: selected ? tint : colors.border, backgroundColor: selected ? `${tint}15` : colors.cardSoft }, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <Ionicons name={iconFor[action]} size={16} color={displayTint} />
        <Text style={[styles.text, { color: displayTint }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 44, minWidth: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 10, borderRadius: radius.sm, borderWidth: 1 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45 },
  text: { fontSize: 10, fontWeight: "900" },
});
