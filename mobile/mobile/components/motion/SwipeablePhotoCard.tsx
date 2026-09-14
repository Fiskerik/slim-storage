import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { colors, radius } from "../../constants/design";
import type { NativePhoto } from "../../lib/native-photo-source";
import type { NativeSettings } from "../../lib/native-store";
import { actionCode, exitDuration, resolveSwipeAction, SWIPE_THRESHOLD, type SwipeAction } from "./swipeActions";

export type { SwipeAction } from "./swipeActions";

export type SwipeActionCommand = {
  id: number;
  action: SwipeAction;
  photoId?: string;
};

const FRAGMENT_COUNT = 8;
const SMOKE_MOTE_COUNT = 5;

type Props = {
  photo: NativePhoto;
  settings: NativeSettings;
  command?: SwipeActionCommand | null;
  onAction: (action: SwipeAction) => void;
  onOpenFull: () => void;
  renderCard: (photo: NativePhoto, onOpenFull: () => void) => ReactNode;
};

function SwipeTint({ action, pan }: { action: "keep" | "delete"; pan: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: action === "keep"
      ? interpolate(pan.value, [-SWIPE_THRESHOLD, -20, 0], [0.38, 0.14, 0], Extrapolation.CLAMP)
      : interpolate(pan.value, [0, 20, SWIPE_THRESHOLD], [0, 0.14, 0.38], Extrapolation.CLAMP),
  }));
  return <Animated.View pointerEvents="none" style={[styles.swipeTint, action === "keep" ? styles.keepTint : styles.deleteTint, style]} />;
}

function DissolveFragment({
  index,
  uri,
  width,
  height,
  progress,
}: {
  index: number;
  uri: string;
  width: number;
  height: number;
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const start = index * 0.055;
    const local = interpolate(progress.value, [start, Math.min(1, start + 0.28), 1], [0, 1, 1], Extrapolation.CLAMP);
    const direction = index % 2 === 0 ? -1 : 1;
    return {
      opacity: interpolate(local, [0, 0.08, 0.72, 1], [0, 1, 0.95, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: direction * local * (5 + index * 1.5) },
        { translateY: local * (24 + (index % 3) * 14) },
        { rotate: `${direction * local * (1.5 + (index % 3) * 1.1)}deg` },
        { scale: 1 - local * 0.04 },
      ],
    };
  });

  const fragmentWidth = width / FRAGMENT_COUNT;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.fragment, { left: index * fragmentWidth, width: fragmentWidth, height }, style]}
    >
      <Image
        source={{ uri }}
        resizeMode="cover"
        style={{ position: "absolute", left: -index * fragmentWidth, top: 0, width, height }}
      />
    </Animated.View>
  );
}

function SmokeMote({ index, width, height, progress }: { index: number; width: number; height: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const local = interpolate(progress.value, [0.1 + index * 0.035, 0.7, 1], [0, 1, 1], Extrapolation.CLAMP);
    const startX = width * (0.28 + index * 0.12);
    return {
      opacity: interpolate(local, [0, 0.15, 0.8, 1], [0, 0.42, 0.22, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: startX + (index % 2 === 0 ? -1 : 1) * local * (8 + index * 3) },
        { translateY: height * 0.58 - local * (22 + index * 5) },
        { scale: 0.7 + local * 0.9 },
      ],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.smokeMote, { left: -8 - index * 2, top: 0 }, style]} />;
}

function CutLine({ progress, height }: { progress: SharedValue<number>; height: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.2, 0.75, 1], [0, 0.9, 0.9, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [height, -20], Extrapolation.CLAMP) }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.cutLine, style]} />;
}

