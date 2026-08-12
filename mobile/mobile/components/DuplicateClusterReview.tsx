import { t } from "../lib/i18n";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, type AccessibilityRole } from "react-native";
import { colors, radius, shadow, spacing, type } from "../constants/design";
import type { NativePhoto } from "../lib/native-photo-source";

export type DuplicateReviewPhoto = NativePhoto & {
  /** A short, evidence-based explanation such as t("ui.sharper-face"). */
  suggestionReasons?: string[];
  /** A calibrated 0-1 signal. It is presented as a confidence band, not a fact. */
  suggestionConfidence?: number;
};

export type DuplicateCluster = {
  id: string;
  photos: DuplicateReviewPhoto[];
  suggestedKeeperId: string;
  /** Optional, human-readable description of why this was clustered. */
  similarityLabel?: string;
};

export type DuplicateClusterReviewProps = {
  cluster: DuplicateCluster;
  /** Called whenever the user changes the keeper or selected suggested removals. */
  onSelectionChange?: (selection: { keeperId: string; removalIds: string[] }) => void;
  /** Opens an immersive/full-resolution preview in the parent screen. */
  onPreviewPhoto?: (photo: DuplicateReviewPhoto) => void;
  /** Called when the visible selection should be applied; Photos confirmation remains the parent's job. */
  onConfirmRemovals?: (selection: { keeperId: string; removalIds: string[] }) => void;
  confirmLabel?: string;
};

type Filter = "all" | "keep" | "remove";

function formatMB(value: number): string {
  return value >= 1024 ? `${(value / 1024).toFixed(2)} GB` : `${value.toFixed(1)} MB`;
}

function confidenceLabel(confidence?: number): string | null {
  if (confidence == null) return null;
  if (confidence >= 0.82) return t("ui.strong-suggestion");
  if (confidence >= 0.62) return t("ui.likely-suggestion");
  return t("ui.possible-suggestion");
}

/**
 * A single, inspectable group of visually similar photos. The parent owns the
 * final deletion confirmation; this component only manages the review choice.
 */
