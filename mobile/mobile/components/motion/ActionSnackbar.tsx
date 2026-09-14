import { useEffect } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { Easing, FadeInDown, FadeOutDown, ReduceMotion } from "react-native-reanimated";

import { colors, radius, spacing, type } from "../../constants/design";

type Props = {
  visible: boolean;
  message: string;
  actionLabel: string;
  announcement?: string;
  dismissLabel: string;
  onAction: () => void;
  onDismiss: () => void;
};

export function ActionSnackbar({ visible, message, actionLabel, announcement, dismissLabel, onAction, onDismiss }: Props) {
  useEffect(() => {
    if (!visible) return;
    AccessibilityInfo.announceForAccessibility(announcement ?? `${message}. ${actionLabel}`);
  }, [actionLabel, announcement, message, visible]);

  if (!visible) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(180).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutDown.duration(150).reduceMotion(ReduceMotion.System)}
      pointerEvents="box-none"
      style={styles.wrap}
    >
      <View accessibilityLiveRegion="polite" style={styles.snackbar}>
        <View style={styles.iconWrap}>
          <Ionicons name="trash-outline" size={17} color={colors.danger} />
        </View>
        <Text style={styles.message} numberOfLines={2}>{message}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          hitSlop={8}
          onPress={onDismiss}
          style={styles.close}
        >
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: 18, zIndex: 30, alignItems: "center" },
  snackbar: { minHeight: 52, maxWidth: 460, width: "100%", flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, shadowColor: colors.ink, shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  iconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.dangerSoft },
  message: { ...type.caption, flex: 1, color: colors.white },
  action: { minHeight: 44, minWidth: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, borderRadius: radius.sm },
  actionPressed: { backgroundColor: "rgba(255,255,255,0.12)" },
  actionText: { color: colors.honeySoft, fontSize: 12, fontWeight: "900" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
