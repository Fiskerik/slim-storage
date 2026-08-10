import * as FileSystem from "expo-file-system/legacy";
import type { NativeActionLogEntry, NativeSeenPhoto, NativeStats } from "./native-store";
import type { NativePhotoTrimState } from "./native-photo-source";

/**
 * The review ledger is deliberately independent of the stats file. Stats are a
 * short-lived activity summary; this file is the durable answer to "has this
 * asset already been dealt with?" and is therefore never capped by count.
 */
export type NativeReviewDisposition = "kept" | "trimmed" | "skipped" | "deleted";

export type NativePhotoReviewRecord = {
  assetId: string;
  disposition: NativeReviewDisposition;
  reviewedAt: string;
  /** The original asset when this is a new trimmed copy. */
  sourceAssetId?: string;
  /** The derived trimmed asset when it could be resolved by Photos. */
  replacementAssetId?: string;
};

export type NativePhotoReviewLedger = {
  version: 1;
  updatedAt: string;
  records: Record<string, NativePhotoReviewRecord>;
  migrations: {
    statsV1: boolean;
    trimTagsV1: boolean;
  };
};

export type NativeReviewLedgerMigrationStats = Pick<NativeStats, "actionLog" | "recentSeenPhotos">;

export type NativeReviewEligibilityOptions = {
  includePreviouslyReviewed?: boolean;
  now?: number;
  skipCooldownDays?: number;
};

const REVIEW_LEDGER_FILE = "trimswipe-native-review-ledger-v1.json";
const LEGACY_TRIM_TAGS_FILE = "trimswipe-native-trim-tags-v1.json";
export const NATIVE_SKIP_COOLDOWN_DAYS = 7;

const EMPTY_LEDGER = (): NativePhotoReviewLedger => ({
  version: 1,
  updatedAt: new Date().toISOString(),
  records: {},
  migrations: { statsV1: false, trimTagsV1: false },
});

function ledgerUri(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${REVIEW_LEDGER_FILE}` : null;
}

function legacyTrimTagsUri(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${LEGACY_TRIM_TAGS_FILE}` : null;
}

function validDate(value: unknown, fallback: string): string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeDisposition(value: unknown): NativeReviewDisposition | null {
  return value === "kept" || value === "trimmed" || value === "skipped" || value === "deleted" ? value : null;
}

function normalizeRecord(assetId: string, value: unknown): NativePhotoReviewRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<NativePhotoReviewRecord>;
  const disposition = normalizeDisposition(raw.disposition);
  if (!disposition || !validId(assetId)) return null;
  const now = new Date().toISOString();
  return {
    assetId,
    disposition,
    reviewedAt: validDate(raw.reviewedAt, now),
    ...(validId(raw.sourceAssetId) && raw.sourceAssetId !== assetId ? { sourceAssetId: raw.sourceAssetId } : {}),
    ...(validId(raw.replacementAssetId) && raw.replacementAssetId !== assetId
      ? { replacementAssetId: raw.replacementAssetId }
      : {}),
  };
}

export function normalizeNativePhotoReviewLedger(value: unknown): NativePhotoReviewLedger {
  if (!value || typeof value !== "object") return EMPTY_LEDGER();
  const raw = value as Partial<NativePhotoReviewLedger>;
  const recordsSource = raw.records && typeof raw.records === "object" && !Array.isArray(raw.records) ? raw.records : {};
  const records = Object.fromEntries(
    Object.entries(recordsSource)
      .map(([assetId, record]) => [assetId, normalizeRecord(assetId, record)] as const)
      .filter((entry): entry is [string, NativePhotoReviewRecord] => entry[1] !== null),
  );
  const rawMigrations = raw.migrations && typeof raw.migrations === "object" ? raw.migrations : {};
  return {
    version: 1,
    updatedAt: validDate(raw.updatedAt, new Date().toISOString()),
    records,
    migrations: {
      statsV1: Boolean((rawMigrations as NativePhotoReviewLedger["migrations"]).statsV1),
      trimTagsV1: Boolean((rawMigrations as NativePhotoReviewLedger["migrations"]).trimTagsV1),
    },
  };
}

function recordPriority(disposition: NativeReviewDisposition): number {
  // A durable choice must never be overwritten by an old transient "seen" entry.
  return disposition === "trimmed" ? 4 : disposition === "kept" ? 3 : disposition === "deleted" ? 2 : 1;
}

function upsertRecord(
  ledger: NativePhotoReviewLedger,
  record: NativePhotoReviewRecord,
): NativePhotoReviewLedger {
  const previous = ledger.records[record.assetId];
  const shouldReplace =
    !previous ||
    recordPriority(record.disposition) > recordPriority(previous.disposition) ||
    (recordPriority(record.disposition) === recordPriority(previous.disposition) &&
      Date.parse(record.reviewedAt) >= Date.parse(previous.reviewedAt));
  if (!shouldReplace) return ledger;
  return {
    ...ledger,
    updatedAt: new Date().toISOString(),
    records: { ...ledger.records, [record.assetId]: record },
  };
}

