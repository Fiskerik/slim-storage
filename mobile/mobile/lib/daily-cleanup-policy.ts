import type { NativeDuplicateGroup, NativePhoto, NativeTodayPhotoSet } from "./native-photo-source";
import type { NativeSettings } from "./native-store";

export type DailyCleanupAction = "keep" | "trim" | "delete";

export type DailyCleanupItem = {
  photo: NativePhoto;
  suggestedAction: DailyCleanupAction;
  reason: string;
  duplicateGroupId?: string;
  duplicateKeeperId?: string;
  canTrim: boolean;
  trimSavingsMB: number;
};

export type DailyCleanupPlan = {
  dayKey: string;
  items: DailyCleanupItem[];
  trimSuggestions: DailyCleanupItem[];
  deleteSuggestions: DailyCleanupItem[];
  estimatedTrimSavingsMB: number;
  estimatedDeleteSavingsMB: number;
  similarityAnalysis: NativeTodayPhotoSet["similarityAnalysis"];
};

export type DailyTrimEvaluator = (photo: NativePhoto, settings: NativeSettings) => {
  canTrim: boolean;
  trimSavingsMB: number;
};

export function selectSuggestedTrimIds(plan: DailyCleanupPlan, limit: number): Set<string> {
  return new Set(plan.trimSuggestions.slice(0, Math.max(0, Math.floor(limit))).map((item) => item.photo.id));
}

function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function duplicateLookup(groups: NativeDuplicateGroup[]): Map<string, { groupId: string; keeperId: string }> {
  const lookup = new Map<string, { groupId: string; keeperId: string }>();
  groups.forEach((group) => {
    group.photos.forEach((photo) => lookup.set(photo.id, { groupId: group.id, keeperId: group.suggestedKeeperId }));
  });
  return lookup;
}

export function buildDailyCleanupPlan(
  source: NativeTodayPhotoSet,
  settings: NativeSettings,
  evaluateTrim: DailyTrimEvaluator,
  now = new Date(),
): DailyCleanupPlan {
  const duplicateIds = duplicateLookup(source.duplicateGroups);
  const items = source.photos.map((photo): DailyCleanupItem => {
    const duplicate = duplicateIds.get(photo.id);
    const isDuplicateExtra = duplicate != null && duplicate.keeperId !== photo.id;
    const trim = evaluateTrim(photo, settings);

    if (isDuplicateExtra && !photo.isCloudAsset) {
      return {
        photo,
        suggestedAction: "delete",
        reason: "Verified duplicate",
        duplicateGroupId: duplicate.groupId,
        duplicateKeeperId: duplicate.keeperId,
        canTrim: trim.canTrim,
        trimSavingsMB: trim.trimSavingsMB,
      };
    }
    if (isDuplicateExtra && photo.isCloudAsset) {
      return {
        photo,
        suggestedAction: "keep",
        reason: "Cloud-only copy kept safe",
        duplicateGroupId: duplicate.groupId,
        duplicateKeeperId: duplicate.keeperId,
        canTrim: false,
        trimSavingsMB: 0,
      };
    }
    if (trim.canTrim) {
      return {
        photo,
        suggestedAction: "trim",
        reason: "Safe metadata, location, or compression trim",
        duplicateGroupId: duplicate?.groupId,
        duplicateKeeperId: duplicate?.keeperId,
        canTrim: true,
        trimSavingsMB: trim.trimSavingsMB,
      };
    }
    return {
      photo,
      suggestedAction: "keep",
      reason: photo.trimState?.blockedReason === "already-optimized" ? "Already optimized" : "Keep for now",
      duplicateGroupId: duplicate?.groupId,
      duplicateKeeperId: duplicate?.keeperId,
      canTrim: false,
      trimSavingsMB: 0,
    };
  });

  const trimSuggestions = items.filter((item) => item.suggestedAction === "trim").sort((a, b) => b.trimSavingsMB - a.trimSavingsMB);
  const deleteSuggestions = items.filter((item) => item.suggestedAction === "delete").sort((a, b) => b.photo.sizeMB - a.photo.sizeMB);
  return {
    dayKey: localDayKey(now),
    items,
    trimSuggestions,
    deleteSuggestions,
    estimatedTrimSavingsMB: trimSuggestions.reduce((sum, item) => sum + item.trimSavingsMB, 0),
    estimatedDeleteSavingsMB: deleteSuggestions.reduce((sum, item) => sum + item.photo.sizeMB, 0),
    similarityAnalysis: source.similarityAnalysis,
  };
}