export function SwipeablePhotoCard({ photo, settings: _settings, command, onAction, onOpenFull, renderCard }: Props) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const actionValue = useSharedValue(0);
  const isExiting = useSharedValue(0);
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [exitAction, setExitAction] = useState<SwipeAction | null>(null);
  const exitingRef = useRef(false);
  const committedRef = useRef(false);
  const lastCommandIdRef = useRef<number | null>(null);
  const onActionRef = useRef(onAction);

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  useEffect(() => {
    exitingRef.current = false;
    committedRef.current = false;
    lastCommandIdRef.current = null;
    setExitAction(null);
    cancelAnimation(progress);
    cancelAnimation(panX);
    cancelAnimation(panY);
    progress.value = 0;
    actionValue.value = 0;
    isExiting.value = 0;
    panX.value = 0;
    panY.value = 0;
  }, [actionValue, isExiting, panX, panY, photo.id, progress]);

  const commitAction = useCallback((action: SwipeAction) => {
    if (committedRef.current) return;
    committedRef.current = true;
    onActionRef.current(action);
  }, []);

  const startExit = useCallback((action: SwipeAction) => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    committedRef.current = false;
    setExitAction(action);
    actionValue.value = actionCode(action);
    isExiting.value = 1;
    const duration = exitDuration(action, reducedMotion);
    progress.value = withTiming(1, {
      duration,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.Never,
    }, (finished) => {
      if (finished) runOnJS(commitAction)(action);
    });
  }, [actionValue, commitAction, isExiting, progress, reducedMotion]);

  useEffect(() => {
    if (!command || command.id === lastCommandIdRef.current || (command.photoId && command.photoId !== photo.id)) return;
    lastCommandIdRef.current = command.id;
    startExit(command.action);
  }, [command, photo.id, startExit]);

  const panGesture = useMemo(() => Gesture.Pan()
    .minDistance(6)
    .onUpdate((event) => {
      if (isExiting.value) return;
      panX.value = event.translationX;
      panY.value = event.translationY;
    })
    .onEnd((event) => {
      if (isExiting.value) return;
      const action = resolveSwipeAction(event.translationX, event.translationY);
      if (action) {
        runOnJS(startExit)(action);
        return;
      }
      panX.value = withSpring(0, { stiffness: 260, damping: 22, reduceMotion: ReduceMotion.System });
      panY.value = withSpring(0, { stiffness: 260, damping: 22, reduceMotion: ReduceMotion.System });
    }), [isExiting, panX, panY, startExit]);

  const cardStyle = useAnimatedStyle(() => {
    const action = actionValue.value;
    if (progress.value > 0) {
      const isDelete = action === 3;
      const isTrim = action === 2;
      return {
        opacity: isDelete ? interpolate(progress.value, [0, 0.18, 1], [1, 0.25, 0], Extrapolation.CLAMP) : interpolate(progress.value, [0, 1], [1, 0], Extrapolation.CLAMP),
        transform: [
          { translateX: isTrim ? panX.value * 0.18 : isDelete ? interpolate(progress.value, [0, 1], [panX.value, dimensions.width * 1.2], Extrapolation.CLAMP) : interpolate(progress.value, [0, 1], [panX.value, -dimensions.width * 1.15], Extrapolation.CLAMP) },
          { translateY: isTrim ? interpolate(progress.value, [0, 1], [panY.value, -dimensions.height * 1.15], Extrapolation.CLAMP) : panY.value },
          { rotate: `${interpolate(panX.value, [-180, 0, 180], [-12, 0, 12], Extrapolation.CLAMP) + (isDelete ? progress.value * 5 : 0)}deg` },
        ],
      };
    }
    return {
      transform: [
        { translateX: panX.value },
        { translateY: panY.value },
        { rotate: `${interpolate(panX.value, [-180, 0, 180], [-12, 0, 12], Extrapolation.CLAMP)}deg` },
      ],
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0 && height > 0) setDimensions({ width, height });
        }}
        style={[styles.animatedCard, cardStyle]}
      >
        {renderCard(photo, onOpenFull)}
        <SwipeTint action="keep" pan={panX} />
        <SwipeTint action="delete" pan={panX} />
        {!reducedMotion && exitAction === "delete" && dimensions.width > 1 ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {Array.from({ length: FRAGMENT_COUNT }, (_, index) => (
              <DissolveFragment key={index} index={index} uri={photo.uri} width={dimensions.width} height={dimensions.height} progress={progress} />
            ))}
            {Array.from({ length: SMOKE_MOTE_COUNT }, (_, index) => (
              <SmokeMote key={index} index={index} width={dimensions.width} height={dimensions.height} progress={progress} />
            ))}
          </View>
        ) : null}
        {!reducedMotion && exitAction === "trim" ? <CutLine progress={progress} height={dimensions.height} /> : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  animatedCard: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  swipeTint: { ...StyleSheet.absoluteFillObject, borderRadius: radius.lg },
  keepTint: { backgroundColor: colors.sageSoft },
  deleteTint: { backgroundColor: colors.dangerSoft },
  fragment: { position: "absolute", top: 0, overflow: "hidden" },
  smokeMote: { position: "absolute", width: 18, height: 13, borderRadius: 12, backgroundColor: "rgba(101, 112, 109, 0.28)" },
  cutLine: { position: "absolute", left: 14, right: 14, height: 2, borderRadius: 2, backgroundColor: colors.honey },
});
