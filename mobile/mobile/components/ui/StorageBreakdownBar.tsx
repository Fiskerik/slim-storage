import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "../../constants/design";

export type StorageBreakdownSegment = {
  key: string;
  label: string;
  valueMB: number;
  color: string;
};

type StorageBreakdownBarProps = {
  title: string;
  totalLabel: string;
  segments: StorageBreakdownSegment[];
  formatValue: (valueMB: number) => string;
};

export function StorageBreakdownBar({
  title,
  totalLabel,
  segments,
  formatValue,
}: StorageBreakdownBarProps) {
  const visibleSegments = segments.filter(
    (segment) => Number.isFinite(segment.valueMB) && segment.valueMB > 0,
  );
  const totalMB = visibleSegments.reduce((sum, segment) => sum + segment.valueMB, 0);

  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.total}>{totalLabel}</Text>
      </View>
      <View style={styles.track} accessibilityLabel={`${title}: ${totalLabel}`}>
        {visibleSegments.map((segment, index) => {
          const percentage = totalMB > 0 ? (segment.valueMB / totalMB) * 100 : 0;
          const width: `${number}%` = `${percentage}%`;
          return (
            <View
              key={segment.key}
              style={[
                styles.segment,
                { backgroundColor: segment.color, width },
                index < visibleSegments.length - 1 && styles.segmentDivider,
              ]}
            />
          );
        })}
      </View>
      <View style={styles.legend}>
        {segments.map((segment) => (
          <View key={segment.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: segment.color }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {segment.label}
            </Text>
            <Text style={styles.legendValue}>{formatValue(segment.valueMB)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: { flex: 1, fontSize: 13, fontWeight: "800", color: colors.text },
  total: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
  track: {
    height: 18,
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.cardSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  segment: { height: "100%" },
  segmentDivider: { borderRightWidth: 2, borderRightColor: colors.card },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.lg, rowGap: spacing.sm },
  legendItem: { width: "46%", flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { flex: 1, fontSize: 10, fontWeight: "700", color: colors.textMuted },
  legendValue: { fontSize: 10, fontWeight: "800", color: colors.text },
});