export function recordNativePhotoReview(
  ledger: NativePhotoReviewLedger,
  assetId: string,
  disposition: NativeReviewDisposition,
  reviewedAt = new Date().toISOString(),
): NativePhotoReviewLedger {
  if (!validId(assetId)) return ledger;
  return upsertRecord(ledger, { assetId, disposition, reviewedAt: validDate(reviewedAt, new Date().toISOString()) });
}

/**
 * Records both sides of a trim. This matters for both replacement strategies:
 * after replace, the original may disappear; after save-new, both assets remain
 * and neither should re-enter the default shuffle.
 */
export function recordNativePhotoTrim(
  ledger: NativePhotoReviewLedger,
  sourceAssetId: string,
  replacementAssetId?: string,
  reviewedAt = new Date().toISOString(),
): NativePhotoReviewLedger {
  if (!validId(sourceAssetId)) return ledger;
  const at = validDate(reviewedAt, new Date().toISOString());
  let next = upsertRecord(ledger, {
    assetId: sourceAssetId,
    disposition: "trimmed",
    reviewedAt: at,
    ...(validId(replacementAssetId) ? { replacementAssetId } : {}),
  });
  if (validId(replacementAssetId)) {
    next = upsertRecord(next, {
      assetId: replacementAssetId,
      disposition: "trimmed",
      reviewedAt: at,
      sourceAssetId,
    });
  }
  return next;
}

export function shouldExcludeReviewedPhoto(
  ledger: NativePhotoReviewLedger,
  assetId: string,
  options: NativeReviewEligibilityOptions = {},
): boolean {
  if (options.includePreviouslyReviewed || !validId(assetId)) return false;
  const record = ledger.records[assetId];
  if (!record) return false;
  if (record.disposition !== "skipped") return true;
  const cooldownMs = (options.skipCooldownDays ?? NATIVE_SKIP_COOLDOWN_DAYS) * 24 * 60 * 60 * 1000;
  const reviewedAt = Date.parse(record.reviewedAt);
  return !Number.isNaN(reviewedAt) && reviewedAt + cooldownMs > (options.now ?? Date.now());
}

export function filterPreviouslyReviewedPhotoIds(
  ledger: NativePhotoReviewLedger,
  assetIds: readonly string[],
  options: NativeReviewEligibilityOptions = {},
): string[] {
  return assetIds.filter((assetId) => !shouldExcludeReviewedPhoto(ledger, assetId, options));
}

function actionToDisposition(action: NativeActionLogEntry["action"]): NativeReviewDisposition {
  return action === "trim" ? "trimmed" : action === "delete" ? "deleted" : "kept";
}

export function migrateLegacyStatsToReviewLedger(
  ledger: NativePhotoReviewLedger,
  stats: NativeReviewLedgerMigrationStats,
): NativePhotoReviewLedger {
  if (ledger.migrations.statsV1) return ledger;
  let next = ledger;
  stats.actionLog.forEach((entry) => {
    if (validId(entry.photoId)) next = recordNativePhotoReview(next, entry.photoId, actionToDisposition(entry.action), entry.createdAt);
  });
  stats.recentSeenPhotos.forEach((entry: NativeSeenPhoto) => {
    if (validId(entry.photoId)) next = recordNativePhotoReview(next, entry.photoId, "skipped", entry.lastSeenAt);
  });
  return { ...next, updatedAt: new Date().toISOString(), migrations: { ...next.migrations, statsV1: true } };
}

async function readLegacyTrimTagIds(): Promise<string[]> {
  const uri = legacyTrimTagsUri();
  if (!uri) return [];
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return [];
    const raw = JSON.parse(await FileSystem.readAsStringAsync(uri)) as Record<string, NativePhotoTrimState | unknown>;
    return Object.keys(raw).filter(validId);
  } catch (error) {
    console.log("[NativeReviewLedger] Could not read legacy trim tags", { error });
    return [];
  }
}

export async function loadNativePhotoReviewLedger(
  legacyStats?: NativeReviewLedgerMigrationStats,
): Promise<NativePhotoReviewLedger> {
  const uri = ledgerUri();
  let ledger = EMPTY_LEDGER();
  if (uri) {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) ledger = normalizeNativePhotoReviewLedger(JSON.parse(await FileSystem.readAsStringAsync(uri)));
    } catch (error) {
      console.log("[NativeReviewLedger] Could not load review ledger", { error });
    }
  }

  const beforeMigration = JSON.stringify(ledger);
  if (legacyStats) ledger = migrateLegacyStatsToReviewLedger(ledger, legacyStats);
  if (!ledger.migrations.trimTagsV1) {
    const now = new Date().toISOString();
    (await readLegacyTrimTagIds()).forEach((assetId) => {
      ledger = recordNativePhotoReview(ledger, assetId, "trimmed", now);
    });
    ledger = { ...ledger, updatedAt: new Date().toISOString(), migrations: { ...ledger.migrations, trimTagsV1: true } };
  }
  if (JSON.stringify(ledger) !== beforeMigration) await saveNativePhotoReviewLedger(ledger);
  return ledger;
}

export async function saveNativePhotoReviewLedger(ledger: NativePhotoReviewLedger): Promise<void> {
  const uri = ledgerUri();
  if (!uri) return;
  try {
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(normalizeNativePhotoReviewLedger(ledger)));
  } catch (error) {
    console.log("[NativeReviewLedger] Could not save review ledger", { error });
  }
}
