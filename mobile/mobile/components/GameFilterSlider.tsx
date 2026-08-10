import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

type GameFilterSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue: (value: number) => string;
  minText: string;
  maxText: string;
  onChange: (value: number) => void;
};

function clampAndSnap(value: number, min: number, max: number, step: number): number {
  const bounded = Math.max(min, Math.min(max, value));
  const snapped = min + Math.round((bounded - min) / step) * step;
  return +Math.max(min, Math.min(max, snapped)).toFixed(4);
}

export function GameFilterSlider({
  label,
  value,
  min,
  max,
  step,
  formatValue,
  minText,
  maxText,
  onChange,
}: GameFilterSliderProps) {
  const safeMax = Math.max(min, max);
  const disabled = safeMax <= min;
  const widthRef = useRef(1);
  const draftRef = useRef(clampAndSnap(value, min, safeMax, step));
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const [draftValue, setDraftValue] = useState(draftRef.current);

  const updateDraft = (nextValue: number) => {
    const next = clampAndSnap(nextValue, min, safeMax, step);
    draftRef.current = next;
    setDraftValue(next);
    return next;
  };

  const valueFromLocation = (locationX: number) => {
    if (disabled) return min;
    const fraction = Math.max(0, Math.min(1, locationX / widthRef.current));
    return min + fraction * (safeMax - min);
  };

  const commitDraft = () => {
    const next = clampAndSnap(draftRef.current, min, safeMax, step);
    if (Math.abs(next - valueRef.current) > 0.0001) onChangeRef.current(next);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onStartShouldSetPanResponderCapture: () => !disabled,
        onMoveShouldSetPanResponder: (_, gesture) =>
          !disabled && Math.abs(gesture.dx) >= 2 && Math.abs(gesture.dx) >= Math.abs(gesture.dy),
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          !disabled && Math.abs(gesture.dx) >= 2 && Math.abs(gesture.dx) >= Math.abs(gesture.dy),
        onPanResponderGrant: (event) => updateDraft(valueFromLocation(event.nativeEvent.locationX)),
        onPanResponderMove: (event) => updateDraft(valueFromLocation(event.nativeEvent.locationX)),
        onPanResponderRelease: commitDraft,
        onPanResponderTerminate: commitDraft,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    // Gesture configuration is rebuilt only when the numeric range changes.
    // Current values and callbacks are held in refs so an active drag is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, min, safeMax, step],
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
    updateDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, min, safeMax, step]);

  const markerCount = Math.min(13, Math.max(2, Math.floor((safeMax - min) / step) + 1));
  const markerValues = Array.from({ length: markerCount }, (_, index) => {
    if (safeMax === min) return min;
    return clampAndSnap(min + (index / (markerCount - 1)) * (safeMax - min), min, safeMax, step);
  }).filter((marker, index, markers) => index === 0 || marker !== markers[index - 1]);
  const percent = disabled ? 0 : Math.max(0, Math.min(1, (draftValue - min) / (safeMax - min)));

  const handleLayout = (event: LayoutChangeEvent) => {
    widthRef.current = Math.max(1, event.nativeEvent.layout.width);
  };

  const adjust = (direction: -1 | 1) => {
    if (disabled) return;
    const next = updateDraft(draftRef.current + direction * step);
    onChangeRef.current(next);
  };

  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{formatValue(draftValue)}</Text>
      </View>
      <View
        {...responder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max: safeMax, now: draftValue, text: formatValue(draftValue) }}
        accessibilityActions={[{ name: "decrement" }, { name: "increment" }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "increment") adjust(1);
          if (event.nativeEvent.actionName === "decrement") adjust(-1);
        }}
        onLayout={handleLayout}
        style={[styles.track, disabled && styles.disabled]}
      >
        <View pointerEvents="none" style={styles.rail} />
        {markerValues.map((markerValue) => {
          const markerPercent = disabled ? 0 : ((markerValue - min) / (safeMax - min)) * 100;
          return (
            <View
              key={markerValue}
              pointerEvents="none"
              style={[styles.marker, { left: `${markerPercent}%` }]}
            />
          );
        })}
        <View pointerEvents="none" style={[styles.fill, { width: `${percent * 100}%` }]} />
        <View pointerEvents="none" style={[styles.thumb, { left: `${percent * 100}%` }]} />
      </View>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>{minText}</Text>
        <Text style={[styles.rangeText, styles.rangeTextRight]}>{maxText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  label: { color: "#1f2937", fontSize: 12, fontWeight: "700" },
  value: { color: "#315f7d", fontSize: 12, fontWeight: "700" },
  track: { height: 44, justifyContent: "center" },
  disabled: { opacity: 0.45 },
  rail: { position: "absolute", left: 0, right: 0, height: 7, borderRadius: 999, backgroundColor: "#e5ebef" },
  marker: { position: "absolute", top: 16, width: 2, height: 12, marginLeft: -1, borderRadius: 999, backgroundColor: "#a7bdca" },
  fill: { position: "absolute", left: 0, height: 7, borderRadius: 999, backgroundColor: "#315f7d" },
  thumb: { position: "absolute", width: 26, height: 26, marginLeft: -13, borderRadius: 13, backgroundColor: "#ffffff", borderWidth: 3, borderColor: "#315f7d" },
  rangeRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rangeText: { color: "#64748b", fontSize: 10, fontWeight: "800", flex: 1 },
  rangeTextRight: { textAlign: "right" },
});
