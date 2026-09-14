import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing, Extrapolation, ReduceMotion, cancelAnimation, interpolate, runOnJS, runOnUI,
  useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue,
} from "react-native-reanimated";

import { colors, radius } from "../../constants/design";
import type { NativePhoto } from "../../lib/native-photo-source";
import { actionCode, exitDuration, resolveSwipeAction, SWIPE_THRESHOLD, type SwipeAction } from "./swipeActions";

export type { SwipeAction } from "./swipeActions";
export type SwipeActionCommand = { id: number; action: SwipeAction; photoId?: string };

type Props = {
  photo: NativePhoto;
  canTrim: boolean;
  command?: SwipeActionCommand | null;
  // A choice may become unavailable during the exit (e.g. token balance).
  onAction: (action: SwipeAction) => boolean | void;
  onCommandComplete: () => void;
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

function SmokeMote({ index, progress, action }: { index: number; progress: SharedValue<number>; action: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: action.value === 3
      ? interpolate(progress.value, [0, 0.3, 1], [0, 0.4, 0], Extrapolation.CLAMP) : 0,
    transform: [
      { translateX: (index % 2 === 0 ? -1 : 1) * progress.value * (8 + index * 3) },
      { translateY: -progress.value * (22 + index * 5) },
      { scale: 0.7 + progress.value * 0.9 },
    ],
  }));
  return <Animated.View testID="delete-smoke-mote" pointerEvents="none" style={[styles.smokeMote, { left: `${28 + index * 12}%` }, style]} />;
}

function CutLine({ progress, action, height }: { progress: SharedValue<number>; action: SharedValue<number>; height: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: action.value === 2 ? interpolate(progress.value, [0, 0.2, 0.75, 1], [0, 0.9, 0.9, 0], Extrapolation.CLAMP) : 0,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [height.value, -20], Extrapolation.CLAMP) }],
  }));
  return <Animated.View testID="trim-cut-line" pointerEvents="none" style={[styles.cutLine, style]} />;
}

// A restored/replaced photo gets its own animation lifetime. Queued callbacks
// from the previous card must never be able to commit the new top photo.
export function SwipeablePhotoCard(props: Props) {
  return <PhotoCardTransition key={props.photo.id} {...props} />;
}

