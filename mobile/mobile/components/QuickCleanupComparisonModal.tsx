import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, spacing, type } from "../constants/design";
import { t } from "../lib/i18n";
import type { QuickCleanupGroupChoice } from "../lib/quick-cleanup-group-policy";
import type { QuickCleanupAction } from "../lib/quick-cleanup-plan";
import type { QuickCleanupReviewGroup, QuickCleanupTrimOption } from "../lib/quick-cleanup-service";

type Props = {
  group: QuickCleanupReviewGroup | null;
  choice: QuickCleanupGroupChoice | null;
  trimOptions: QuickCleanupTrimOption[];
  protectedIds: Set<string>;
  onClose: () => void;
  onApply: (choice: QuickCleanupGroupChoice) => void;
};

function sourceUri(photo: QuickCleanupReviewGroup["photos"][number]): string {
  return photo.localUri ?? photo.uri;
}

function ChoiceButton({
  action,
  selected,
  disabled = false,
  onPress,
}: {
  action: QuickCleanupAction;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const tint = action === "delete" ? colors.danger : action === "trim" ? colors.primary : colors.sageDeep;
  const icon = action === "delete" ? "trash-outline" : action === "trim" ? "cut-outline" : "checkmark-circle-outline";
  const label = action === "delete" ? t("ui.delete-label") : action === "trim" ? t("ui.trim-label") : t("ui.keep-label");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choiceButton,
        selected && { borderColor: tint, backgroundColor: `${tint}14` },
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={16} color={selected ? tint : colors.textMuted} />
      <Text style={[styles.choiceButtonText, selected && { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

export function QuickCleanupComparisonModal({
  group,
  choice,
  trimOptions,
  protectedIds,
  onClose,
  onApply,
}: Props) {
  const [comparisonId, setComparisonId] = useState<string | null>(null);
  const [keptIds, setKeptIds] = useState<Set<string>>(new Set());
  const [keptAction, setKeptAction] = useState<"keep" | "trim">("keep");
  const [unkeptAction, setUnkeptAction] = useState<QuickCleanupAction>("keep");
  const photoIdsKey = group?.photos.map((photo) => photo.id).join("\u001f") ?? "";
  const choiceKey = choice
    ? `${choice.keptIds.join("\u001f")}\u001e${choice.keptAction}\u001e${choice.unkeptAction}`
    : "";

  useEffect(() => {
    if (!group) return;
    const favoredId = group.photos.some((photo) => photo.id === group.suggestedKeeperId)
      ? group.suggestedKeeperId
      : group.photos[0]?.id;
    const other = group.photos.find((photo) => photo.id !== favoredId);
    const [choiceIds = "", choiceKeptAction = "keep", choiceUnkeptAction = "keep"] = choiceKey.split("\u001e");
    const chosenIds = choiceIds.split("\u001f").filter(Boolean);
    setComparisonId(other?.id ?? null);
    const initialKeptIds = chosenIds.length ? chosenIds : favoredId ? [favoredId] : [];
    setKeptIds(new Set([
      ...initialKeptIds,
      ...group.photos.filter((photo) => protectedIds.has(photo.id)).map((photo) => photo.id),
    ]));
    setKeptAction(choiceKeptAction === "trim" ? "trim" : "keep");
    setUnkeptAction(choiceUnkeptAction === "trim" || choiceUnkeptAction === "delete" ? choiceUnkeptAction : "keep");
  }, [choiceKey, group, photoIdsKey, protectedIds]);

  const trimOptionIds = useMemo(() => new Set(trimOptions.map((option) => option.photoId)), [trimOptions]);
  if (!group || group.photos.length < 2) return null;

  const favored = group.photos.find((photo) => photo.id === group.suggestedKeeperId) ?? group.photos[0];
  const alternatives = group.photos.filter((photo) => photo.id !== favored.id);
  const comparison = alternatives.find((photo) => photo.id === comparisonId) ?? alternatives[0];
  const keptPhotos = group.photos.filter((photo) => keptIds.has(photo.id));
  const unkeptPhotos = group.photos.filter((photo) => !keptIds.has(photo.id));
  const canTrimKept = keptPhotos.some((photo) => trimOptionIds.has(photo.id));
  const canTrimUnkept = unkeptPhotos.some((photo) => trimOptionIds.has(photo.id));
  const canDeleteUnkept = unkeptPhotos.some((photo) => !protectedIds.has(photo.id));

  function toggleKept(photoId: string) {
    if (protectedIds.has(photoId)) return;
    setKeptIds((current) => {
      const next = new Set(current);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  function renderKeepToggle(photoId: string) {
    const isProtected = protectedIds.has(photoId);
    const selected = isProtected || keptIds.has(photoId);
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected, disabled: isProtected }}
        disabled={isProtected}
        onPress={() => toggleKept(photoId)}
        style={[styles.keepToggle, selected && styles.keepToggleSelected, isProtected && styles.keepToggleProtected]}
      >
        <Ionicons
          name={isProtected ? "shield-checkmark" : selected ? "checkmark-circle" : "ellipse-outline"}
          size={18}
          color={selected ? colors.sageDeep : colors.textMuted}
        />
        <Text style={[styles.keepToggleText, selected && styles.keepToggleTextSelected]}>{isProtected ? t("ui.protect") : t("ui.keep")}</Text>
      </Pressable>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{group.kind === "exact" ? t("ui.suggested-delete") : t("ui.similar-photos")}</Text>
            <Text style={styles.title}>{t("ui.photos-to-compare", { count: group.photos.length })}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => onApply({ keptIds: [...keptIds], keptAction, unkeptAction })}
            style={styles.doneButton}
          >
            <Text style={styles.doneText}>{t("ui.done")}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.compareRow}>
            <View style={styles.comparePane}>
              <Text style={styles.compareLabel}>{t("ui.suggested-to-keep")}</Text>
              <View style={[styles.compareImageWrap, styles.favoredImageWrap]}>
                <Image source={{ uri: sourceUri(favored) }} style={styles.compareImage} resizeMode="contain" />
                <View style={styles.sparkleBadge}><Ionicons name="sparkles" size={15} color={colors.white} /></View>
              </View>
              <Text numberOfLines={1} style={styles.photoName}>{favored.title || t("ui.photo")}</Text>
              {renderKeepToggle(favored.id)}
            </View>

            <View style={styles.comparePane}>
              <Text style={styles.compareLabel}>{t("ui.other-photos")}</Text>
              <View style={styles.compareImageWrap}>
                <Image source={{ uri: sourceUri(comparison) }} style={styles.compareImage} resizeMode="contain" />
              </View>
              <Text numberOfLines={1} style={styles.photoName}>{comparison.title || t("ui.photo")}</Text>
              {renderKeepToggle(comparison.id)}
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
            {alternatives.map((photo) => {
              const active = photo.id === comparison.id;
              const kept = keptIds.has(photo.id);
              return (
                <Pressable
                  key={photo.id}
                  accessibilityRole="button"
                  onPress={() => setComparisonId(photo.id)}
                  style={[styles.thumbnailWrap, active && styles.thumbnailWrapActive]}
                >
                  <Image source={{ uri: sourceUri(photo) }} style={styles.thumbnail} />
                  {kept ? <View style={styles.thumbnailCheck}><Ionicons name="checkmark" size={12} color={colors.white} /></View> : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.decisionCard}>
            <Text style={styles.decisionTitle}>{t("ui.kept-photos")}</Text>
            <Text style={styles.decisionCount}>{t("ui.photos-count", { count: keptPhotos.length })}</Text>
            <View style={styles.choiceRow}>
              <ChoiceButton action="keep" selected={keptAction === "keep"} onPress={() => setKeptAction("keep")} />
              <ChoiceButton action="trim" selected={keptAction === "trim"} disabled={!canTrimKept} onPress={() => setKeptAction("trim")} />
            </View>
          </View>

          <View style={styles.decisionCard}>
            <Text style={styles.decisionTitle}>{t("ui.unkept-photos")}</Text>
            <Text style={styles.decisionCount}>{t("ui.photos-count", { count: unkeptPhotos.length })}</Text>
            <View style={styles.choiceRow}>
              <ChoiceButton action="keep" selected={unkeptAction === "keep"} onPress={() => setUnkeptAction("keep")} />
              <ChoiceButton action="trim" selected={unkeptAction === "trim"} disabled={!canTrimUnkept} onPress={() => setUnkeptAction("trim")} />
              <ChoiceButton action="delete" selected={unkeptAction === "delete"} disabled={!canDeleteUnkept} onPress={() => setUnkeptAction("delete")} />
            </View>
          </View>

          <Text style={styles.disclaimer}>{t("ui.duplicate-suggestions-disclaimer")}</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.cardSoft },
  headerCopy: { flex: 1, alignItems: "center", gap: 2 },
  eyebrow: { ...type.eyebrow, color: colors.sageDeep },
  title: { ...type.subtitle, color: colors.text, textAlign: "center" },
  doneButton: { minWidth: 52, minHeight: 42, alignItems: "flex-end", justifyContent: "center" },
  doneText: { color: colors.primary, fontSize: 14, fontWeight: "900" },
  content: { padding: spacing.lg, paddingBottom: 48, gap: spacing.lg },
  compareRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  comparePane: { flex: 1, minWidth: 0, gap: 7 },
  compareLabel: { minHeight: 30, color: colors.textMuted, fontSize: 10, lineHeight: 14, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.35 },
  compareImageWrap: { width: "100%", aspectRatio: 0.84, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.cardSoft, borderWidth: 2, borderColor: colors.border },
  favoredImageWrap: { borderColor: colors.sage },
  compareImage: { width: "100%", height: "100%" },
  sparkleBadge: { position: "absolute", right: 8, top: 8, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.sageDeep },
  photoName: { color: colors.text, fontSize: 11, fontWeight: "800" },
  keepToggle: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: radius.sm, backgroundColor: colors.cardSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  keepToggleSelected: { backgroundColor: colors.sageSoft, borderColor: colors.sage },
  keepToggleProtected: { opacity: 0.72 },
  keepToggleText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  keepToggleTextSelected: { color: colors.sageDeep },
  thumbnailRow: { gap: spacing.sm, paddingVertical: 2 },
  thumbnailWrap: { width: 68, height: 68, borderRadius: radius.sm, overflow: "hidden", borderWidth: 2, borderColor: "transparent", backgroundColor: colors.cardSoft },
  thumbnailWrapActive: { borderColor: colors.primary },
  thumbnail: { width: "100%", height: "100%" },
  thumbnailCheck: { position: "absolute", right: 4, top: 4, width: 19, height: 19, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.sageDeep },
  decisionCard: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  decisionTitle: { ...type.subtitle, color: colors.text },
  decisionCount: { ...type.caption, color: colors.textMuted },
  choiceRow: { flexDirection: "row", gap: spacing.sm },
  choiceButton: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: radius.sm, backgroundColor: colors.cardSoft, borderWidth: 1, borderColor: colors.border },
  choiceButtonText: { color: colors.textMuted, fontSize: 11, fontWeight: "900" },
  disabled: { opacity: 0.38 },
  disclaimer: { ...type.caption, color: colors.textMuted, lineHeight: 17 },
});
