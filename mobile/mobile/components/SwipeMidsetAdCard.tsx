import { t } from "../lib/i18n";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { LoadedSwipeMidsetNativeAd } from "../lib/ads";
import { midsetHoldSeconds } from "../lib/swipe-midset";

const DISMISS_THRESHOLD = 96;

export function SwipeMidsetAdCard({
  loaded,
  adLoaded,
  onDismiss,
}: {
  loaded: LoadedSwipeMidsetNativeAd;
  adLoaded: boolean;
  onDismiss: () => void;
}) {
  const { ad, renderer } = loaded;
  const { NativeAdView, templateType } = renderer;
  const holdSeconds = useRef(midsetHoldSeconds()).current;
  const [unlockAt, setUnlockAt] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(holdSeconds);
  const pan = useRef(new Animated.ValueXY()).current;
  const dismissingRef = useRef(false);
  const loadRequestedRef = useRef(false);
  const unlocked = adLoaded && unlockAt !== null && secondsRemaining <= 0;

  function loadNativeAd() {
    if (loadRequestedRef.current) return;
    loadRequestedRef.current = true;
    ad.loadAd();
  }

  useEffect(() => {
    if (!adLoaded) {
      setUnlockAt(null);
      setSecondsRemaining(holdSeconds);
      return;
    }

    setUnlockAt((current) => current ?? Date.now() + holdSeconds * 1000);
  }, [adLoaded, holdSeconds]);

  useEffect(() => {
    if (!adLoaded || unlockAt === null) return;
    const update = () => {
      setSecondsRemaining(Math.max(0, Math.ceil((unlockAt - Date.now()) / 1000)));
    };
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [adLoaded, unlockAt]);

  function dismiss(direction: -1 | 1) {
    if (!unlocked || dismissingRef.current) return;
    dismissingRef.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(pan, {
      toValue: { x: direction * 560, y: 0 },
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDismiss();
      else dismissingRef.current = false;
    });
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          unlocked && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > DISMISS_THRESHOLD) {
            dismiss(1);
            return;
          }
          if (gesture.dx < -DISMISS_THRESHOLD) {
            dismiss(-1);
            return;
          }
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            tension: 72,
            friction: 8,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            tension: 72,
            friction: 8,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    // The responder must be rebuilt at unlock so it cannot capture an ad gesture early.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pan, unlocked],
  );

  const rotate = pan.x.interpolate({
    inputRange: [-180, 0, 180],
    outputRange: ["-9deg", "0deg", "9deg"],
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.card, { transform: [{ translateX: pan.x }, { rotate }] }]}
    >
      <NativeAdView
        nativeAd={ad}
        templateType={templateType}
        style={styles.adView}
        onLayout={loadNativeAd}
      />

      <View
        accessibilityRole="timer"
        accessibilityLabel={adLoaded
          ? unlocked
            ? t("ui.ad-finished-swipe-to-continue")
            : t("ui.continue-in-seconds", { seconds: secondsRemaining })
          : "Loading ad"}
        style={[styles.continuePanel, unlocked && styles.continuePanelUnlocked, !adLoaded && styles.continuePanelLoading]}
      >
        <Ionicons name={unlocked ? "swap-horizontal" : adLoaded ? "time-outline" : "cloud-download-outline"} size={22} color="#315f7d" />
        <View>
          <Text style={styles.continueText}>
            {unlocked ? t("ui.swipe-to-continue") : adLoaded ? t("ui.continue-in-seconds", { seconds: secondsRemaining }) : "Loading ad…"}
          </Text>
          <Text style={styles.continueHint}>
            {unlocked ? t("ui.swipe-the-card-left-or-right") : adLoaded ? t("ui.the-ad-will-unlock-automatically") : "Waiting for LevelPlay"}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#d9d4c8",
    backgroundColor: "#f7f3ea",
    shadowColor: "#203345",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  adView: {
    height: 427,
    backgroundColor: "#f7f3ea",
  },
  media: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 262,
    backgroundColor: "#dce5df",
  },
  sponsoredBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    borderRadius: 9,
    backgroundColor: "rgba(18, 33, 47, 0.78)",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  sponsoredText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  continuePanel: {
    height: 65,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#d9d4c8",
    backgroundColor: "#fcfaf5",
    paddingHorizontal: 16,
  },
  continuePanelUnlocked: {
    backgroundColor: "#edf5ef",
  },
  continuePanelLoading: {
    backgroundColor: "#f3f4f6",
  },
  continueText: {
    color: "#203345",
    fontSize: 15,
    fontWeight: "900",
  },
  continueHint: {
    marginTop: 2,
    color: "#68717d",
    fontSize: 11,
    fontWeight: "700",
  },
  icon: {
    position: "absolute",
    top: 281,
    left: 16,
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#e5e7eb",
  },
  headline: {
    position: "absolute",
    top: 278,
    left: 74,
    right: 16,
    color: "#182536",
    fontSize: 18,
    lineHeight: 21,
    fontWeight: "900",
  },
  headlineWithoutIcon: {
    left: 16,
  },
  advertiser: {
    position: "absolute",
    top: 326,
    left: 74,
    right: 16,
    color: "#68717d",
    fontSize: 11,
    fontWeight: "700",
  },
  advertiserWithoutIcon: {
    left: 16,
  },
  body: {
    position: "absolute",
    top: 349,
    left: 16,
    right: 132,
    color: "#55616e",
    fontSize: 12,
    lineHeight: 16,
  },
  callToAction: {
    position: "absolute",
    right: 16,
    bottom: 18,
    minWidth: 104,
    maxWidth: 126,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#315f7d",
    color: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 11,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "900",
  },
});
