import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import {
  defaultQuickCleanupGroupChoice,
  resolveQuickCleanupGroupActions,
  type QuickCleanupGroupChoice,
} from "../lib/quick-cleanup-group-policy";
import { monthKey, type MonthCleanupProgress, type QuickCleanupAction, type QuickCleanupItem, type QuickCleanupPlan } from "../lib/quick-cleanup-plan";
import type { NativeLibraryScanProgress, NativePhoto } from "../lib/native-photo-source";
import type { QuickCleanupReviewGroup, QuickCleanupTrimOption } from "../lib/quick-cleanup-service";
import { QuickCleanupComparisonModal } from "./QuickCleanupComparisonModal";

type Props = {
  plan: QuickCleanupPlan | null;
  groups: QuickCleanupReviewGroup[];
  trimOptions: QuickCleanupTrimOption[];
  months: MonthCleanupProgress[];
  loading: boolean;
  progress?: NativeLibraryScanProgress | null;
  error: "permission" | "error" | null;
  trimsRemaining: number;
  onBack: () => void;
  onStartScan: () => void;
  onOpenSettings: () => void;
  onConfirm: (deletes: NativePhoto[], trims: NativePhoto[]) => void;
  onProtect: (photo: NativePhoto, protectedState: boolean) => void;
  onDecideLater: (photo: NativePhoto) => void;
};

type ReviewEntry =
  | { key: string; type: "group"; group: QuickCleanupReviewGroup }
  | { key: string; type: "photo"; item: QuickCleanupItem };

function formatMB(value: number): string {
  return value >= 1024 ? `${(value / 1024).toFixed(2)} GB` : `${value.toFixed(1)} MB`;
}

function actionLabel(action: QuickCleanupAction): string {
  if (action === "trim") return t("ui.trim-label");
  if (action === "delete") return t("ui.delete-label");
  return t("ui.keep-label");
}

function actionColor(action: QuickCleanupAction): string {
  if (action === "trim") return colors.primary;
  if (action === "delete") return colors.danger;
  return colors.textMuted;
}

function usablePhoto(photo: NativePhoto | null | undefined): photo is NativePhoto {
  return Boolean(photo?.id && photo.uri);
}

function usableItems(items: QuickCleanupItem[] | undefined): QuickCleanupItem[] {
  return (items ?? []).filter((item): item is QuickCleanupItem => usablePhoto(item?.photo));
}

function usableGroups(groups: QuickCleanupReviewGroup[]): QuickCleanupReviewGroup[] {
  const claimedPhotoIds = new Set<string>();
  return groups.flatMap((group) => {
    const photos = group.photos.filter(usablePhoto).filter((photo) => !claimedPhotoIds.has(photo.id));
    if (photos.length < 2) return [];
    photos.forEach((photo) => claimedPhotoIds.add(photo.id));
    return [{
      ...group,
      photos,
      suggestedKeeperId: photos.some((photo) => photo.id === group.suggestedKeeperId)
        ? group.suggestedKeeperId
        : photos[0].id,
    }];
  });
}

