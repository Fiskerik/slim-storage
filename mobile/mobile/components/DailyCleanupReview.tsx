import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { t } from "../lib/i18n";
import { selectSuggestedTrimIds, type DailyCleanupAction, type DailyCleanupItem, type DailyCleanupPlan } from "../lib/daily-photo-cleanup";
import { colors, radius, spacing, type } from "../constants/design";

type Props = {
  plan: DailyCleanupPlan | null;
  loading: boolean;
  error: "permission" | "error" | null;
  trimsRemaining: number;
  onBack: () => void;
  onOpenSettings: () => void;
  onConfirm: (deletes: DailyCleanupItem[], trims: DailyCleanupItem[]) => void;
};

function formatMB(value: number): string {
  return value >= 1024 ? `${(value / 1024).toFixed(2)} GB` : `${value.toFixed(1)} MB`;
}

function actionLabel(action: DailyCleanupAction): string {
  if (action === "trim") return t("ui.trim-label");
  if (action === "delete") return t("ui.delete-label");
  return t("ui.keep-label");
}

function actionColor(action: DailyCleanupAction): string {
  if (action === "trim") return colors.primary;
  if (action === "delete") return colors.danger;
  return colors.textMuted;
}

export function DailyCleanupReview({
  plan,
  loading,
  error,
  trimsRemaining,
  onBack,
  onOpenSettings,
  onConfirm,
}: Props) {
  const trimLimit = Math.max(0, Math.floor(trimsRemaining));
  const [selectedActions, setSelectedActions] = useState<Record<string, DailyCleanupAction>>({});
  const [fullPhoto, setFullPhoto] = useState<DailyCleanupItem | null>(null);
  const [comparison, setComparison] = useState<{ keeper: DailyCleanupItem; candidate: DailyCleanupItem } | null>(null);
  const [limitMessage, setLimitMessage] = useState(false);

  useEffect(() => {
    if (!plan) return;
    const next: Record<string, DailyCleanupAction> = {};
    const selectedTrimIds = selectSuggestedTrimIds(plan, trimLimit);
    plan.items.forEach((item) => {
      if (item.suggestedAction === "delete") next[item.photo.id] = "delete";
      else if (selectedTrimIds.has(item.photo.id)) {
        next[item.photo.id] = "trim";
      } else next[item.photo.id] = "keep";
    });
    setSelectedActions(next);
    setLimitMessage(plan.trimSuggestions.length > selectedTrimIds.size);
  }, [plan, trimLimit]);

  const chosen = useMemo(() => {
    if (!plan) return { deletes: [] as DailyCleanupItem[], trims: [] as DailyCleanupItem[], saved: 0 };
    const deletes = plan.items.filter((item) => selectedActions[item.photo.id] === "delete");
    const trims = plan.items.filter((item) => selectedActions[item.photo.id] === "trim");
    return {
      deletes,
      trims,
      saved: deletes.reduce((sum, item) => sum + item.photo.sizeMB, 0) + trims.reduce((sum, item) => sum + item.trimSavingsMB, 0),
    };
  }, [plan, selectedActions]);

  function cycleAction(item: DailyCleanupItem) {
    const current = selectedActions[item.photo.id] ?? "keep";
    const next: DailyCleanupAction = current === "keep" ? "trim" : current === "trim" ? "delete" : "keep";
    if (next === "trim" && !item.canTrim) {
      setLimitMessage(true);
      return;
    }
    if (next === "trim" && current !== "trim" && chosen.trims.length >= trimLimit) {
      if (trimLimit > 0 && chosen.trims.length > 0) {
        const replacement = [...chosen.trims].sort((a, b) => a.trimSavingsMB - b.trimSavingsMB)[0];
        if (replacement && replacement.photo.id !== item.photo.id) {
          setSelectedActions((value) => ({ ...value, [replacement.photo.id]: "keep", [item.photo.id]: "trim" }));
          setLimitMessage(false);
          return;
        }
      }
      setLimitMessage(true);
      return;
    }
    setLimitMessage(false);
    setSelectedActions((value) => ({ ...value, [item.photo.id]: next }));
  }

  function selectAllTrims() {
    if (!plan) return;
    const selectedTrimIds = selectSuggestedTrimIds(plan, trimLimit);
    const next: Record<string, DailyCleanupAction> = {};
    plan.items.forEach((item) => {
      if (item.suggestedAction === "delete") next[item.photo.id] = "delete";
      else if (selectedTrimIds.has(item.photo.id)) next[item.photo.id] = "trim";
      else next[item.photo.id] = "keep";
    });
    setSelectedActions(next);
    setLimitMessage(plan.trimSuggestions.length > selectedTrimIds.size);
  }

  function setComparisonAction(item: DailyCleanupItem, action: DailyCleanupAction) {
    if (action === "delete" && (item.duplicateKeeperId === item.photo.id || item.photo.isCloudAsset)) return;
    if (action === "trim") {
      if (!item.canTrim) return;
      const current = selectedActions[item.photo.id] ?? "keep";
      if (current !== "trim" && chosen.trims.length >= trimLimit) {
        setLimitMessage(true);
        return;
      }
    }
    setLimitMessage(false);
    setSelectedActions((value) => ({ ...value, [item.photo.id]: action }));
  }

  function openComparison(item: DailyCleanupItem) {
    if (!plan || !item.duplicateGroupId) return;
    const keeper = plan.items.find((candidate) => candidate.photo.id === item.duplicateKeeperId) ?? item;
    const candidate = item.photo.id === keeper.photo.id
      ? plan.items.find((photo) => photo.duplicateGroupId === item.duplicateGroupId && photo.photo.id !== keeper.photo.id) ?? item
      : item;
    setComparison({ keeper, candidate });
  }

  if (error === "permission") {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={44} color={colors.primary} />
        <Text style={styles.heroTitle}>{t("ui.today-photos")}</Text>
        <Text style={styles.centerText}>{t("ui.photo-access-needed")}</Text>
        <Text style={styles.centerText}>{t("ui.open-ios-settings-to-preview-cleanup-folders")}</Text>
        <Pressable style={styles.primaryButton} onPress={onOpenSettings}>
          <Text style={styles.primaryButtonText}>{t("ui.open-settings")}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t("ui.back-home")}</Text>
        </Pressable>
      </View>
    );
  }

  if (error === "error") {
    return (
      <View style={styles.centered}>
        <Ionicons name="warning-outline" size={44} color={colors.danger} />
        <Text style={styles.heroTitle}>{t("ui.preview-failed")}</Text>
        <Text style={styles.centerText}>{t("ui.could-not-build-this-cleanup-folder")}</Text>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t("ui.back-home")}</Text>
        </Pressable>
      </View>
    );
  }

  if (loading || !plan) {
    return (
      <View style={styles.centered}>
        <Ionicons name="sparkles-outline" size={34} color={colors.primary} />
        <Text style={styles.heroTitle}>{t("ui.today-photos")}</Text>
        <Text style={styles.muted}>{t("ui.daily-cleanup-loading")}</Text>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t("ui.back-home")}</Text>
        </Pressable>
      </View>
    );
  }

  if (plan.items.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="checkmark-circle-outline" size={44} color={colors.sageDeep} />
        <Text style={styles.heroTitle}>{t("ui.today-photos")}</Text>
        <Text style={styles.centerText}>{t("ui.no-photos-today")}</Text>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t("ui.back-home")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{t("ui.today")}</Text>
          <Text style={styles.title}>{t("ui.today-photos")}</Text>
          <Text style={styles.muted}>{plan.items.length} photos · {t("ui.daily-cleanup-savings", { value: formatMB(chosen.saved) })}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.closeButton}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.trimAllRow}>
        <Pressable
          accessibilityRole="button"
          onPress={selectAllTrims}
          disabled={plan.trimSuggestions.length === 0}
          style={[styles.trimAllButton, plan.trimSuggestions.length === 0 && styles.disabled]}
        >
          <Ionicons name="cut-outline" size={17} color={colors.white} />
          <Text style={styles.trimAllText}>{t("ui.trim-all")}</Text>
        </Pressable>
      </View>
      {limitMessage ? <Text style={styles.warning}>{t("ui.not-enough-tokens-count", { selected: trimLimit, total: plan.trimSuggestions.length })}</Text> : null}
      {plan.similarityAnalysis === "unavailable" ? <Text style={styles.muted}>{t("ui.duplicate-suggestions-disclaimer")}</Text> : null}
      <FlatList
        data={plan.items}
        keyExtractor={(item) => item.photo.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const selectedAction = selectedActions[item.photo.id] ?? "keep";
          const suggestion = item.suggestedAction === "delete"
            ? t("ui.suggested-delete")
            : item.suggestedAction === "trim"
              ? t("ui.suggested-trim")
              : item.reason;
          const isSuggested = item.suggestedAction !== "keep";
          const duplicateMembers = item.duplicateGroupId
            ? plan.items.filter((candidate) => candidate.duplicateGroupId === item.duplicateGroupId)
            : [];
          const isKeeper = item.duplicateKeeperId === item.photo.id;
          return (
            <View style={styles.row}>
              <Pressable onPress={() => item.duplicateGroupId ? openComparison(item) : setFullPhoto(item)} style={[styles.thumbButton, isKeeper && duplicateMembers.length > 1 && styles.keeperThumb]}>
                <Image source={{ uri: item.photo.localUri ?? item.photo.uri }} style={styles.thumb} />
                <View style={styles.previewBadge}><Ionicons name="expand-outline" size={13} color={colors.white} /></View>
              </Pressable>
              <View style={styles.rowCopy}>
                <Text numberOfLines={1} style={styles.photoTitle}>{item.photo.title || t("ui.photo")}</Text>
                <Text numberOfLines={2} style={styles.reason}>{suggestion}</Text>
                {isKeeper ? <Text style={styles.keeper}>{t("ui.keeper")}</Text> : null}
                {isKeeper && duplicateMembers.length > 1 ? (
                  <View style={styles.duplicateCompareStrip}>
                    <Text style={styles.duplicateCompareLabel}>{t("ui.compare-similar")}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.duplicateCompareThumbs} nestedScrollEnabled>
                      {duplicateMembers.filter((candidate) => candidate.photo.id !== item.photo.id).map((candidate) => (
                        <Pressable key={candidate.photo.id} onPress={() => openComparison(candidate)} style={styles.duplicateCompareThumbButton}>
                          <Image source={{ uri: candidate.photo.localUri ?? candidate.photo.uri }} style={styles.duplicateCompareThumb} />
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
                {isSuggested && selectedAction === "keep" ? <Text style={styles.unselected}>{t("ui.keep-label")} · {suggestion}</Text> : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${actionLabel(selectedAction)} ${item.photo.title || t("ui.photo")}`}
                onPress={() => cycleAction(item)}
                style={[styles.actionButton, { borderColor: actionColor(selectedAction), backgroundColor: `${actionColor(selectedAction)}15` }]}
              >
                <Text style={[styles.actionText, { color: actionColor(selectedAction) }]}>{actionLabel(selectedAction)}</Text>
                <Ionicons name="chevron-down" size={14} color={actionColor(selectedAction)} />
              </Pressable>
            </View>
          );
        }}
      />
      <View style={styles.footer}>
        <Pressable
          disabled={chosen.deletes.length === 0 && chosen.trims.length === 0}
          onPress={() => onConfirm(chosen.deletes, chosen.trims)}
          style={[styles.applyButton, chosen.deletes.length === 0 && chosen.trims.length === 0 && styles.disabled]}
        >
          <Ionicons name="sparkles-outline" size={18} color={colors.white} />
          <Text style={styles.applyText}>{t("ui.apply-save", { value: formatMB(chosen.saved) })}</Text>
        </Pressable>
        <Pressable onPress={onBack} style={styles.keepButton}>
          <Text style={styles.keepButtonText}>{t("ui.keep-them-all")}</Text>
        </Pressable>
      </View>
      <Modal visible={fullPhoto != null} transparent animationType="fade" onRequestClose={() => setFullPhoto(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFullPhoto(null)}>
          {fullPhoto ? <Image source={{ uri: fullPhoto.photo.localUri ?? fullPhoto.photo.uri }} style={styles.fullPhoto} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
      <Modal visible={comparison != null} transparent animationType="slide" onRequestClose={() => setComparison(null)}>
        <View style={styles.compareBackdrop}>
          {comparison ? (
            <View style={styles.compareCard}>
              <View style={styles.compareHeader}>
                <Text style={styles.compareTitle}>{t("ui.compare-similar")}</Text>
                <Pressable onPress={() => setComparison(null)}><Ionicons name="close" size={22} color={colors.text} /></Pressable>
              </View>
              <View style={styles.comparePhotoRow}>
                <View style={styles.comparePane}>
                  <Image source={{ uri: comparison.keeper.photo.localUri ?? comparison.keeper.photo.uri }} style={styles.compareImage} resizeMode="cover" />
                  <Text style={styles.compareLabel}>{t("ui.keeper")}</Text>
                  <Pressable style={styles.compareKeepButton} onPress={() => setComparisonAction(comparison.keeper, "keep")}><Text style={styles.compareKeepText}>{t("ui.keep-label")}</Text></Pressable>
                </View>
                <View style={styles.comparePane}>
                  <Image source={{ uri: comparison.candidate.photo.localUri ?? comparison.candidate.photo.uri }} style={styles.compareImage} resizeMode="cover" />
                  <Text numberOfLines={1} style={styles.compareLabel}>{comparison.candidate.photo.title || t("ui.photo")}</Text>
                  <View style={styles.compareActions}>
                    <Pressable style={styles.compareKeepButton} onPress={() => setComparisonAction(comparison.candidate, "keep")}><Text style={styles.compareKeepText}>{t("ui.keep-label")}</Text></Pressable>
                    <Pressable disabled={comparison.candidate.photo.isCloudAsset} style={[styles.compareDeleteButton, comparison.candidate.photo.isCloudAsset && styles.disabled]} onPress={() => setComparisonAction(comparison.candidate, "delete")}><Text style={styles.compareDeleteText}>{t("ui.delete-label")}</Text></Pressable>
                  </View>
                </View>
              </View>
              <Pressable style={styles.compareDoneButton} onPress={() => setComparison(null)}><Text style={styles.compareDoneText}>{t("ui.done")}</Text></Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
  heroTitle: { ...type.title, color: colors.text, textAlign: "center" },
  centerText: { ...type.body, color: colors.textMuted, textAlign: "center" },
  muted: { ...type.caption, color: colors.textMuted },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { ...type.eyebrow, color: colors.primary },
  title: { ...type.title, color: colors.text },
  closeButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.cardSoft },
  trimAllRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  trimAllButton: { alignSelf: "flex-start", minHeight: 38, borderRadius: radius.pill, paddingHorizontal: spacing.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  trimAllText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  warning: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, color: colors.danger, fontSize: 12, fontWeight: "700" },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  thumbButton: { width: 68, height: 68, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.borderSoft },
  keeperThumb: { borderWidth: 2, borderColor: colors.sage },
  thumb: { width: "100%", height: "100%" },
  previewBadge: { position: "absolute", right: 4, bottom: 4, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,23,42,0.68)" },
  rowCopy: { flex: 1, gap: 3 },
  photoTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  reason: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  keeper: { color: colors.sageDeep, fontSize: 10, fontWeight: "800" },
  unselected: { color: colors.primary, fontSize: 10, fontWeight: "700" },
  duplicateCompareStrip: { marginTop: 4, gap: 3 },
  duplicateCompareLabel: { color: colors.sageDeep, fontSize: 9, fontWeight: "900" },
  duplicateCompareThumbs: { gap: 5 },
  duplicateCompareThumbButton: { width: 34, height: 34, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  duplicateCompareThumb: { width: "100%", height: "100%" },
  actionButton: { minWidth: 66, minHeight: 38, paddingHorizontal: 6, borderRadius: radius.sm, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 2 },
  actionText: { fontSize: 10, fontWeight: "900" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  applyButton: { minHeight: 50, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  applyText: { color: colors.white, fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  keepButton: { minHeight: 34, alignItems: "center", justifyContent: "center" },
  keepButtonText: { color: colors.textMuted, fontWeight: "800", fontSize: 12 },
  secondaryButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.cardSoft },
  secondaryButtonText: { color: colors.text, fontWeight: "800" },
  primaryButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary },
  primaryButtonText: { color: colors.white, fontWeight: "800" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.92)", alignItems: "center", justifyContent: "center" },
  fullPhoto: { width: "94%", height: "82%" },
  compareBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.72)", justifyContent: "flex-end" },
  compareCard: { backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  compareHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  compareTitle: { ...type.title, color: colors.text },
  comparePhotoRow: { flexDirection: "row", gap: spacing.sm },
  comparePane: { flex: 1, gap: 6 },
  compareImage: { width: "100%", aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.borderSoft },
  compareLabel: { color: colors.text, fontSize: 11, fontWeight: "900" },
  compareActions: { gap: 6 },
  compareKeepButton: { minHeight: 36, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.sageSoft },
  compareKeepText: { color: colors.sageDeep, fontSize: 11, fontWeight: "900" },
  compareDeleteButton: { minHeight: 36, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.dangerSoft },
  compareDeleteText: { color: colors.danger, fontSize: 11, fontWeight: "900" },
  compareDoneButton: { minHeight: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  compareDoneText: { color: colors.white, fontSize: 13, fontWeight: "900" },
});