export function DuplicateClusterReview({
  cluster,
  onSelectionChange,
  onPreviewPhoto,
  onConfirmRemovals,
  confirmLabel = t("ui.review-selected-removals"),
}: DuplicateClusterReviewProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [keeperId, setKeeperId] = useState(cluster.suggestedKeeperId);
  const [removalIds, setRemovalIds] = useState<string[]>(() =>
    cluster.photos
      .filter((photo) => photo.id !== cluster.suggestedKeeperId)
      .map((photo) => photo.id),
  );
  const photoIdsKey = cluster.photos.map((photo) => photo.id).join("\u001f");

  useEffect(() => {
    setKeeperId(cluster.suggestedKeeperId);
    setRemovalIds(
      photoIdsKey
        .split("\u001f")
        .filter((photoId) => photoId.length > 0 && photoId !== cluster.suggestedKeeperId),
    );
    setFilter("all");
  }, [cluster.id, cluster.suggestedKeeperId, photoIdsKey]);

  const keeper = cluster.photos.find((photo) => photo.id === keeperId) ?? cluster.photos[0];
  const selectedSavings = useMemo(
    () =>
      cluster.photos
        .filter((photo) => removalIds.includes(photo.id))
        .reduce((total, photo) => total + photo.sizeMB, 0),
    [cluster.photos, removalIds],
  );
  const visiblePhotos = cluster.photos.filter((photo) => {
    if (filter === "keep") return photo.id === keeper?.id;
    if (filter === "remove") return removalIds.includes(photo.id);
    return true;
  });

  const publish = (nextKeeperId: string, nextRemovalIds: string[]) => {
    onSelectionChange?.({ keeperId: nextKeeperId, removalIds: nextRemovalIds });
  };

  const chooseKeeper = (photo: DuplicateReviewPhoto) => {
    const nextRemovalIds = cluster.photos
      .filter((item) => item.id !== photo.id)
      .map((item) => item.id);
    setKeeperId(photo.id);
    setRemovalIds(nextRemovalIds);
    publish(photo.id, nextRemovalIds);
  };

  const toggleRemoval = (photo: DuplicateReviewPhoto) => {
    if (photo.id === keeper?.id) return;
    const nextRemovalIds = removalIds.includes(photo.id)
      ? removalIds.filter((id) => id !== photo.id)
      : [...removalIds, photo.id];
    setRemovalIds(nextRemovalIds);
    publish(keeper.id, nextRemovalIds);
  };

  if (!keeper) return null;

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={t("ui.similar-photo-group-with-count", { count: cluster.photos.length })}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>{t("ui.similar-photos")}</Text>
          <Text style={styles.title}>{t("ui.photos-to-compare", { count: cluster.photos.length })}</Text>
          {cluster.similarityLabel ? (
            <Text style={styles.description}>{cluster.similarityLabel}</Text>
          ) : null}
        </View>
        <View style={styles.savings}>
          <Ionicons name="archive-outline" size={15} color={colors.sageDeep} />
          <Text style={styles.savingsValue}>{formatMB(selectedSavings)}</Text>
          <Text style={styles.savingsLabel}>{t("ui.selected")}</Text>
        </View>
      </View>

      <View style={styles.suggestion}>
        <Image source={{ uri: keeper.localUri ?? keeper.uri }} style={styles.heroImage} />
        <View style={styles.suggestionText}>
          <View style={styles.suggestionTitleRow}>
            <Ionicons name="sparkles-outline" size={16} color={colors.sageDeep} />
            <Text style={styles.suggestionTitle}>{t("ui.suggested-to-keep")}</Text>
          </View>
          <Text style={styles.photoTitle} numberOfLines={1}>
            {keeper.title || t("ui.best-available-copy")}
          </Text>
          <Text style={styles.reason} numberOfLines={2}>
            {keeper.suggestionReasons?.length
              ? keeper.suggestionReasons.join(" · ")
              : t("ui.based-on-available-image-quality-signals")}
          </Text>
          {confidenceLabel(keeper.suggestionConfidence) ? (
            <Text style={styles.confidence}>
              {confidenceLabel(keeper.suggestionConfidence)} — please compare before removing.
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.filterRow} accessibilityRole="tablist">
        <FilterButton
          label={t("ui.all-count", { count: cluster.photos.length })}
          selected={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <FilterButton
          label={t("ui.suggested-keep")}
          selected={filter === "keep"}
          onPress={() => setFilter("keep")}
        />
        <FilterButton
          label={t("ui.suggested-remove-count", { count: removalIds.length })}
          selected={filter === "remove"}
          onPress={() => setFilter("remove")}
        />
      </View>

      <View style={styles.grid}>
        {visiblePhotos.map((photo) => {
          const isKeeper = photo.id === keeper.id;
          const isSelectedForRemoval = removalIds.includes(photo.id);
          return (
            <View key={photo.id} style={styles.photoCell}>
              <Pressable
                accessibilityRole={"imagebutton" as AccessibilityRole}
                accessibilityLabel={`${photo.title || "Photo"}, ${isKeeper ? "suggested to keep" : isSelectedForRemoval ? "selected for removal" : "not selected for removal"}. Long press for preview.`}
                onLongPress={() => onPreviewPhoto?.(photo)}
                delayLongPress={350}
                onPress={() => onPreviewPhoto?.(photo)}
                style={[
                  styles.imageWrap,
                  isKeeper && styles.imageWrapKeeper,
                  isSelectedForRemoval && styles.imageWrapRemoval,
                ]}
              >
                <Image source={{ uri: photo.localUri ?? photo.uri }} style={styles.image} />
                <View style={styles.imageShade} />
                <Text style={styles.sizeLabel}>{formatMB(photo.sizeMB)}</Text>
                {isKeeper ? (
                  <View style={styles.keepBadge}>
                    <Text style={styles.keepBadgeText}>{t("ui.keep")}</Text>
                  </View>
                ) : null}
                {isSelectedForRemoval ? (
                  <View style={styles.removeCheck}>
                    <Ionicons name="checkmark" size={15} color={colors.white} />
                  </View>
                ) : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isKeeper
                    ? t("ui.choose-a-different-photo-to-keep")
                    : isSelectedForRemoval
                      ? `Keep ${photo.title || "this photo"}`
                      : `Select ${photo.title || "this photo"} for removal`
                }
                onPress={() => toggleRemoval(photo)}
                disabled={isKeeper}
                style={[
                  styles.selectionButton,
                  isKeeper && styles.selectionButtonKeeper,
                  isSelectedForRemoval && styles.selectionButtonRemove,
                ]}
              >
                <Text
                  style={[
                    styles.selectionButtonText,
                    isSelectedForRemoval && styles.selectionButtonTextRemove,
                  ]}
                >
                  {isKeeper ? "Keeper" : isSelectedForRemoval ? "Remove" : "Keep"}
                </Text>
              </Pressable>
              {!isKeeper ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Make ${photo.title || "this photo"} the keeper`}
                  onPress={() => chooseKeeper(photo)}
                  hitSlop={8}
                >
                  <Text style={styles.makeKeeper}>{t("ui.make-keeper")}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      <Text style={styles.disclaimer}>
        Suggestions use on-device image signals and can be wrong. You choose what stays.
      </Text>
      {onConfirmRemovals ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${confirmLabel}. ${removalIds.length} photos selected, about ${formatMB(selectedSavings)}.`}
          disabled={removalIds.length === 0}
          onPress={() => onConfirmRemovals({ keeperId: keeper.id, removalIds })}
          style={[styles.confirmButton, removalIds.length === 0 && styles.confirmButtonDisabled]}
        >
          <Ionicons name="trash-outline" size={18} color={colors.white} />
          <Text style={styles.confirmText}>
            {confirmLabel} · {removalIds.length}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FilterButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.filterButton, selected && styles.filterButtonSelected]}
    >
      <Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  header: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  headerText: { flex: 1, gap: 3 },
  eyebrow: { ...type.eyebrow, color: colors.sageDeep },
  title: { ...type.subtitle, color: colors.ink },
  description: { ...type.caption, marginTop: 2 },
  savings: { alignItems: "flex-end", justifyContent: "center", minWidth: 64 },
  savingsValue: { fontSize: 15, color: colors.sageDeep, fontWeight: "700" },
  savingsLabel: { fontSize: 10, color: colors.textMuted, fontWeight: "700" },
  suggestion: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.sageSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d9f99d",
  },
  heroImage: { width: 78, height: 78, borderRadius: radius.sm, backgroundColor: colors.borderSoft },
  suggestionText: { flex: 1, justifyContent: "center", gap: 3 },
  suggestionTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  suggestionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.sageDeep,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  photoTitle: { fontSize: 14, fontWeight: "800", color: colors.ink },
  reason: { fontSize: 12, lineHeight: 16, fontWeight: "600", color: "#3f6212" },
  confidence: { fontSize: 10, lineHeight: 14, fontWeight: "600", color: colors.textMuted },
  filterRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.cardSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  filterButtonSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterLabel: { fontSize: 11, fontWeight: "800", color: colors.textMuted },
  filterLabelSelected: { color: colors.white },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photoCell: { width: "31.8%", gap: 5 },
  imageWrap: {
    aspectRatio: 0.82,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.borderSoft,
    borderWidth: 2,
    borderColor: "transparent",
  },
  imageWrapKeeper: { borderColor: colors.sage },
  imageWrapRemoval: { borderColor: colors.danger },
  image: { width: "100%", height: "100%" },
  imageShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.08)" },
  sizeLabel: {
    position: "absolute",
    left: 5,
    bottom: 5,
    color: colors.white,
    fontSize: 9,
    fontWeight: "800",
    backgroundColor: "rgba(15,23,42,0.65)",
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 5,
  },
  keepBadge: {
    position: "absolute",
    left: 5,
    top: 5,
    backgroundColor: colors.sageDeep,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 5,
  },
  keepBadgeText: { color: colors.white, fontSize: 8, fontWeight: "700", letterSpacing: 0.4 },
  removeCheck: {
    position: "absolute",
    right: 5,
    top: 5,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  selectionButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft,
  },
  selectionButtonKeeper: { backgroundColor: colors.sageSoft, borderColor: "#bef264" },
  selectionButtonRemove: { backgroundColor: colors.dangerSoft, borderColor: "#fecaca" },
  selectionButtonText: { fontSize: 10, fontWeight: "800", color: colors.textMuted },
  selectionButtonTextRemove: { color: "#b91c1c" },
  makeKeeper: {
    textAlign: "center",
    color: colors.sageDeep,
    fontSize: 10,
    fontWeight: "800",
    paddingVertical: 3,
  },
  disclaimer: { ...type.caption, lineHeight: 17 },
  confirmButton: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  confirmButtonDisabled: { opacity: 0.45 },
  confirmText: { color: colors.white, fontSize: 13, fontWeight: "700" },
});
