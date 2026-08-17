import type { NativePhoto } from "./native-photo-source";

export type CleanupConfidence = "verified" | "high" | "review";
export type CleanupTimeBudget = 30 | 120 | 300;
export type QuickCleanupAction = "delete" | "trim" | "keep";

export type QuickCleanupCandidate = {
  photo: NativePhoto;
  action: Exclude<QuickCleanupAction, "keep">;
  confidence: CleanupConfidence;
  estimatedSavingsMB: number;
  reviewSeconds: number;
  reason: string;
  /** False when an automatic suggestion still needs an explicit user choice. */
  preselect: boolean;
  exactDuplicateGroupId?: string;
};

export type QuickCleanupItem = QuickCleanupCandidate & {
  selected: boolean;
};

export type QuickCleanupPlan = {
  budgetSeconds: CleanupTimeBudget;
  targetMB: number | null;
  items: QuickCleanupItem[];
  selectedItems: QuickCleanupItem[];
  estimatedSavingsMB: number;
  estimatedDecisions: number;
  protectedIds: string[];
};

export type MonthCleanupProgress = {
  key: string;
  label: string;
  photoCount: number;
  reviewedCount: number;
  reclaimableMB: number;
  progress: number;
};

const CONFIDENCE_RANK: Record<CleanupConfidence, number> = {
  verified: 0,
  high: 1,
  review: 2,
};

function finiteMB(value: number): number {
  return Number.isFinite(value) && value > 0 ? +value.toFixed(2) : 0;
}

function uniqueByPhoto(candidates: QuickCleanupCandidate[]): QuickCleanupCandidate[] {
  const byId = new Map<string, QuickCleanupCandidate>();
  candidates.forEach((candidate) => {
    // Cached/native scan results can contain a malformed entry after a
    // library permission change. Never let one null photo take down the
    // entire plan or preview.
    if (!candidate?.photo || typeof candidate.photo.id !== "string" || candidate.photo.id.length === 0) return;
    const previous = byId.get(candidate.photo.id);
    if (!previous) {
      byId.set(candidate.photo.id, candidate);
      return;
    }
    const previousRank = CONFIDENCE_RANK[previous.confidence];
    const nextRank = CONFIDENCE_RANK[candidate.confidence];
    if (
      nextRank < previousRank ||
      (nextRank === previousRank && candidate.estimatedSavingsMB > previous.estimatedSavingsMB)
    ) {
      byId.set(candidate.photo.id, candidate);
    }
  });
  return [...byId.values()];
}

/**
 * Selects the best cleanup actions without touching the photo library. Deletes
 * are not limited by trim tokens; trim suggestions are capped for free users.
 */
export function buildQuickCleanupPlan(
  candidates: QuickCleanupCandidate[],
  options: {
    budgetSeconds?: CleanupTimeBudget;
    targetMB?: number | null;
    trimBalance?: number;
    unlimitedTrims?: boolean;
    protectedIds?: Iterable<string>;
  } = {},
): QuickCleanupPlan {
  const budgetSeconds = options.budgetSeconds ?? 120;
  const targetMB = options.targetMB == null ? null : Math.max(1, options.targetMB);
  const protectedSet = new Set(options.protectedIds ?? []);
  const trimBalance = options.unlimitedTrims ? Number.MAX_SAFE_INTEGER : Math.max(0, Math.floor(options.trimBalance ?? 0));
  let trimCount = 0;
  let spentSeconds = 0;
  let savings = 0;

  const ordered = uniqueByPhoto(candidates)
    .filter((candidate) => !protectedSet.has(candidate.photo.id))
    .filter((candidate) => candidate.estimatedSavingsMB > 0)
    .sort((a, b) => {
      const rank = CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence];
      if (rank !== 0) return rank;
      const aEfficiency = a.estimatedSavingsMB / Math.max(1, a.reviewSeconds);
      const bEfficiency = b.estimatedSavingsMB / Math.max(1, b.reviewSeconds);
      return bEfficiency - aEfficiency;
    });

  const items = ordered.map((candidate) => {
    const isTrim = candidate.action === "trim";
    const canSpendTrim = !isTrim || options.unlimitedTrims || trimCount < trimBalance;
    const fitsTime = spentSeconds + Math.max(1, candidate.reviewSeconds) <= budgetSeconds || savings === 0;
    const targetReached = targetMB != null && savings >= targetMB;
    const selected = candidate.preselect && canSpendTrim && fitsTime && !targetReached;
    if (selected) {
      spentSeconds += Math.max(1, candidate.reviewSeconds);
      savings += candidate.estimatedSavingsMB;
      if (isTrim) trimCount += 1;
    }
    return { ...candidate, selected };
  });

  const selectedItems = items.filter((item) => item.selected);
  return {
    budgetSeconds,
    targetMB,
    items,
    selectedItems,
    estimatedSavingsMB: finiteMB(selectedItems.reduce((sum, item) => sum + item.estimatedSavingsMB, 0)),
    estimatedDecisions: selectedItems.length,
    protectedIds: [...protectedSet],
  };
}

export function monthKey(creationTime: number): string {
  const date = new Date(creationTime);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function buildMonthCleanupProgress(
  photos: NativePhoto[],
  reviewedIds: Iterable<string>,
  reclaimableById: Map<string, number> = new Map(),
  locale = "en-US",
): MonthCleanupProgress[] {
  const reviewed = new Set(reviewedIds);
  const groups = new Map<string, NativePhoto[]>();
  photos.forEach((photo) => {
    const key = monthKey(photo.creationTime);
    groups.set(key, [...(groups.get(key) ?? []), photo]);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, group]) => {
      const [year, month] = key.split("-").map(Number);
      const label = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
      const reviewedCount = group.filter((photo) => reviewed.has(photo.id)).length;
      return {
        key,
        label,
        photoCount: group.length,
        reviewedCount,
        reclaimableMB: finiteMB(group.reduce((sum, photo) => sum + (reclaimableById.get(photo.id) ?? 0), 0)),
        progress: group.length === 0 ? 1 : reviewedCount / group.length,
      };
    });
}
