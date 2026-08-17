import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { t } from "../lib/i18n";
import { monthKey, type MonthCleanupProgress, type QuickCleanupAction, type QuickCleanupItem, type QuickCleanupPlan } from "../lib/quick-cleanup-plan";
import { colors, radius, spacing, type } from "../constants/design";

type Props = {
  plan: QuickCleanupPlan | null;
  months: MonthCleanupProgress[];
  loading: boolean;
  error: "permission" | "error" | null;
  trimsRemaining: number;
  onBack: () => void;
  onChangeBudget: (budget: 30 | 120 | 300) => void;
  onChangeTarget: (targetMB: number | null) => void;
  onOpenSettings: () => void;
  onConfirm: (deletes: QuickCleanupItem[], trims: QuickCleanupItem[]) => void;
  onProtect: (item: QuickCleanupItem, protectedState: boolean) => void;
  onDecideLater: (item: QuickCleanupItem) => void;
};

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

export function QuickCleanupReview({
  plan,
  months,
  loading,
  error,
  trimsRemaining,
  onBack,
  onChangeBudget,
  onChangeTarget,
  onOpenSettings,
  onConfirm,
  onProtect,
  onDecideLater,
}: Props) {
  const [selectedActions, setSelectedActions] = useState<Record<string, QuickCleanupAction>>({});
  const [protectedIds, setProtectedIds] = useState<Set<string>>(new Set());
  const [fullPhoto, setFullPhoto] = useState<QuickCleanupItem | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const trimLimit = Math.max(0, Math.floor(trimsRemaining));

  useEffect(() => {
    if (!plan) return;
    setSelectedActions(Object.fromEntries(plan.items.map((item) => [item.photo.id, item.selected ? item.action : "keep"] as const)));
    setProtectedIds(new Set(plan.protectedIds));
    setSelectedMonth(null);
  }, [plan]);

  const visibleItems = useMemo(
    () => selectedMonth && plan ? plan.items.filter((item) => monthKey(item.photo.creationTime) === selectedMonth) : plan?.items ?? [],
    [plan, selectedMonth],
  );

  const chosen = useMemo(() => {
    if (!plan) return { deletes: [] as QuickCleanupItem[], trims: [] as QuickCleanupItem[], saved: 0 };
    const deletes = visibleItems.filter((item) => selectedActions[item.photo.id] === "delete");
    const trims = visibleItems.filter((item) => selectedActions[item.photo.id] === "trim");
    return {
      deletes,
      trims,
      saved: deletes.reduce((sum, item) => sum + item.estimatedSavingsMB, 0) + trims.reduce((sum, item) => sum + item.estimatedSavingsMB, 0),
    };
  }, [plan, selectedActions, visibleItems]);

  function cycleAction(item: QuickCleanupItem) {
    if (protectedIds.has(item.photo.id)) return;
    const current = selectedActions[item.photo.id] ?? "keep";
    const choices: QuickCleanupAction[] = item.action === "trim" ? ["keep", "trim"] : ["keep", "delete"];
    const next = choices[(choices.indexOf(current) + 1) % choices.length];
    if (next === "trim" && current !== "trim" && chosen.trims.length >= trimLimit) return;
    setSelectedActions((value) => ({ ...value, [item.photo.id]: next }));
  }

  function toggleProtection(item: QuickCleanupItem) {
    const next = !protectedIds.has(item.photo.id);
    setProtectedIds((value) => {
      const copy = new Set(value);
      if (next) copy.add(item.photo.id);
      else copy.delete(item.photo.id);
      return copy;
    });
    setSelectedActions((value) => ({ ...value, [item.photo.id]: "keep" }));
    onProtect(item, next);
  }

  if (error === "permission") {
    return <View style={styles.centered}><Ionicons name="lock-closed-outline" size={44} color={colors.primary} /><Text style={styles.heroTitle}>{t("ui.free-space-plan")}</Text><Text style={styles.centerText}>{t("ui.photo-access-needed")}</Text><Pressable style={styles.primaryButton} onPress={onOpenSettings}><Text style={styles.primaryButtonText}>{t("ui.open-settings")}</Text></Pressable><Pressable style={styles.secondaryButton} onPress={onBack}><Text style={styles.secondaryButtonText}>{t("ui.back-home")}</Text></Pressable></View>;
  }
  if (error === "error") {
    return <View style={styles.centered}><Ionicons name="warning-outline" size={44} color={colors.danger} /><Text style={styles.heroTitle}>{t("ui.preview-failed")}</Text><Text style={styles.centerText}>{t("ui.could-not-build-this-cleanup-folder")}</Text><Pressable style={styles.secondaryButton} onPress={onBack}><Text style={styles.secondaryButtonText}>{t("ui.back-home")}</Text></Pressable></View>;
  }
  if (!plan) {
    return <View style={styles.centered}><Ionicons name="speedometer-outline" size={38} color={colors.primary} /><Text style={styles.heroTitle}>{t("ui.free-space-plan")}</Text><Text style={styles.muted}>{t("ui.finding-the-photos-that-will-make-the-biggest-de")}</Text><Pressable style={styles.secondaryButton} onPress={onBack}><Text style={styles.secondaryButtonText}>{t("ui.back-home")}</Text></Pressable></View>;
  }
  if (plan.items.length === 0) {
    return <View style={styles.centered}><Ionicons name="checkmark-circle-outline" size={44} color={colors.sageDeep} /><Text style={styles.heroTitle}>{t("ui.no-saving")}</Text><Text style={styles.centerText}>{t("ui.no-local-photos-currently-have-useful-trim-savin")}</Text><Pressable style={styles.secondaryButton} onPress={onBack}><Text style={styles.secondaryButtonText}>{t("ui.back-home")}</Text></Pressable></View>;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{t("ui.quick-review")}</Text>
          <Text style={styles.title}>{t("ui.free-space-plan")}</Text>
          <Text style={styles.muted}>{formatMB(chosen.saved)} · {chosen.deletes.length + chosen.trims.length} actions · {plan.budgetSeconds}s</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.closeButton}><Ionicons name="close" size={22} color={colors.text} /></Pressable>
      </View>
      <View style={styles.budgetRow}>{([30, 120, 300] as const).map((budget) => <Pressable key={budget} onPress={() => onChangeBudget(budget)} style={[styles.budgetButton, plan.budgetSeconds === budget && styles.budgetButtonActive]}><Text style={[styles.budgetText, plan.budgetSeconds === budget && styles.budgetTextActive]}>{budget}s</Text></Pressable>)}</View>
      {loading ? <View style={styles.refreshing}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.refreshingText}>{t("ui.scanning")}</Text></View> : null}
      <View style={styles.budgetRow}>{([{ label: "Any", value: null }, { label: "500 MB", value: 500 }, { label: "1 GB", value: 1024 }] as const).map((target) => <Pressable key={target.label} onPress={() => onChangeTarget(target.value)} style={[styles.budgetButton, plan.targetMB === target.value && styles.budgetButtonActive]}><Text style={[styles.budgetText, plan.targetMB === target.value && styles.budgetTextActive]}>{target.label}</Text></Pressable>)}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.months}>
        <Pressable onPress={() => setSelectedMonth(null)} style={[styles.monthPill, selectedMonth == null && { borderColor: colors.primary }]}><Text style={styles.monthLabel}>{t("ui.all-count", { count: plan.items.length })}</Text><Text style={styles.monthValue}>actions</Text></Pressable>
        {months.slice(0, 6).map((month) => <Pressable key={month.key} onPress={() => setSelectedMonth(month.key)} style={[styles.monthPill, selectedMonth === month.key && { borderColor: colors.primary }]}><Text style={styles.monthLabel}>{month.label}</Text><Text style={styles.monthValue}>{month.reviewedCount}/{month.photoCount} · {formatMB(month.reclaimableMB)}</Text><View style={styles.monthTrack}><View style={[styles.monthFill, { width: `${Math.round(month.progress * 100)}%` }]} /></View></Pressable>)}
      </ScrollView>
      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.photo.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const selectedAction = protectedIds.has(item.photo.id) ? "keep" : (selectedActions[item.photo.id] ?? "keep");
          return <View style={styles.row}>
            <Pressable onPress={() => setFullPhoto(item)} style={styles.thumbButton}><Image source={{ uri: item.photo.localUri ?? item.photo.uri }} style={styles.thumb} /><View style={styles.previewBadge}><Ionicons name="expand-outline" size={13} color={colors.white} /></View></Pressable>
            <View style={styles.rowCopy}><Text numberOfLines={1} style={styles.photoTitle}>{item.photo.title || t("ui.photo")}</Text><Text numberOfLines={2} style={styles.reason}>{item.reason} · {formatMB(item.estimatedSavingsMB)}</Text><Text style={[styles.confidence, item.confidence === "verified" ? styles.verified : item.confidence === "review" ? styles.review : styles.high]}>{item.confidence === "verified" ? "Exact match" : item.confidence === "high" ? "High confidence" : "Review first"}</Text></View>
            <View style={styles.rowActions}><Pressable onPress={() => cycleAction(item)} disabled={protectedIds.has(item.photo.id)} style={[styles.actionButton, { borderColor: actionColor(selectedAction), backgroundColor: `${actionColor(selectedAction)}15` }]}><Text style={[styles.actionText, { color: actionColor(selectedAction) }]}>{actionLabel(selectedAction)}</Text></Pressable><Pressable onPress={() => toggleProtection(item)} style={styles.iconButton}><Ionicons name={protectedIds.has(item.photo.id) ? "shield-checkmark" : "shield-outline"} size={17} color={protectedIds.has(item.photo.id) ? colors.sageDeep : colors.textMuted} /></Pressable><Pressable onPress={() => onDecideLater(item)} style={styles.iconButton}><Ionicons name="time-outline" size={17} color={colors.textMuted} /></Pressable></View>
          </View>;
        }}
      />
      <View style={styles.footer}><Pressable disabled={chosen.deletes.length === 0 && chosen.trims.length === 0} onPress={() => onConfirm(chosen.deletes, chosen.trims)} style={[styles.applyButton, chosen.deletes.length === 0 && chosen.trims.length === 0 && styles.disabled]}><Ionicons name="sparkles-outline" size={18} color={colors.white} /><Text style={styles.applyText}>{t("ui.apply-save", { value: formatMB(chosen.saved) })}</Text></Pressable><Pressable onPress={onBack} style={styles.keepButton}><Text style={styles.keepButtonText}>{t("ui.keep-them-all")}</Text></Pressable></View>
      <Modal visible={fullPhoto != null} transparent animationType="fade" onRequestClose={() => setFullPhoto(null)}><Pressable style={styles.modalBackdrop} onPress={() => setFullPhoto(null)}>{fullPhoto ? <Image source={{ uri: fullPhoto.photo.localUri ?? fullPhoto.photo.uri }} style={styles.fullPhoto} resizeMode="contain" /> : null}</Pressable></Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  refreshing: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  refreshingText: { color: colors.textMuted, fontSize: 11, fontWeight: "800" },
  screen: { flex: 1, backgroundColor: colors.background }, centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background }, heroTitle: { ...type.title, color: colors.text, textAlign: "center" }, centerText: { ...type.body, color: colors.textMuted, textAlign: "center" }, muted: { ...type.caption, color: colors.textMuted }, header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }, headerCopy: { flex: 1, gap: 3 }, eyebrow: { ...type.eyebrow, color: colors.primary }, title: { ...type.title, color: colors.text }, closeButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.cardSoft }, budgetRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }, budgetButton: { flex: 1, minHeight: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.cardSoft }, budgetButtonActive: { backgroundColor: colors.primary }, budgetText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" }, budgetTextActive: { color: colors.white }, months: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm }, monthPill: { width: 142, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }, monthLabel: { color: colors.text, fontSize: 12, fontWeight: "800" }, monthValue: { color: colors.textMuted, fontSize: 10, marginTop: 3 }, monthTrack: { height: 4, borderRadius: 2, backgroundColor: colors.borderSoft, marginTop: 7, overflow: "hidden" }, monthFill: { height: "100%", backgroundColor: colors.sage }, list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 128 }, row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }, thumbButton: { width: 62, height: 62, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.borderSoft }, thumb: { width: "100%", height: "100%" }, previewBadge: { position: "absolute", right: 4, bottom: 4, width: 21, height: 21, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,23,42,0.68)" }, rowCopy: { flex: 1, gap: 3 }, photoTitle: { color: colors.text, fontSize: 12, fontWeight: "800" }, reason: { color: colors.textMuted, fontSize: 10, lineHeight: 14 }, confidence: { fontSize: 9, fontWeight: "800" }, verified: { color: colors.sageDeep }, high: { color: colors.primary }, review: { color: colors.honey }, rowActions: { alignItems: "center", gap: 4 }, actionButton: { minWidth: 54, minHeight: 34, paddingHorizontal: 5, borderRadius: radius.sm, borderWidth: 1, alignItems: "center", justifyContent: "center" }, actionText: { fontSize: 10, fontWeight: "900" }, iconButton: { width: 28, height: 24, alignItems: "center", justifyContent: "center" }, footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, applyButton: { minHeight: 50, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, applyText: { color: colors.white, fontSize: 14, fontWeight: "900" }, disabled: { opacity: 0.45 }, keepButton: { minHeight: 34, alignItems: "center", justifyContent: "center" }, keepButtonText: { color: colors.textMuted, fontWeight: "800", fontSize: 12 }, secondaryButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.cardSoft }, secondaryButtonText: { color: colors.text, fontWeight: "800" }, primaryButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary }, primaryButtonText: { color: colors.white, fontWeight: "800" }, modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.92)", alignItems: "center", justifyContent: "center" }, fullPhoto: { width: "94%", height: "82%" },
});
