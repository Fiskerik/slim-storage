import * as FileSystem from "expo-file-system/legacy";

import type {
  QuickCleanupLibrary,
  QuickCleanupReviewGroup,
  QuickCleanupTrimOption,
} from "./quick-cleanup-service";
import type { MonthCleanupProgress, QuickCleanupItem, QuickCleanupPlan } from "./quick-cleanup-plan";
import type { NativePhoto } from "./native-photo-source";

const CACHE_FILE = "trimswipe-quick-cleanup-review-v1.json";
const CACHE_VERSION = 2;
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;
let pendingCacheMutation: Promise<void> = Promise.resolve();

type PersistedQuickCleanupReview = {
  version: typeof CACHE_VERSION;
  savedAt: string;
  plan: QuickCleanupPlan;
  groups: QuickCleanupReviewGroup[];
  trimOptions: QuickCleanupTrimOption[];
  months: MonthCleanupProgress[];
};

function cacheUri(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${CACHE_FILE}` : null;
}

function enqueueCacheMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = pendingCacheMutation.then(operation, operation);
  pendingCacheMutation = result.then(() => undefined, () => undefined);
  return result;
}

function isUsableItem(value: unknown): value is QuickCleanupItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<QuickCleanupItem>;
  return Boolean(
    item.photo &&
      typeof item.photo.id === "string" &&
      item.photo.id.length > 0 &&
      typeof item.photo.uri === "string" &&
      item.photo.uri.length > 0 &&
      (item.action === "trim" || item.action === "delete") &&
      typeof item.estimatedSavingsMB === "number" &&
      Number.isFinite(item.estimatedSavingsMB),
  );
}

function isUsablePhoto(value: unknown): value is NativePhoto {
  if (!value || typeof value !== "object") return false;
  const photo = value as Partial<NativePhoto>;
  return Boolean(
    typeof photo.id === "string" &&
      photo.id.length > 0 &&
      typeof photo.uri === "string" &&
      photo.uri.length > 0,
  );
}

function normalizeGroups(value: unknown): QuickCleanupReviewGroup[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const raw = candidate as Partial<QuickCleanupReviewGroup>;
    const photos = Array.isArray(raw.photos) ? raw.photos.filter(isUsablePhoto) : [];
    if (typeof raw.id !== "string" || photos.length < 2 || (raw.kind !== "exact" && raw.kind !== "similar")) return [];
    const suggestedKeeperId = photos.some((photo) => photo.id === raw.suggestedKeeperId)
      ? raw.suggestedKeeperId!
      : photos[0].id;
    return [{
      id: raw.id,
      kind: raw.kind,
      photos,
      suggestedKeeperId,
      reason: typeof raw.reason === "string" ? raw.reason : undefined,
    }];
  });
}

function normalizeTrimOptions(value: unknown): QuickCleanupTrimOption[] {
  if (!Array.isArray(value)) return [];
  return value.filter((candidate): candidate is QuickCleanupTrimOption => Boolean(
    candidate &&
      typeof candidate === "object" &&
      typeof (candidate as QuickCleanupTrimOption).photoId === "string" &&
      typeof (candidate as QuickCleanupTrimOption).estimatedSavingsMB === "number" &&
      Number.isFinite((candidate as QuickCleanupTrimOption).estimatedSavingsMB) &&
      (candidate as QuickCleanupTrimOption).estimatedSavingsMB > 0 &&
      typeof (candidate as QuickCleanupTrimOption).reason === "string",
  ));
}

function normalizePlan(value: unknown): QuickCleanupPlan | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<QuickCleanupPlan>;
  if (!Array.isArray(raw.items)) return null;
  // An empty plan is still a valid, useful result: it lets the user reopen an
  // "already clean" review without repeatedly scanning the whole library.
  const items = raw.items.filter(isUsableItem);
  const selectedItems = items.filter((item) => item.selected);
  return {
    budgetSeconds: raw.budgetSeconds === 30 || raw.budgetSeconds === 300 ? raw.budgetSeconds : 120,
    targetMB: typeof raw.targetMB === "number" && Number.isFinite(raw.targetMB) ? Math.max(1, raw.targetMB) : null,
    items,
    selectedItems,
    estimatedSavingsMB: selectedItems.reduce((sum, item) => sum + Math.max(0, item.estimatedSavingsMB), 0),
    estimatedDecisions: selectedItems.length,
    protectedIds: Array.isArray(raw.protectedIds)
      ? raw.protectedIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

function normalizeMonths(value: unknown): MonthCleanupProgress[] {
  if (!Array.isArray(value)) return [];
  return value.filter((month): month is MonthCleanupProgress => Boolean(
    month &&
      typeof month === "object" &&
      typeof (month as MonthCleanupProgress).key === "string" &&
      typeof (month as MonthCleanupProgress).label === "string",
  ));
}

export async function loadQuickCleanupReviewCache(): Promise<QuickCleanupLibrary | null> {
  await pendingCacheMutation;
  const uri = cacheUri();
  if (!uri) return null;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const raw = JSON.parse(await FileSystem.readAsStringAsync(uri)) as Partial<PersistedQuickCleanupReview>;
    const savedAt = typeof raw.savedAt === "string" ? Date.parse(raw.savedAt) : Number.NaN;
    if (raw.version !== CACHE_VERSION || !Number.isFinite(savedAt) || Date.now() - savedAt > MAX_CACHE_AGE_MS) {
      await clearQuickCleanupReviewCache();
      return null;
    }
    const plan = normalizePlan(raw.plan);
    if (!plan) {
      await clearQuickCleanupReviewCache();
      return null;
    }
    const groups = normalizeGroups(raw.groups);
    const photos = [...new Map([
      ...plan.items.map((item) => [item.photo.id, item.photo] as const),
      ...groups.flatMap((group) => group.photos.map((photo) => [photo.id, photo] as const)),
    ]).values()];
    return {
      plan,
      photos,
      groups,
      trimOptions: normalizeTrimOptions(raw.trimOptions),
      months: normalizeMonths(raw.months),
    };
  } catch (error) {
    console.log("[QuickCleanupCache] Could not restore review", { error });
    return null;
  }
}

export async function saveQuickCleanupReviewCache(library: QuickCleanupLibrary): Promise<boolean> {
  const uri = cacheUri();
  if (!uri) return false;
  const payload: PersistedQuickCleanupReview = {
    version: CACHE_VERSION,
    savedAt: new Date().toISOString(),
    // selectedItems duplicates objects already present in items. Rebuild it on
    // read so large reviews do not consume twice the document storage.
    plan: { ...library.plan, selectedItems: [] },
    groups: library.groups,
    trimOptions: library.trimOptions,
    months: library.months,
  };
  return enqueueCacheMutation(async () => {
    try {
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.log("[QuickCleanupCache] Could not save review", { error });
      return false;
    }
  });
}

export async function clearQuickCleanupReviewCache(): Promise<void> {
  const uri = cacheUri();
  if (!uri) return;
  await enqueueCacheMutation(() => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined));
}
