import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

export function AnimatedImpactBar({ progress, style }: { progress: number; style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion();
  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    reveal.setValue(0);
    const animation = Animated.timing(reveal, {
      toValue: 1, duration: reducedMotion ? 140 : 360,
      easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion, reveal]);
  return <Animated.View style={[style, styles.fill, {
    width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
    opacity: reveal,
    transform: reducedMotion ? [] : [{ scaleX: reveal }],
  }]} />;
}

const styles = StyleSheet.create({ fill: { transformOrigin: "left center" } });
