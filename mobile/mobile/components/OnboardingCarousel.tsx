import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
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

export type OnboardingCarouselProps = {
  onDone: () => void;
};

const SLIDES = 3;

export function OnboardingCarousel({ onDone }: OnboardingCarouselProps) {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const width = Dimensions.get("window").width;

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(SLIDES - 1, next));
    void Haptics.selectionAsync();
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
    setIndex(clamped);
  };

  const finish = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone();
  };

  const last = index === SLIDES - 1;

  return (
    <View style={styles.flex}>
      <View style={styles.topBar}>
        <Text style={type.eyebrow}>Welcome</Text>
        {!last ? (
          <Pressable onPress={finish} hitSlop={10}>
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
        <SlideLoad width={width} />
        <SlidePick width={width} />
        <SlideProfit width={width} />
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
            <Pressable onPress={finish} style={styles.nextBtn}>
              <Text style={styles.nextText}>Start Trimming!</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.white} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function SlideLoad({ width }: { width: number }) {
  const float = useFloat();
  return (
    <View style={[styles.slide, { width }]}>
      <Animated.View style={[styles.heroIcon, { transform: [{ translateY: float }] }]}>
        <Ionicons name="images-outline" size={70} color={colors.primary} />
      </Animated.View>
      <Text style={styles.slideTitle}>Load photos</Text>
      <Text style={styles.slideBody}>
        TrimSwipe scans on-device, spots the heavy stuff, and keeps your camera roll private.
      </Text>
      <View style={styles.previewCard}>
        <Ionicons name="lock-closed-outline" size={16} color={colors.sageDeep} />
        <Text style={styles.previewText}>Photos stay on your phone</Text>
      </View>
    </View>
  );
}

function SlidePick({ width }: { width: number }) {
  return (
    <View style={[styles.slide, { width }]}>
      <View style={styles.gameGrid}>
        <MiniGame icon="albums-outline" label="Big" tint={colors.primary} />
        <MiniGame icon="copy-outline" label="Dupes" tint={colors.info} />
        <MiniGame icon="phone-portrait-outline" label="Screens" tint={colors.danger} />
        <MiniGame icon="sparkles-outline" label="Bursts" tint={colors.honey} />
      </View>
      <Text style={styles.slideTitle}>Pick your game</Text>
      <Text style={styles.slideBody}>
        Choose what to trim or delete. Swipe fast, keep favorites, and preview every batch.
      </Text>
    </View>
  );
}

function SlideProfit({ width }: { width: number }) {
  const [saved, setSaved] = useState(0);
  useEffect(() => {
    const anim = new Animated.Value(0);
    const id = anim.addListener((value) => setSaved(value.value));
    Animated.timing(anim, {
      toValue: 1,
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, []);

  return (
    <View style={[styles.slide, { width }]}>
      <ProgressRing progress={0.76} size={180} thickness={14}>
        <Text style={styles.bigGB}>{(1.8 + saved * 4.2).toFixed(1)}</Text>
        <Text style={styles.bigGBLabel}>GB saved</Text>
      </ProgressRing>
      <Text style={[styles.slideTitle, { marginTop: spacing.xxl }]}>Profit</Text>
      <Text style={styles.slideBody}>
        Delete the clutter, or keep the photo and make a lighter copy. Green numbers show what you save.
      </Text>
    </View>
  );
}

function MiniGame({ icon, label, tint }: { icon: keyof typeof Ionicons.glyphMap; label: string; tint: string }) {
  return (
    <View style={styles.miniGame}>
      <View style={[styles.miniIcon, { backgroundColor: tint + "22" }]}>
        <Ionicons name={icon} size={24} color={tint} />
      </View>
      <Text style={[styles.miniLabel, { color: tint }]}>{label}</Text>
    </View>
  );
}

function useFloat() {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [float]);
  return float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
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
  previewCard: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.sageSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  previewText: { color: colors.sageDeep, fontSize: 12, fontWeight: "800" },
  gameGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  miniGame: {
    width: "47%",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.soft,
  },
  miniIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  miniLabel: { fontSize: 14, fontWeight: "900" },
  bigGB: { fontSize: 30, fontWeight: "900", color: colors.sageDeep },
  bigGBLabel: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 1.2 },
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