export function QuickCleanupReview({
  plan,
  groups,
  trimOptions,
  months,
  loading,
  progress,
  error,
  trimsRemaining,
  onBack,
  onStartScan,
  onOpenSettings,
  onConfirm,
  onProtect,
  onDecideLater,
}: Props) {
  const [selectedActions, setSelectedActions] = useState<Record<string, QuickCleanupAction>>({});
  const [protectedIds, setProtectedIds] = useState<Set<string>>(new Set());
  const [fullPhoto, setFullPhoto] = useState<NativePhoto | null>(null);
  const [activeGroup, setActiveGroup] = useState<QuickCleanupReviewGroup | null>(null);
  const [groupChoices, setGroupChoices] = useState<Record<string, QuickCleanupGroupChoice>>({});
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const trimLimit = Math.max(0, Math.floor(trimsRemaining));
  const safeItems = useMemo(() => usableItems(plan?.items), [plan]);
  const safeGroups = useMemo(() => usableGroups(groups), [groups]);
  const groupedPhotoIds = useMemo(
    () => new Set(safeGroups.flatMap((group) => group.photos.map((photo) => photo.id))),
    [safeGroups],
  );
  const trimOptionById = useMemo(
    () => new Map(trimOptions.map((option) => [option.photoId, option])),
    [trimOptions],
  );
  const allPhotos = useMemo(() => {
    const byId = new Map<string, NativePhoto>();
    safeGroups.forEach((group) => group.photos.forEach((photo) => byId.set(photo.id, photo)));
    safeItems.forEach((item) => byId.set(item.photo.id, item.photo));
    return [...byId.values()];
  }, [safeGroups, safeItems]);

  useEffect(() => {
    if (!plan) return;
    const actions = Object.fromEntries(safeItems.map((item) => [
      item.photo.id,
      groupedPhotoIds.has(item.photo.id) ? "keep" : item.selected ? item.action : "keep",
    ] as const));
    safeGroups.forEach((group) => group.photos.forEach((photo) => {
      actions[photo.id] = "keep";
    }));
    setSelectedActions(actions);
    setProtectedIds(new Set(plan.protectedIds));
    setGroupChoices(Object.fromEntries(safeGroups.map((group) => [group.id, defaultQuickCleanupGroupChoice(group)])));
    setSelectedMonth(null);
  }, [groupedPhotoIds, plan, safeGroups, safeItems]);

  const standaloneItems = useMemo(
    () => safeItems.filter((item) => !groupedPhotoIds.has(item.photo.id)),
    [groupedPhotoIds, safeItems],
  );
  const entries = useMemo<ReviewEntry[]>(() => {
    const visibleGroups = selectedMonth
      ? safeGroups.filter((group) => group.photos.some((photo) => monthKey(photo.creationTime) === selectedMonth))
      : safeGroups;
    const visiblePhotos = selectedMonth
      ? standaloneItems.filter((item) => monthKey(item.photo.creationTime) === selectedMonth)
      : standaloneItems;
    return [
      ...visibleGroups.map((group) => ({ key: `group:${group.id}`, type: "group" as const, group })),
      ...visiblePhotos.map((item) => ({ key: `photo:${item.photo.id}`, type: "photo" as const, item })),
    ];
  }, [safeGroups, selectedMonth, standaloneItems]);

  const chosen = useMemo(() => {
    const deletes = allPhotos.filter((photo) => selectedActions[photo.id] === "delete" && !protectedIds.has(photo.id));
    const trims = allPhotos.filter((photo) => selectedActions[photo.id] === "trim" && trimOptionById.has(photo.id));
    return {
      deletes,
      trims,
      saved: deletes.reduce((sum, photo) => sum + photo.sizeMB, 0) + trims.reduce((sum, photo) => sum + (trimOptionById.get(photo.id)?.estimatedSavingsMB ?? 0), 0),
    };
  }, [allPhotos, protectedIds, selectedActions, trimOptionById]);

  function cycleAction(item: QuickCleanupItem) {
    if (protectedIds.has(item.photo.id)) return;
    const current = selectedActions[item.photo.id] ?? "keep";
    const choices: QuickCleanupAction[] = item.action === "trim" ? ["keep", "trim"] : ["keep", "delete"];
    const next = choices[(choices.indexOf(current) + 1) % choices.length];
    if (next === "trim" && current !== "trim" && chosen.trims.length >= trimLimit) return;
    setSelectedActions((value) => ({ ...value, [item.photo.id]: next }));
  }

  function toggleProtection(photo: NativePhoto) {
    const next = !protectedIds.has(photo.id);
    setProtectedIds((value) => {
      const copy = new Set(value);
      if (next) copy.add(photo.id);
      else copy.delete(photo.id);
      return copy;
    });
    setSelectedActions((value) => ({ ...value, [photo.id]: "keep" }));
    onProtect(photo, next);
  }

  function applyGroupChoice(group: QuickCleanupReviewGroup, choice: QuickCleanupGroupChoice) {
    const groupIds = new Set(group.photos.map((photo) => photo.id));
    const outsideTrimCount = Object.entries(selectedActions)
      .filter(([photoId, action]) => !groupIds.has(photoId) && action === "trim")
      .length;
    const groupActions = resolveQuickCleanupGroupActions({
      photos: group.photos,
      choice,
      trimOptions,
      protectedIds,
      trimLimit,
      existingTrimCount: outsideTrimCount,
    });

    setSelectedActions((current) => {
      return { ...current, ...groupActions };
    });
    setGroupChoices((current) => ({ ...current, [group.id]: choice }));
    setActiveGroup(null);
  }

  if (error === "permission") {
    return <View style={styles.centered}><Ionicons name="lock-closed-outline" size={44} color={colors.primary} /><Text style={styles.heroTitle}>{t("ui.free-space-plan")}</Text><Text style={styles.centerText}>{t("ui.photo-access-needed")}</Text><Pressable style={styles.primaryButton} onPress={onOpenSettings}><Text style={styles.primaryButtonText}>{t("ui.open-settings")}</Text></Pressable><Pressable style={styles.secondaryButton} onPress={onBack}><Text style={styles.secondaryButtonText}>{t("ui.back-home")}</Text></Pressable></View>;
  }
  if (error === "error") {
    return <View style={styles.centered}><Ionicons name="warning-outline" size={44} color={colors.danger} /><Text style={styles.heroTitle}>{t("ui.preview-failed")}</Text><Text style={styles.centerText}>{t("ui.could-not-build-this-cleanup-folder")}</Text><Pressable style={styles.secondaryButton} onPress={onBack}><Text style={styles.secondaryButtonText}>{t("ui.back-home")}</Text></Pressable></View>;
  }
  if (!plan) {
    const progressText = progress?.phase === "similarity" && progress.analysisTotal
      ? `${t("ui.home-scanning")} ${progress.analyzed ?? 0}/${progress.analysisTotal}`
      : progress?.total
        ? `${t("ui.scanning-library")} ${progress.scanned}/${progress.total}`
        : t("ui.you-can-keep-using-trimswipe-while-the-batch-run");
    return <View style={styles.centered}>
      {loading ? <ActivityIndicator size="large" color={colors.primary} /> : <Ionicons name="speedometer-outline" size={38} color={colors.primary} />}
      <Text style={styles.heroTitle}>{t("ui.free-space-plan")}</Text>
      <Text style={styles.centerText}>{loading ? progressText : t("ui.finding-the-photos-that-will-make-the-biggest-de")}</Text>
      {!loading ? <Pressable style={styles.primaryButton} onPress={onStartScan}><Text style={styles.primaryButtonText}>{t("ui.quick-scan")}</Text></Pressable> : null}
      <Pressable style={styles.secondaryButton} onPress={onBack}><Text style={styles.secondaryButtonText}>{t("ui.back-home")}</Text></Pressable>
    </View>;
  }
  if (entries.length === 0 && selectedMonth == null) {
    return <View style={styles.centered}><Ionicons name="checkmark-circle-outline" size={44} color={colors.sageDeep} /><Text style={styles.heroTitle}>{t("ui.no-saving")}</Text><Text style={styles.centerText}>{t("ui.no-local-photos-currently-have-useful-trim-savin")}</Text><Pressable style={styles.secondaryButton} onPress={onBack}><Text style={styles.secondaryButtonText}>{t("ui.back-home")}</Text></Pressable></View>;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{t("ui.quick-review")}</Text>
          <Text style={styles.title}>{t("ui.free-space-plan")}</Text>
          <Text style={styles.muted}>{formatMB(chosen.saved)} · {chosen.deletes.length + chosen.trims.length} actions</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.closeButton}><Ionicons name="close" size={22} color={colors.text} /></Pressable>
      </View>
      {loading ? <View style={styles.refreshing}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.refreshingText}>{t("ui.scanning")}</Text></View> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.months}>
        <Pressable onPress={() => setSelectedMonth(null)} style={[styles.monthPill, selectedMonth == null && styles.monthPillActive]}><Text style={styles.monthLabel}>{t("ui.all-count", { count: allPhotos.length })}</Text></Pressable>
        {months.slice(0, 6).map((month) => <Pressable key={month.key} onPress={() => setSelectedMonth(month.key)} style={[styles.monthPill, selectedMonth === month.key && styles.monthPillActive]}><Text style={styles.monthLabel}>{month.label}</Text><Text style={styles.monthValue}>{month.reviewedCount}/{month.photoCount} · {formatMB(month.reclaimableMB)}</Text><View style={styles.monthTrack}><View style={[styles.monthFill, { width: `${Math.round(month.progress * 100)}%` }]} /></View></Pressable>)}
      </ScrollView>
      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.key}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<View style={styles.emptyFilter}><Text style={styles.centerText}>{t("ui.no-saving")}</Text></View>}
        renderItem={({ item: entry }) => {
          if (entry.type === "group") {
            const { group } = entry;
            const favored = group.photos.find((photo) => photo.id === group.suggestedKeeperId) ?? group.photos[0];
            const groupDeleteCount = group.photos.filter((photo) => selectedActions[photo.id] === "delete").length;
            const groupTrimCount = group.photos.filter((photo) => selectedActions[photo.id] === "trim").length;
            return <Pressable accessibilityRole="button" onPress={() => setActiveGroup(group)} style={styles.groupRow}>
              <View style={styles.groupImageWrap}>
                <Image source={{ uri: favored.localUri ?? favored.uri }} style={styles.groupImage} />
                <View style={styles.groupCountBadge}><Ionicons name="images-outline" size={14} color={colors.white} /><Text style={styles.groupCountText}>+{group.photos.length - 1}</Text></View>
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.groupEyebrow}>{group.kind === "exact" ? t("ui.suggested-delete") : t("ui.similar-photos")}</Text>
                <Text numberOfLines={1} style={styles.photoTitle}>{favored.title || t("ui.photo")}</Text>
                <Text numberOfLines={1} style={styles.reason}>{t("ui.suggested-to-keep")}</Text>
                <Text style={styles.groupSummary}>{groupDeleteCount > 0 ? `${groupDeleteCount} ${t("ui.delete-label")}` : ""}{groupDeleteCount > 0 && groupTrimCount > 0 ? " · " : ""}{groupTrimCount > 0 ? `${groupTrimCount} ${t("ui.trim-label")}` : groupDeleteCount === 0 ? t("ui.compare-similar") : ""}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>;
          }

          const { item } = entry;
          const selectedAction = protectedIds.has(item.photo.id) ? "keep" : (selectedActions[item.photo.id] ?? "keep");
          return <View style={styles.photoRow}>
            <Pressable onPress={() => setFullPhoto(item.photo)} style={styles.thumbButton}><Image source={{ uri: item.photo.localUri ?? item.photo.uri }} style={styles.thumb} /><View style={styles.previewBadge}><Ionicons name="expand-outline" size={13} color={colors.white} /></View></Pressable>
            <View style={styles.photoRowBody}>
              <View style={styles.rowCopy}><Text style={styles.groupEyebrow}>{t("ui.quick-win")}</Text><Text numberOfLines={1} style={styles.photoTitle}>{item.photo.title || t("ui.photo")}</Text><Text numberOfLines={2} style={styles.reason}>{item.reason} · {formatMB(item.estimatedSavingsMB)}</Text></View>
              <View style={styles.rowControls}>
                <Pressable onPress={() => cycleAction(item)} disabled={protectedIds.has(item.photo.id)} style={[styles.actionButton, { borderColor: actionColor(selectedAction), backgroundColor: `${actionColor(selectedAction)}15` }]}><Text style={[styles.actionText, { color: actionColor(selectedAction) }]}>{actionLabel(selectedAction)}</Text></Pressable>
                <Pressable onPress={() => toggleProtection(item.photo)} style={[styles.toolButton, protectedIds.has(item.photo.id) && styles.toolButtonActive]}><Ionicons name={protectedIds.has(item.photo.id) ? "shield-checkmark" : "shield-outline"} size={16} color={protectedIds.has(item.photo.id) ? colors.sageDeep : colors.textMuted} /><Text style={[styles.toolText, protectedIds.has(item.photo.id) && styles.toolTextActive]}>{t("ui.protect")}</Text></Pressable>
                <Pressable onPress={() => onDecideLater(item.photo)} style={styles.toolButton}><Ionicons name="time-outline" size={16} color={colors.textMuted} /><Text style={styles.toolText}>{t("ui.decide-later")}</Text></Pressable>
              </View>
            </View>
          </View>;
        }}
      />
      <View style={styles.footer}><Pressable disabled={chosen.deletes.length === 0 && chosen.trims.length === 0} onPress={() => onConfirm(chosen.deletes, chosen.trims)} style={[styles.applyButton, chosen.deletes.length === 0 && chosen.trims.length === 0 && styles.disabled]}><Ionicons name="sparkles-outline" size={18} color={colors.white} /><Text style={styles.applyText}>{t("ui.apply-save", { value: formatMB(chosen.saved) })}</Text></Pressable><Pressable onPress={onBack} style={styles.keepButton}><Text style={styles.keepButtonText}>{t("ui.keep-them-all")}</Text></Pressable></View>
      <Modal visible={fullPhoto != null} transparent animationType="fade" onRequestClose={() => setFullPhoto(null)}><Pressable style={styles.modalBackdrop} onPress={() => setFullPhoto(null)}>{fullPhoto ? <Image source={{ uri: fullPhoto.localUri ?? fullPhoto.uri }} style={styles.fullPhoto} resizeMode="contain" /> : null}</Pressable></Modal>
      <QuickCleanupComparisonModal
        group={activeGroup}
        choice={activeGroup ? groupChoices[activeGroup.id] ?? defaultQuickCleanupGroupChoice(activeGroup) : null}
        trimOptions={trimOptions}
        protectedIds={protectedIds}
        onClose={() => setActiveGroup(null)}
        onApply={(choice) => activeGroup && applyGroupChoice(activeGroup, choice)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  refreshing: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  refreshingText: { color: colors.textMuted, fontSize: 11, fontWeight: "800" },
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
  months: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
  monthPill: { minWidth: 116, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  monthPillActive: { borderColor: colors.primary },
  monthLabel: { color: colors.text, fontSize: 12, fontWeight: "800" },
  monthValue: { color: colors.textMuted, fontSize: 10, marginTop: 3 },
  monthTrack: { height: 4, borderRadius: 2, backgroundColor: colors.borderSoft, marginTop: 7, overflow: "hidden" },
  monthFill: { height: "100%", backgroundColor: colors.sage },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 128 },
  emptyFilter: { paddingVertical: 48 },
  groupRow: { minHeight: 98, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  groupImageWrap: { width: 78, height: 78, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.borderSoft },
  groupImage: { width: "100%", height: "100%" },
  groupCountBadge: { position: "absolute", right: 5, bottom: 5, minWidth: 43, height: 25, paddingHorizontal: 6, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: "rgba(15,23,42,0.76)" },
  groupCountText: { color: colors.white, fontSize: 10, fontWeight: "900" },
  groupEyebrow: { color: colors.sageDeep, fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.35 },
  groupSummary: { color: colors.primary, fontSize: 10, fontWeight: "800" },
  photoRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  photoRowBody: { flex: 1, minWidth: 0, gap: 8 },
  thumbButton: { width: 62, height: 62, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.borderSoft },
  thumb: { width: "100%", height: "100%" },
  previewBadge: { position: "absolute", right: 4, bottom: 4, width: 21, height: 21, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,23,42,0.68)" },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  photoTitle: { color: colors.text, fontSize: 12, fontWeight: "800" },
  reason: { color: colors.textMuted, fontSize: 10, lineHeight: 14 },
  rowControls: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  actionButton: { minWidth: 68, minHeight: 34, paddingHorizontal: 8, borderRadius: radius.sm, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  actionText: { fontSize: 10, fontWeight: "900" },
  toolButton: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.cardSoft },
  toolButtonActive: { borderColor: colors.sage, backgroundColor: colors.sageSoft },
  toolText: { color: colors.textMuted, fontSize: 9, fontWeight: "800" },
  toolTextActive: { color: colors.sageDeep },
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
});