function PhotoCardTransition({ photo, canTrim, command, onAction, onCommandComplete, onOpenFull, renderCard }: Props) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const width = useSharedValue(1);
  const height = useSharedValue(1);
  const actionValue = useSharedValue(0);
  const isExiting = useSharedValue(false);
  const mountedRef = useRef(false);
  const committedRef = useRef(false);
  const lastCommandIdRef = useRef<number | null>(null);
  const callbacksRef = useRef({ onAction, onCommandComplete });
  useLayoutEffect(() => { callbacksRef.current = { onAction, onCommandComplete }; });

  const reset = useCallback(() => {
    "worklet";
    cancelAnimation(progress);
    progress.value = 0;
    actionValue.value = 0;
    isExiting.value = false;
    panX.value = 0;
    panY.value = 0;
  }, [actionValue, isExiting, panX, panY, progress]);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelAnimation(progress);
      cancelAnimation(panX);
      cancelAnimation(panY);
    };
  }, [panX, panY, progress]);

  const rejectCommand = useCallback(() => {
    if (mountedRef.current) callbacksRef.current.onCommandComplete();
  }, []);

  const commitAction = useCallback((action: SwipeAction) => {
    if (!mountedRef.current || committedRef.current) return;
    committedRef.current = true;
    if (callbacksRef.current.onAction(action) === false) {
      runOnUI(reset)();
      committedRef.current = false;
    }
    callbacksRef.current.onCommandComplete();
  }, [reset]);

  const startExit = useCallback((action: SwipeAction) => {
    "worklet";
    // Both inputs acquire the same UI-thread lock before starting any animation.
    if (isExiting.value) return;
    if (action === "trim" && !canTrim) {
      panX.value = withSpring(0, { damping: 22, stiffness: 260, reduceMotion: ReduceMotion.System });
      panY.value = withSpring(0, { damping: 22, stiffness: 260, reduceMotion: ReduceMotion.System });
      runOnJS(rejectCommand)();
      return;
    }
    isExiting.value = true;
    cancelAnimation(panX);
    cancelAnimation(panY);
    actionValue.value = actionCode(action);
    progress.value = withTiming(1, {
      duration: exitDuration(action, reducedMotion),
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.Never,
    }, (finished) => {
      if (finished) runOnJS(commitAction)(action);
    });
  }, [actionValue, canTrim, commitAction, isExiting, panX, panY, progress, reducedMotion, rejectCommand]);

  useEffect(() => {
    if (!command || command.id === lastCommandIdRef.current || (command.photoId && command.photoId !== photo.id)) return;
    lastCommandIdRef.current = command.id;
    runOnUI(startExit)(command.action);
  }, [command, photo.id, startExit]);

  const panGesture = useMemo(() => Gesture.Pan()
    .withTestId("photo-swipe")
    .minDistance(6)
    .onUpdate((event) => {
      if (isExiting.value) return;
      panX.value = event.translationX;
      panY.value = event.translationY;
    })
    .onEnd((event, success) => {
      if (!success) return;
      const action = resolveSwipeAction(event.translationX, event.translationY);
      if (action) startExit(action);
    })
    .onFinalize(() => {
      if (isExiting.value) return;
      panX.value = withSpring(0, { stiffness: 260, damping: 22, reduceMotion: ReduceMotion.System });
      panY.value = withSpring(0, { stiffness: 260, damping: 22, reduceMotion: ReduceMotion.System });
    }), [isExiting, panX, panY, startExit]);

  const cardStyle = useAnimatedStyle(() => {
    const p = progress.value;
    if (reducedMotion && isExiting.value) return { opacity: 1 - p, transform: [] };
    const action = actionValue.value;
    const x = action === 1 ? panX.value + (-width.value * 1.1 - panX.value) * p : panX.value;
    const y = action === 2 ? panY.value + (-height.value - panY.value) * p : panY.value + (action === 3 ? 24 * p : 0);
    return {
      opacity: 1 - p,
      transform: [
        { translateX: x }, { translateY: y },
        { rotate: `${reducedMotion ? 0 : interpolate(panX.value, [-180, 0, 180], [-12, 0, 12], Extrapolation.CLAMP)}deg` },
      ],
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={styles.animatedCard} onLayout={(event) => {
        const layout = event.nativeEvent.layout;
        if (layout.width > 0) width.value = layout.width;
        if (layout.height > 0) height.value = layout.height;
      }}>
        <Animated.View testID="swipe-photo" style={[styles.animatedCard, cardStyle]}>
          {renderCard(photo, onOpenFull)}
          <SwipeTint action="keep" pan={panX} />
          <SwipeTint action="delete" pan={panX} />
        </Animated.View>
        {/* Pre-mounted lightweight views: no new images or React render on release. */}
        {!reducedMotion ? <>
          {[0, 1, 2, 3, 4].map((index) => <SmokeMote key={index} index={index} progress={progress} action={actionValue} />)}
          <CutLine progress={progress} action={actionValue} height={height} />
        </> : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  animatedCard: { ...StyleSheet.absoluteFillObject },
  swipeTint: { ...StyleSheet.absoluteFillObject, borderRadius: radius.lg },
  keepTint: { backgroundColor: colors.sageSoft },
  deleteTint: { backgroundColor: colors.dangerSoft },
  smokeMote: { position: "absolute", top: "58%", width: 18, height: 13, borderRadius: 12, backgroundColor: "rgba(101, 112, 109, 0.28)" },
  cutLine: { position: "absolute", top: 0, left: 14, right: 14, height: 2, borderRadius: 2, backgroundColor: colors.honey },
});
