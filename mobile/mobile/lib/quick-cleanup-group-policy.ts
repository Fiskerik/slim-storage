import type { NativePhoto } from "./native-photo-source";
import type { QuickCleanupAction } from "./quick-cleanup-plan";
import type { QuickCleanupReviewGroup, QuickCleanupTrimOption } from "./quick-cleanup-service";

export type QuickCleanupGroupChoice = {
  keptIds: string[];
  keptAction: "keep" | "trim";
  unkeptAction: QuickCleanupAction;
};

export function defaultQuickCleanupGroupChoice(group: QuickCleanupReviewGroup): QuickCleanupGroupChoice {
  return {
    keptIds: [group.suggestedKeeperId],
    keptAction: "keep",
    // A suggestion may pick a keeper, but never silently chooses the fate of
    // the remaining photos.
    unkeptAction: "keep",
  };
}

export function resolveQuickCleanupGroupActions(options: {
  photos: NativePhoto[];
  choice: QuickCleanupGroupChoice;
  trimOptions: QuickCleanupTrimOption[];
  protectedIds?: Iterable<string>;
  trimLimit: number;
  existingTrimCount?: number;
}): Record<string, QuickCleanupAction> {
  const protectedIds = new Set(options.protectedIds ?? []);
  const keptIds = new Set(options.choice.keptIds);
  const trimSavings = new Map(options.trimOptions.map((option) => [option.photoId, option.estimatedSavingsMB]));
  const availableTrims = Math.max(0, Math.floor(options.trimLimit) - Math.max(0, Math.floor(options.existingTrimCount ?? 0)));
  const allowedTrimIds = new Set(
    options.photos
      .filter((photo) => !protectedIds.has(photo.id))
      .filter((photo) => (keptIds.has(photo.id) ? options.choice.keptAction : options.choice.unkeptAction) === "trim")
      .filter((photo) => trimSavings.has(photo.id))
      .sort((a, b) => (trimSavings.get(b.id) ?? 0) - (trimSavings.get(a.id) ?? 0))
      .slice(0, availableTrims)
      .map((photo) => photo.id),
  );

  return Object.fromEntries(options.photos.map((photo) => {
    if (protectedIds.has(photo.id)) return [photo.id, "keep"] as const;
    const desired = keptIds.has(photo.id) ? options.choice.keptAction : options.choice.unkeptAction;
    if (desired === "trim") return [photo.id, allowedTrimIds.has(photo.id) ? "trim" : "keep"] as const;
    return [photo.id, desired] as const;
  }));
}
