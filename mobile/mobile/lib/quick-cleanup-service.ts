import {
  estimateTrimSavings,
  findExactDuplicatePhotoGroups,
  getTrimStatus,
  loadDuplicatePhotoGroups,
  loadPhotoLibrarySnapshot,
  type NativeDuplicateGroup,
  type NativePhoto,
} from "./native-photo-source";
import { buildMonthCleanupProgress, buildQuickCleanupPlan, type CleanupTimeBudget, type MonthCleanupProgress, type QuickCleanupPlan, type QuickCleanupCandidate } from "./quick-cleanup-plan";
import { protectedPhotoIds, type PhotoProtectionStore } from "./photo-protection";
import { shouldExcludeReviewedPhoto, type NativePhotoReviewLedger } from "./native-review-ledger";
import type { NativeSettings } from "./native-store";

export type QuickCleanupLibrary = {
  plan: QuickCleanupPlan;
  photos: NativePhoto[];
  exactDuplicateGroups: Awaited<ReturnType<typeof findExactDuplicatePhotoGroups>>;
  similarGroups: NativeDuplicateGroup[];
  months: MonthCleanupProgress[];
};

function isUsablePhoto(photo: NativePhoto | null | undefined): photo is NativePhoto {
  return Boolean(
    photo &&
      typeof photo.id === "string" &&
      photo.id.length > 0 &&
      typeof photo.uri === "string" &&
      photo.uri.length > 0,
  );
}

function ageDays(creationTime: number): number {
  return Math.max(0, (Date.now() - creationTime) / (24 * 60 * 60 * 1000));
}

function candidateForTrim(photo: NativePhoto, settings: NativeSettings): QuickCleanupCandidate | null {
  const options = {
    allowSecondPass: settings.trimReviewMode === "trimmed-only",
    quality: settings.trimQuality,
  };
  const status = getTrimStatus(photo, settings.trimKinds, settings.trimQuality, options);
  const savings = estimateTrimSavings(photo, settings.trimKinds, options);
  if (!status.canTrim || savings <= 0 || photo.isCloudAsset) return null;
  return {
    photo,
    action: "trim",
    confidence: "high",
    estimatedSavingsMB: savings,
    reviewSeconds: 5,
    reason: status.nextLabel,
    preselect: true,
  };
}

export async function loadQuickCleanupLibrary(
  settings: NativeSettings,
  options: {
    budgetSeconds?: CleanupTimeBudget;
    targetMB?: number | null;
    trimBalance?: number;
    unlimitedTrims?: boolean;
    protection?: PhotoProtectionStore;
    reviewLedger?: NativePhotoReviewLedger | null;
  } = {},
): Promise<QuickCleanupLibrary> {
  // Native photo metadata may briefly contain a null item while the user is
  // changing library permissions or iCloud is hydrating an asset. Filter at
  // the service boundary so every downstream plan and UI receives safe data.
  const photos = (await loadPhotoLibrarySnapshot()).filter(isUsablePhoto);
  const protectedIds = options.protection ? protectedPhotoIds(options.protection) : new Set<string>();
  const reviewedIds = options.reviewLedger
    ? new Set(Object.keys(options.reviewLedger.records).filter((id) => shouldExcludeReviewedPhoto(options.reviewLedger!, id)))
    : new Set<string>();
  const exactDuplicateGroups = await findExactDuplicatePhotoGroups(photos);
  const candidates: QuickCleanupCandidate[] = [];

  exactDuplicateGroups.forEach((group) => {
    const keeperId = group.suggestedKeeperId;
    (group.photos ?? [])
      .filter(isUsablePhoto)
      .filter((photo) => photo.id !== keeperId)
      .forEach((photo) => {
        candidates.push({
          photo,
          action: "delete",
          confidence: "verified",
          estimatedSavingsMB: photo.sizeMB,
          reviewSeconds: 3,
          reason: "Exact byte duplicate; compare before removing",
          // Album membership is platform-dependent, so exact duplicates still
          // require a deliberate user choice in this release.
          preselect: false,
          exactDuplicateGroupId: group.id,
        });
      });
  });

  photos.forEach((photo) => {
    if (protectedIds.has(photo.id) || reviewedIds.has(photo.id)) return;
    const isScreenshot = photo.cleanupReasons.includes("Screenshot");
    // Screenshots stay a deliberate review surface; never silently replace a
    // unique screenshot with a trimmed copy in the quick plan.
    const trim = isScreenshot ? null : candidateForTrim(photo, settings);
    if (trim) candidates.push(trim);
    if (isScreenshot && ageDays(photo.creationTime) >= 90) {
      candidates.push({
        photo,
        action: "delete",
        confidence: "review",
        estimatedSavingsMB: photo.sizeMB,
        reviewSeconds: 8,
        reason: "Screenshot older than 90 days; review before removing",
        preselect: false,
      });
    }
  });

  let similarGroups: NativeDuplicateGroup[] = [];
  try {
    similarGroups = await loadDuplicatePhotoGroups(24, settings, { avoidIds: [...protectedIds] });
    similarGroups.forEach((group) => {
      const keeperId = group.suggestedKeeperId;
      (group.photos ?? [])
        .filter(isUsablePhoto)
        .filter((photo) => photo.id !== keeperId && !protectedIds.has(photo.id))
        .forEach((photo) => candidates.push({
          photo,
          action: "delete",
          confidence: "high",
          estimatedSavingsMB: photo.sizeMB,
          reviewSeconds: 10,
          reason: group.similarityLabel ?? "Similar photo; compare before removing",
          preselect: false,
        }));
    });
  } catch (error) {
    console.log("[QuickCleanup] Similar groups unavailable", { error });
  }

  const plan = buildQuickCleanupPlan(candidates, {
    budgetSeconds: options.budgetSeconds,
    targetMB: options.targetMB,
    trimBalance: options.trimBalance,
    unlimitedTrims: options.unlimitedTrims,
    protectedIds,
  });
  const reclaimableById = new Map<string, number>();
  plan.items.forEach((item) => reclaimableById.set(item.photo.id, item.estimatedSavingsMB));
  return {
    plan,
    photos,
    exactDuplicateGroups,
    similarGroups,
    months: buildMonthCleanupProgress(photos, reviewedIds, reclaimableById),
  };
}
