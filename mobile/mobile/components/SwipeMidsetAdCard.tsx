import { t } from "../lib/i18n";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { PreparedSwipeMidsetMrecAd } from "../lib/meta-mrec";
import { midsetHoldSeconds } from "../lib/swipe-midset";
import { MetaMrecAdView, type MetaMrecLoadError } from "./MetaMrecAdView";

const DISMISS_THRESHOLD = 96;

export function SwipeMidsetAdCard({
  loaded,
  adLoaded,
  onAdLoaded,
  onAdLoadFailed,
  onDismiss,
}: {
  loaded: PreparedSwipeMidsetMrecAd;
  adLoaded: boolean;
  onAdLoaded: () => void;
  onAdLoadFailed: (error: MetaMrecLoadError) => void;
  onDismiss: () => void;
}) {
  const { placementId } = loaded;
  const holdSeconds = useRef(midsetHoldSeconds()).current;
  const [unlockAt, setUnlockAt] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(holdSeconds);
  const [requestAttempt, setRequestAttempt] = useState(0);
  const pan = useRef(new Animated.ValueXY()).current;
  const dismissingRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminalFailureRef = useRef(false);
  const unlocked = adLoaded && unlockAt !== null && secondsRemaining <= 0;

  useEffect(() => {
    setRequestAttempt(0);
    terminalFailureRef.current = false;
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [placementId]);

  const handleAdLoaded = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    onAdLoaded();
  }, [onAdLoaded]);

  const handleAdLoadFailed = useCallback((error: MetaMrecLoadError) => {
    console.log("[ads] direct Meta MREC load failed", error);
    if (adLoaded || terminalFailureRef.current) return;

    if (requestAttempt === 0) {
      if (!retryTimerRef.current) {
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          setRequestAttempt(1);
        }, 1500);
      }
      return;
    }

    terminalFailureRef.current = true;
    onAdLoadFailed(error);
  }, [adLoaded, onAdLoadFailed, requestAttempt]);

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
      <View style={styles.adSlot}>
        <MetaMrecAdView
          key={`${placementId}:${requestAttempt}`}
          placementId={placementId}
          onAdLoaded={handleAdLoaded}
          onAdFailed={handleAdLoadFailed}
          style={styles.mrec}
        />
      </View>

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
            {unlocked ? t("ui.swipe-the-card-left-or-right") : adLoaded ? t("ui.the-ad-will-unlock-automatically") : requestAttempt === 0 ? "Waiting for Meta" : "Retrying Meta ad"}
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
  adSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7f3ea",
  },
  mrec: {
    width: 300,
    height: 250,
    backgroundColor: "transparent",
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
});
