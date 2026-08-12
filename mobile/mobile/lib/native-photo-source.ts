import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import type { NativeSettings, NativeTrimKind } from "./native-store";
import {
  createDatedPhotoAsset,
  findSimilarPhotosOnDevice,
  isPhotoIntelligenceAvailable,
  photoIntelligenceCapabilities,
  type PhotoIntelligenceAsset,
} from "./photo-intelligence";
import {
  buildConservativeCaptureGroups,
  buildSimilarityCandidateGroups,
  clusterVerifiedSimilarityPairs,
  selectSimilarityRemovals,
  type SimilarityItem,
  type VerifiedSimilarityPair,
} from "./photo-similarity";

export type NativeCleanupCategory =
  | "large"
  | "old"
  | "screenshots"
  | "live"
  | "duplicates"
  | "bursts"
  | "mistakes";

export type NativePhoto = {
  id: string;
  uri: string;
  localUri: string | null;
  title: string;
  year: number;
  month: string;
  device: string;
  sizeMB: number;
  width: number;
  height: number;
  hasGPS: boolean;
  isCloudAsset: boolean;
  creationTime: number;
  cleanupReasons: string[];
  trimState?: NativePhotoTrimState;
};

export type NativePhotoTrimState = {
  applied: NativeTrimKind[];
  updatedAt: string;
  blockedReason?: "already-optimized";
};

export type NativePhotoPermission = {
  granted: boolean;
  limited: boolean;
  canAskAgain: boolean;
  accessLevel: "none" | "selected" | "limited" | "all";
};

export type NativePhotoRoundOptions = {
  avoidIds?: string[];
  excludeMaxTrimmed?: boolean;
  includeTrimmed?: boolean;
  onFallback?: (detail: string) => void;
};

export type NativeLibraryScanProgress = {
  scanned: number;
  total?: number;
  phase?: "indexing" | "similarity";
  analyzed?: number;
  analysisTotal?: number;
};

export type NativePhotoStorageBreakdown = {
  screenshotsMB: number;
  livePhotosMB: number;
  similarPhotosMB: number;
  otherPhotosMB: number;
};

export type NativePhotoFilterIndexItem = {
  sizeMB: number;
  ageYears: number;
  trimSavingsMB: number;
};

export type NativeLibraryScan = {
  assetCount: number;
  localAssetCount: number;
  unknownSizeCount: number;
  totalSizeMB: number;
  localSizeMB: number;
  largestPhotoMB: number;
  oldestPhotoAgeYears: number;
  filterIndex: NativePhotoFilterIndexItem[];
  storageByType: NativePhotoStorageBreakdown;
  deviceCapacityMB: number | null;
  freeSpaceMB: number | null;
  similarityAnalysis: "vision" | "unavailable";
  similarityCandidateCount: number;
  similarityAnalyzedCount: number;
  trimSavingsMB: number;
  duplicateDeleteSavingsMB: number;
  mistakeDeleteSavingsMB: number;
  deleteSavingsMB: number;
  duplicateRemovalCount: number;
  mistakeCount: number;
  screenshotCount: number;
  largeCount: number;
  oldCount: number;
  livePhotoCount: number;
  burstCount: number;
  largeSavingsMB: number;
  oldSavingsMB: number;
  screenshotSavingsMB: number;
  livePhotoSavingsMB: number;
  burstDeleteSavingsMB: number;
  scannedAt: string;
};

export type NativeCleanupPlan = {
  category: NativeCleanupCategory;
  title: string;
  candidates: NativePhoto[];
  deleteCandidates: NativePhoto[];
  trimCandidates: NativePhoto[];
  estimatedDeleteSavingsMB: number;
  estimatedTrimSavingsMB: number;
};

export type NativeDuplicatePhoto = NativePhoto & {
  suggestionReasons?: string[];
  suggestionConfidence?: number;
};

export type NativeDuplicateGroup = {
  id: string;
  photos: NativeDuplicatePhoto[];
  suggestedKeeperId: string;
  similarityLabel?: string;
};

type PhotoMetadataCache = {
  version: 1;
  updatedAt: number;
  photos: NativePhoto[];
};

type MediaAlbum = Awaited<ReturnType<typeof MediaLibrary.getAlbumsAsync>>[number];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// v3 drops legacy heuristic "Similar" labels from cached photo metadata.
const CACHE_FILE = "trimswipe-native-photo-cache-v3.json";
const TRIM_TAGS_FILE = "trimswipe-native-trim-tags-v1.json";
const CACHE_LIMIT = 700;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TRIM_KINDS: NativeTrimKind[] = ["metadata", "location", "compression"];
const MIN_TRIM_SIZE_MB = 1;
const RESIZE_SCALE = 0.8;
const STANDARD_IPHONE_DIMENSIONS = new Set([
  "4032x3024",
  "5712x4284",
  "8064x6048",
  "3840x2160",
  "1920x1080",
]);

let memoryCache: PhotoMetadataCache | null | undefined;
let memoryTrimTags: Record<string, NativePhotoTrimState> | null | undefined;

function cacheUri(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${CACHE_FILE}` : null;
}

function trimTagsUri(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${TRIM_TAGS_FILE}` : null;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function ageYears(creationTime: number): number {
  return Math.max(0, (Date.now() - creationTime) / (365.25 * DAY_MS));
}

function assetSizeMB(asset: MediaLibrary.Asset): number {
  const fileSize = (asset as MediaLibrary.Asset & { fileSize?: number }).fileSize;
  return typeof fileSize === "number" && fileSize > 0 ? +(fileSize / (1024 * 1024)).toFixed(2) : 0;
}

function assetSortSizeMB(asset: MediaLibrary.Asset): number {
  return Math.max(assetSizeMB(asset), estimatedAssetSizeMB(asset));
}

function estimatedAssetSizeMB(asset: MediaLibrary.Asset): number {
  const measured = assetSizeMB(asset);
  if (measured > 0) return measured;

  const width = asset.width || 0;
  const height = asset.height || 0;
  if (width <= 0 || height <= 0) return 0;

  const filename = asset.filename?.toLowerCase() ?? "";
  const megapixels = (width * height) / 1_000_000;
  const multiplier = filename.endsWith(".heic") || filename.endsWith(".heif") ? 0.22 : 0.34;
  return +Math.max(0.35, Math.min(25, megapixels * multiplier)).toFixed(2);
}

function normalizeTrimKinds(value: unknown, fallback: NativeTrimKind[] = []): NativeTrimKind[] {
  const allowed: NativeTrimKind[] = ["metadata", "location", "compression", "resize", "format"];
  if (!Array.isArray(value)) return fallback;
  const kinds = value.filter((item): item is NativeTrimKind => allowed.includes(item as NativeTrimKind));
  return [...new Set(kinds)];
}

function trimKindsForSettings(settings?: Pick<NativeSettings, "trimKinds"> | NativeTrimKind[]): NativeTrimKind[] {
  const value = Array.isArray(settings) ? settings : settings?.trimKinds;
  const kinds = normalizeTrimKinds(value, DEFAULT_TRIM_KINDS);
  return kinds.length > 0 ? kinds : DEFAULT_TRIM_KINDS;
}

function normalizeTrimState(value: unknown): NativePhotoTrimState | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<NativePhotoTrimState>;
  const applied = normalizeTrimKinds(raw.applied);
  const blockedReason = raw.blockedReason === "already-optimized" ? "already-optimized" : undefined;
  if (applied.length === 0 && !blockedReason) return undefined;
  return {
    applied,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    blockedReason,
  };
}

async function readTrimTags(): Promise<Record<string, NativePhotoTrimState>> {
  if (memoryTrimTags != null) return memoryTrimTags;

  const uri = trimTagsUri();
  if (!uri) {
    memoryTrimTags = {};
    return memoryTrimTags;
  }

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      memoryTrimTags = {};
      return memoryTrimTags;
    }
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(uri)) as Record<string, unknown>;
    memoryTrimTags = Object.fromEntries(
      Object.entries(parsed)
        .map(([id, state]) => [id, normalizeTrimState(state)] as const)
        .filter((entry): entry is [string, NativePhotoTrimState] => Boolean(entry[1])),
    );
    return memoryTrimTags;
  } catch (error) {
    console.log("[NativePhotoSource] Could not read trim tags", { error });
    memoryTrimTags = {};
    return memoryTrimTags;
  }
}

async function writeTrimTags(tags: Record<string, NativePhotoTrimState>): Promise<void> {
  const uri = trimTagsUri();
  memoryTrimTags = tags;
  if (!uri) return;

  try {
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(tags));
  } catch (error) {
    console.log("[NativePhotoSource] Could not write trim tags", { error });
  }
}

async function setTrimTag(id: string, state: NativePhotoTrimState): Promise<void> {
  const tags = await readTrimTags();
  if (memoryCache) {
    memoryCache = {
      ...memoryCache,
      photos: memoryCache.photos.map((photo) => (photo.id === id ? { ...photo, trimState: state } : photo)),
    };
  }
  await writeTrimTags({ ...tags, [id]: state });
}

async function removeTrimTagIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const tags = await readTrimTags();
  const next = { ...tags };
  ids.forEach((id) => {
    delete next[id];
  });
  if (memoryCache) {
    const idSet = new Set(ids);
    memoryCache = {
      ...memoryCache,
      photos: memoryCache.photos.map((photo) =>
        idSet.has(photo.id) ? { ...photo, trimState: undefined } : photo,
      ),
    };
  }
  await writeTrimTags(next);
}

async function cleanupCreatedTrimAssets(created: Array<Extract<CreatedTrim, { success: true }>>): Promise<void> {
  const ids = created.map((item) => item.newAssetId).filter(Boolean);
  if (ids.length === 0) return;
  try {
    await MediaLibrary.deleteAssetsAsync(ids);
    await removeCacheIds(ids);
    await removeTrimTagIds(ids);
  } catch (error) {
    console.log("[NativePhotoSource] Could not remove created trim assets after replace failure", { error });
  }
}

function stripKindLabel(kind: NativeTrimKind, quality?: number): string {
  if (kind === "metadata") return "Metadata removed";
  if (kind === "location") return "Location removed";
  if (kind === "resize") return "Resized to 80%";
  if (kind === "format") return "Format optimized";
  return `Compressed${quality ? ` ${Math.round(quality * 100)}%` : ""}`;
}

function nextKindLabel(kinds: NativeTrimKind[], quality?: number): string {
  if (kinds.length === 0) return "Not-trimmable";
  if (kinds.includes("resize") && kinds.includes("format")) return "Resize 80% + format check";
  if (kinds.includes("resize")) return "Resize to 80%";
  if (kinds.includes("format")) return "Try JPG/PNG";
  if (kinds.includes("metadata") && kinds.includes("location")) return "Trim metadata + location";
  if (kinds.includes("metadata")) return "Trim metadata";
  if (kinds.includes("location")) return "Trim location";
  if (kinds.includes("compression")) return `Compress ${Math.round((quality ?? 0.75) * 100)}%`;
  return "Trim";
}

export function getTrimStatus(
  photo: Pick<NativePhoto, "hasGPS" | "isCloudAsset" | "sizeMB" | "trimState"> &
    Partial<Pick<NativePhoto, "width" | "height" | "title">>,
  trimKinds: NativeTrimKind[] = DEFAULT_TRIM_KINDS,
  quality?: number,
  options: { allowSecondPass?: boolean } = {},
): {
  canTrim: boolean;
  applied: NativeTrimKind[];
  strippedLabels: string[];
  nextKinds: NativeTrimKind[];
  nextLabel: string;
  statusLabel: string;
} {
  const enabled = trimKindsForSettings(trimKinds);
  const applied = normalizeTrimKinds(photo.trimState?.applied);
  const blockedReason = photo.trimState?.blockedReason;
  const allowSecondPass = options.allowSecondPass === true;
  if (blockedReason === "already-optimized") {
    return {
      canTrim: false,
      applied,
      strippedLabels: [...applied.map((kind) => stripKindLabel(kind, quality)), "Already optimized"],
      nextKinds: [],
      nextLabel: "Already optimized",
      statusLabel: "Already optimized",
    };
  }
  if (photo.sizeMB <= MIN_TRIM_SIZE_MB) {
    return {
      canTrim: false,
      applied,
      strippedLabels: applied.map((kind) => stripKindLabel(kind, quality)),
      nextKinds: [],
      nextLabel: "Too small to trim",
      statusLabel: "Too small to trim",
    };
  }
  if (applied.length > 0 && !allowSecondPass) {
    return {
      canTrim: false,
      applied,
      strippedLabels: applied.map((kind) => stripKindLabel(kind, quality)),
      nextKinds: [],
      nextLabel: "Already trimmed",
      statusLabel: "Already trimmed",
    };
  }
  const appliedSet = new Set(applied);
  if (allowSecondPass && applied.length > 0) {
    const secondPassKinds: NativeTrimKind[] = [];
    if (!appliedSet.has("resize") && isStandardIPhoneSize(photo)) secondPassKinds.push("resize");
    if (!appliedSet.has("format") && isHeicPhotoName(photo.title ?? "")) secondPassKinds.push("format");
    if (secondPassKinds.length === 0 && !appliedSet.has("compression")) secondPassKinds.push("compression");
    return {
      canTrim: !photo.isCloudAsset && secondPassKinds.length > 0,
      applied,
      strippedLabels: applied.map((kind) => stripKindLabel(kind, quality)),
      nextKinds: secondPassKinds,
      nextLabel: nextKindLabel(secondPassKinds, quality),
      statusLabel: secondPassKinds.length > 0 ? nextKindLabel(secondPassKinds, quality) : "Trimmed max",
    };
  }
  const pendingStrip = enabled.filter(
    (kind) =>
      (kind === "metadata" || (kind === "location" && (photo.hasGPS || appliedSet.has("location")))) &&
      !appliedSet.has(kind),
  );
  const nextKinds =
    pendingStrip.length > 0
      ? pendingStrip
      : enabled.includes("compression") && !appliedSet.has("compression")
        ? (["compression"] as NativeTrimKind[])
        : [];
  const strippedLabels = applied.map((kind) => stripKindLabel(kind, quality));
  return {
    canTrim: !photo.isCloudAsset && nextKinds.length > 0 && photo.sizeMB > 0,
    applied,
    strippedLabels,
    nextKinds,
    nextLabel: nextKindLabel(nextKinds, quality),
    statusLabel: nextKinds.length > 0 ? nextKindLabel(nextKinds, quality) : "Not-trimmable",
  };
}

function isHeicPhotoName(name: string): boolean {
  return /\.(heic|heif)$/i.test(name.trim());
}

function dimensionKey(width: number, height: number): string {
  const wide = Math.max(Math.round(width), Math.round(height));
  const tall = Math.min(Math.round(width), Math.round(height));
  return `${wide}x${tall}`;
}

function isStandardIPhoneSize(photo: Partial<Pick<NativePhoto, "width" | "height">>): boolean {
  const width = photo.width ?? 0;
  const height = photo.height ?? 0;
  if (width <= 0 || height <= 0) return false;
  return STANDARD_IPHONE_DIMENSIONS.has(dimensionKey(width, height));
}

function estimateTrimKindSavings(
  photo: Pick<NativePhoto, "sizeMB" | "hasGPS"> & Partial<Pick<NativePhoto, "width" | "height" | "title">>,
  kind: NativeTrimKind,
  quality = 0.75,
): number {
  if (kind === "metadata") {
    return Math.max(photo.hasGPS ? 0.18 : 0.08, Math.min(photo.sizeMB * 0.08, 0.85));
  }
  if (kind === "location") {
    return photo.hasGPS ? Math.max(0.1, Math.min(photo.sizeMB * 0.035, 0.45)) : 0;
  }
  if (kind === "resize") {
    return isStandardIPhoneSize(photo) ? photo.sizeMB * (1 - RESIZE_SCALE * RESIZE_SCALE) : 0;
  }
  if (kind === "format") {
    return isHeicPhotoName(photo.title ?? "") ? Math.max(0.1, photo.sizeMB * 0.12) : 0;
  }
  const projectedRatio = Math.max(0.5, Math.min(0.95, 0.38 + Math.max(0.5, Math.min(0.98, quality)) * 0.5));
  return Math.max(photo.sizeMB * 0.08, Math.min(photo.sizeMB * 0.5, photo.sizeMB * (1 - projectedRatio)));
}

const SIMILAR_SESSION_WINDOW_MS = 90 * 1000;
const BURST_WINDOW_MS = 8 * 1000;
const VISION_SIMILARITY_THRESHOLD = 8;

function burstKey(asset: MediaLibrary.Asset): string {
  return `${Math.round(asset.creationTime / BURST_WINDOW_MS)}:${asset.width}x${asset.height}`;
}

function dimensionsClose(a: MediaLibrary.Asset, b: MediaLibrary.Asset): boolean {
  const aw = Math.max(a.width || 0, a.height || 0);
  const ah = Math.min(a.width || 0, a.height || 0);
  const bw = Math.max(b.width || 0, b.height || 0);
  const bh = Math.min(b.width || 0, b.height || 0);
  if (aw <= 0 || ah <= 0 || bw <= 0 || bh <= 0) return true;
  const widthDiff = Math.abs(aw - bw) / Math.max(aw, bw);
  const heightDiff = Math.abs(ah - bh) / Math.max(ah, bh);
  const aspectA = aw / Math.max(1, ah);
  const aspectB = bw / Math.max(1, bh);
  return widthDiff <= 0.08 && heightDiff <= 0.08 && Math.abs(aspectA - aspectB) <= 0.06;
}

function sizesClose(a: MediaLibrary.Asset, b: MediaLibrary.Asset): boolean {
  const sizeA = estimatedAssetSizeMB(a);
  const sizeB = estimatedAssetSizeMB(b);
  if (sizeA <= 0 || sizeB <= 0) return true;
  return Math.abs(sizeA - sizeB) / Math.max(sizeA, sizeB) <= 0.35;
}

function assetsLookSimilar(a: MediaLibrary.Asset, b: MediaLibrary.Asset, windowMs = SIMILAR_SESSION_WINDOW_MS): boolean {
  const gapMs = Math.abs(a.creationTime - b.creationTime);
  return gapMs <= windowMs && dimensionsClose(a, b) && sizesClose(a, b);
}

function similarityItem(asset: MediaLibrary.Asset): SimilarityItem {
  return {
    id: asset.id,
    creationTime: asset.creationTime,
    width: asset.width || 0,
    height: asset.height || 0,
    sizeMB: estimatedAssetSizeMB(asset),
  };
}

function assetCanBeSimilar(asset: MediaLibrary.Asset): boolean {
  return (
    !assetHasGeneratedTrimFilename(asset) &&
    !assetLooksLikeScreenshot(asset) &&
    !assetLooksLikeLivePhoto(asset) &&
    !assetLooksLikeBurst(asset)
  );
}

function mapItemGroupsToAssets(
  groups: SimilarityItem[][],
  assets: MediaLibrary.Asset[],
): MediaLibrary.Asset[][] {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  return groups
    .map((group) => group.map((item) => byId.get(item.id)).filter((asset): asset is MediaLibrary.Asset => Boolean(asset)))
    .filter((group) => group.length >= 2);
}

function buildSimilarityCandidateAssetGroups(assets: MediaLibrary.Asset[]): MediaLibrary.Asset[][] {
  const eligible = assets.filter(assetCanBeSimilar);
  return mapItemGroupsToAssets(buildSimilarityCandidateGroups(eligible.map(similarityItem)), eligible);
}

function buildConservativeSimilarGroups(assets: MediaLibrary.Asset[]): MediaLibrary.Asset[][] {
  const eligible = assets.filter(assetCanBeSimilar);
  return mapItemGroupsToAssets(buildConservativeCaptureGroups(eligible.map(similarityItem)), eligible);
}

function includesReason(photo: Pick<NativePhoto, "cleanupReasons" | "title">, reason: string): boolean {
  const title = photo.title.toLowerCase();
  return (
    photo.cleanupReasons.some((item) => item.toLowerCase() === reason.toLowerCase()) ||
    title.includes(reason.toLowerCase())
  );
}

function matchesPhotoSettings(
  photo: Pick<NativePhoto, "creationTime" | "sizeMB" | "cleanupReasons" | "title" | "isCloudAsset">,
  settings: NativeSettings,
): boolean {
  if (settings.targetMode === "balanced") return true;

  const isLarge = photo.sizeMB >= settings.minSizeMB;
  const isOld = ageYears(photo.creationTime) >= settings.minAgeYears;

  switch (settings.targetMode) {
    case "big-only":
      return isLarge;
    case "old-only":
      return isOld;
    case "old-and-large":
      return isLarge && isOld;
    case "duplicates":
    case "similar":
      return includesReason(photo, "Similar");
    case "blurry":
      return includesReason(photo, "Mistake?") || includesReason(photo, "Blurry") || includesReason(photo, "Dark");
    case "screenshots":
      return includesReason(photo, "Screenshot");
    case "live-photos":
      return includesReason(photo, "Live Photo");
    case "multibursts":
    case "bursts":
      return includesReason(photo, "Burst");
    case "icloud":
      return photo.isCloudAsset;
    case "mistakes":
      return includesReason(photo, "Mistake?") || includesReason(photo, "Blurry") || includesReason(photo, "Dark");
    case "big-or-old":
    default:
      return isLarge || isOld;
  }
}

function isMaxTrimmedPhoto(photo: NativePhoto, settings: NativeSettings): boolean {
  if (!photo.trimState) return false;
  const status = getTrimStatus(photo, settings.trimKinds, settings.trimQuality, {
    allowSecondPass: settings.trimReviewMode === "trimmed-only",
  });
  return status.nextKinds.length === 0 || photo.trimState.blockedReason === "already-optimized";
}

function shouldUseRoundPhoto(
  photo: NativePhoto,
  settings: NativeSettings,
  avoidIds: Set<string>,
  excludeMaxTrimmed: boolean,
  includeTrimmed = false,
): boolean {
  if (avoidIds.has(photo.id)) return false;
  const trimmed = Boolean(photo.trimState);
  if (settings.trimReviewMode === "trimmed-only") {
    return trimmed && !isMaxTrimmedPhoto(photo, settings);
  }
  if (settings.trimReviewMode === "all") {
    return !excludeMaxTrimmed || !isMaxTrimmedPhoto(photo, settings);
  }
  if (trimmed && !includeTrimmed) return false;
  return !excludeMaxTrimmed || !isMaxTrimmedPhoto(photo, settings);
}

function shouldUseRelatedPairPhoto(photo: NativePhoto, settings: NativeSettings, avoidIds: Set<string>): boolean {
  if (avoidIds.has(photo.id)) return false;
  if (photo.isCloudAsset || photo.sizeMB <= 0) return false;
  return matchesPhotoSettings(photo, settings);
}

function fallbackDetail(settings: NativeSettings, matchedCount: number, requestedCount: number): string {
  if (settings.targetMode === "balanced") return "";
  const exact =
    matchedCount === 0
      ? "No photos matched this filter"
      : `Only ${matchedCount}/${requestedCount} photos matched this filter`;
  if (settings.targetMode === "old-only") {
    return `${exact}. Loading newer photos instead.`;
  }
  if (settings.targetMode === "big-only") {
    return `${exact}. Loading smaller photos instead.`;
  }
  if (settings.targetMode === "old-and-large") {
    return `${exact}. Loading photos outside the age/size threshold instead.`;
  }
  return `${exact}. Loading a broader set instead.`;
}

function assetLooksLikeScreenshot(asset: MediaLibrary.Asset): boolean {
  const filename = asset.filename?.toLowerCase() ?? "";
  const normalizedFilename = filename.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const subtypes = (asset as MediaLibrary.Asset & { mediaSubtypes?: string[] }).mediaSubtypes ?? [];
  return (
    subtypes.some((subtype) => subtype.toLowerCase().includes("screenshot")) ||
    normalizedFilename.includes("screenshot") ||
    normalizedFilename.includes("screen shot") ||
    normalizedFilename.includes("screen-shot") ||
    normalizedFilename.includes("screen_shot") ||
    normalizedFilename.startsWith("skarmavbild") ||
    normalizedFilename.startsWith("skarmbild")
  );
}

function assetExtension(asset: MediaLibrary.Asset): string {
  const filename = asset.filename?.toLowerCase() ?? "";
  const match = filename.match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function assetHasGeneratedTrimFilename(asset: MediaLibrary.Asset): boolean {
  const filename = (asset.filename ?? "").trim();
  const basename = filename.replace(/\.[^.]+$/, "");
  const uuidishName =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(basename) ||
    /^[0-9a-f]{32}$/i.test(basename);
  const extension = assetExtension(asset);
  const trimOutputFormat = extension === "" || extension === "jpg" || extension === "jpeg" || extension === "png";
  return uuidishName && trimOutputFormat;
}

function assetHasCameraInfo(info: MediaLibrary.AssetInfo): boolean {
  const exif = (info.exif ?? {}) as Record<string, unknown>;
  return ["Make", "Model", "LensModel", "FNumber", "FocalLength", "ISOSpeedRatings", "ExposureTime"].some((key) => {
    const value = exif[key];
    if (typeof value === "string") return value.trim().length > 0;
    return typeof value === "number" && Number.isFinite(value) && value !== 0;
  });
}

function assetLooksLikeTrimmedOutput(
  asset: MediaLibrary.Asset,
  info: MediaLibrary.AssetInfo,
  trimState?: NativePhotoTrimState,
): boolean {
  if (trimState) return true;
  if (assetLooksLikeScreenshot(asset)) return false;
  return assetHasGeneratedTrimFilename(asset) && !assetHasCameraInfo(info);
}

function assetLooksLikeLivePhoto(asset: MediaLibrary.Asset): boolean {
  const subtypes = (asset as MediaLibrary.Asset & { mediaSubtypes?: string[] }).mediaSubtypes ?? [];
  const filename = asset.filename?.toLowerCase() ?? "";
  return subtypes.some((subtype) => subtype.toLowerCase().includes("live")) || filename.includes("live");
}

function assetLooksLikeBurst(asset: MediaLibrary.Asset): boolean {
  const filename = asset.filename?.toLowerCase() ?? "";
  const subtypes = (asset as MediaLibrary.Asset & { mediaSubtypes?: string[] }).mediaSubtypes ?? [];
  return subtypes.some((subtype) => subtype.toLowerCase().includes("burst")) || filename.includes("burst");
}

function assetLooksLikeMistake(asset: MediaLibrary.Asset): boolean {
  const filename = asset.filename?.toLowerCase() ?? "";
  const width = asset.width || 0;
  const height = asset.height || 0;
  const ratio = width > 0 && height > 0 ? Math.max(width, height) / Math.max(1, Math.min(width, height)) : 1;
  const measuredSizeMB = assetSizeMB(asset);
  return (
    ratio > 2.2 ||
    (measuredSizeMB > 0 && measuredSizeMB < 0.35) ||
    filename.includes("blur") ||
    filename.includes("dark")
  );
}

function assetLooksUncategorized(
  asset: MediaLibrary.Asset,
  info: MediaLibrary.AssetInfo,
  duplicateLookup: Set<string>,
  trimState?: NativePhotoTrimState,
): boolean {
  if (duplicateLookup.has(asset.id)) return false;
  if (assetLooksLikeTrimmedOutput(asset, info, trimState)) return false;
  if (assetLooksLikeScreenshot(asset) || assetLooksLikeLivePhoto(asset) || assetLooksLikeBurst(asset)) return false;
  if (assetLooksLikeMistake(asset)) return false;
  const filename = asset.filename?.toLowerCase() ?? "";
  return assetHasCameraInfo(info) || filename.startsWith("img_") || STANDARD_IPHONE_DIMENSIONS.has(`${asset.width}x${asset.height}`);
}

function matchesAssetSettings(
  asset: MediaLibrary.Asset,
  settings: NativeSettings,
  duplicateLookup: Set<string>,
): boolean {
  if (settings.targetMode === "balanced") return true;

  const isLarge = assetSortSizeMB(asset) >= settings.minSizeMB;
  const isOld = ageYears(asset.creationTime) >= settings.minAgeYears;

  switch (settings.targetMode) {
    case "big-only":
      return isLarge;
    case "old-only":
      return isOld;
    case "old-and-large":
      return isLarge && isOld;
    case "duplicates":
    case "similar":
      return duplicateLookup.has(asset.id);
    case "blurry":
      return assetLooksLikeMistake(asset);
    case "screenshots":
      return assetLooksLikeScreenshot(asset);
    case "live-photos":
      return assetLooksLikeLivePhoto(asset);
    case "multibursts":
    case "bursts":
      return assetLooksLikeBurst(asset);
    case "icloud":
      return assetSizeMB(asset) === 0;
    case "mistakes":
      return assetLooksLikeMistake(asset);
    case "big-or-old":
    default:
      return isLarge || isOld;
  }
}

function scorePhoto(
  photo: Pick<NativePhoto, "creationTime" | "sizeMB" | "cleanupReasons" | "title" | "isCloudAsset">,
  settings: NativeSettings,
): number {
  const sizeScore = settings.minSizeMB > 0 ? photo.sizeMB / settings.minSizeMB : 0;
  const ageScore = settings.minAgeYears > 0 ? ageYears(photo.creationTime) / settings.minAgeYears : 0;
  const isLarge = photo.sizeMB >= settings.minSizeMB;
  const isOld = ageYears(photo.creationTime) >= settings.minAgeYears;
  const modeMatch = matchesPhotoSettings(photo, settings) ? 3 : 0;
  return (
    Math.min(sizeScore, 4) +
    Math.min(ageScore, 4) +
    (isLarge ? 2 : 0) +
    (isOld ? 2 : 0) +
    (isLarge && isOld ? 3 : 0) +
    modeMatch
  );
}

function scoreAsset(asset: MediaLibrary.Asset, settings: NativeSettings): number {
  return scorePhoto(
    {
      creationTime: asset.creationTime,
      sizeMB: assetSortSizeMB(asset),
      cleanupReasons: [],
      title: asset.filename ?? "",
      isCloudAsset: assetSizeMB(asset) === 0,
    },
    settings,
  );
}

function classifyAsset(
  asset: MediaLibrary.Asset,
  info: MediaLibrary.AssetInfo,
  sizeMB: number,
  duplicateLookup: Set<string>,
  trimState?: NativePhotoTrimState,
): string[] {
  const reasons = new Set<string>();
  const filename = asset.filename?.toLowerCase() ?? "";
  const width = asset.width || 0;
  const height = asset.height || 0;
  const ratio = width > 0 && height > 0 ? Math.max(width, height) / Math.max(1, Math.min(width, height)) : 1;
  const trimmed = assetLooksLikeTrimmedOutput(asset, info, trimState);
  const screenshot = assetLooksLikeScreenshot(asset);
  const live = assetLooksLikeLivePhoto(asset);
  const burst = assetLooksLikeBurst(asset);
  const mistake = assetLooksLikeMistake(asset);

  if (trimmed) reasons.add("Trimmed");
  if (screenshot) reasons.add("Screenshot");
  if (ageYears(asset.creationTime) >= 5) reasons.add("Old");
  if (sizeMB >= 4) reasons.add("Large");
  if (duplicateLookup.has(asset.id)) reasons.add("Similar");
  if (assetLooksUncategorized(asset, info, duplicateLookup, trimState)) reasons.add("Uncategorized");
  if (live) reasons.add("Live Photo");
  if (burst) reasons.add("Burst");
  if (filename.includes("blur")) reasons.add("Blurry");
  if (filename.includes("dark") || filename.includes("night")) reasons.add("Dark");
  if (mistake || ratio > 2.2 || sizeMB < 0.35 || filename.includes("pocket")) reasons.add("Mistake?");
  if (!info.location && !asset.filename) reasons.add("No context");
  if (reasons.size === 0) reasons.add("Review");

  return [...reasons].slice(0, 3);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function isNativePhoto(value: unknown): value is NativePhoto {
  const item = value && typeof value === "object" ? (value as Partial<NativePhoto>) : {};
  return typeof item.id === "string" && typeof item.uri === "string" && typeof item.creationTime === "number";
}

function normalizeCachedPhoto(photo: NativePhoto): NativePhoto {
  const trimState = normalizeTrimState(photo.trimState);
  const displayUri =
    photo.localUri && !photo.localUri.startsWith("ph://") && photo.uri.startsWith("ph://")
      ? photo.localUri
      : photo.uri;
  const normalized = {
    ...photo,
    uri: displayUri,
    width: Number.isFinite(photo.width) ? photo.width : 0,
    height: Number.isFinite(photo.height) ? photo.height : 0,
  };
  return trimState ? { ...normalized, trimState } : { ...normalized, trimState: undefined };
}

async function readCache(): Promise<PhotoMetadataCache> {
  if (memoryCache != null) return memoryCache;

  const uri = cacheUri();
  if (!uri) {
    memoryCache = { version: 1, updatedAt: 0, photos: [] };
    return memoryCache;
  }

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      memoryCache = { version: 1, updatedAt: 0, photos: [] };
      return memoryCache;
    }

    const raw = await FileSystem.readAsStringAsync(uri);
    const parsed = JSON.parse(raw) as Partial<PhotoMetadataCache>;
    const trimTags = await readTrimTags();
    memoryCache = {
      version: 1,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
      photos: Array.isArray(parsed.photos)
        ? parsed.photos
            .filter(isNativePhoto)
            .map(normalizeCachedPhoto)
            .map((photo) => (trimTags[photo.id] ? { ...photo, trimState: trimTags[photo.id] } : photo))
        : [],
    };
    return memoryCache;
  } catch (error) {
    console.log("[NativePhotoSource] Could not read metadata cache", { error });
    memoryCache = { version: 1, updatedAt: 0, photos: [] };
    return memoryCache;
  }
}

async function writeCache(photos: NativePhoto[]): Promise<void> {
  const uri = cacheUri();
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const retained = [...byId.values()]
    .sort((a, b) => {
      const timeDiff = b.creationTime - a.creationTime;
      if (Math.abs(timeDiff) > DAY_MS) return timeDiff;
      return b.sizeMB - a.sizeMB;
    })
    .slice(0, CACHE_LIMIT);

  memoryCache = { version: 1, updatedAt: Date.now(), photos: retained };
  if (!uri) return;

  try {
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(memoryCache));
  } catch (error) {
    console.log("[NativePhotoSource] Could not write metadata cache", { error });
  }
}

async function upsertCache(photos: NativePhoto[]): Promise<void> {
  if (photos.length === 0) return;
  const cache = await readCache();
  await writeCache([...cache.photos, ...photos]);
}

async function removeCacheIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  const cache = await readCache();
  await writeCache(cache.photos.filter((photo) => !idSet.has(photo.id)));
}

async function assetToPhoto(
  asset: MediaLibrary.Asset,
  duplicateLookup: Set<string>,
): Promise<NativePhoto> {
  const info = await MediaLibrary.getAssetInfoAsync(asset);
  const localUri = info.localUri || asset.uri || null;
  const candidateUri = localUri || asset.uri;
  let sizeMB = assetSizeMB(asset);

  if (sizeMB === 0 && candidateUri && !candidateUri.startsWith("ph://")) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(candidateUri);
      const bytes = (fileInfo as FileSystem.FileInfo & { size?: number }).size;
      if (fileInfo.exists && typeof bytes === "number" && bytes > 0) {
        sizeMB = +(bytes / (1024 * 1024)).toFixed(2);
      }
    } catch {
      sizeMB = 0;
    }
  }
  if (sizeMB === 0) {
    sizeMB = estimatedAssetSizeMB(asset);
  }

  const created = new Date(asset.creationTime);
  const trimTags = await readTrimTags();
  const trimState = trimTags[asset.id];
  return {
    id: asset.id,
    uri: candidateUri,
    localUri,
    title: asset.filename || "Photo",
    year: created.getFullYear(),
    month: MONTHS[created.getMonth()] ?? "Jan",
    device:
      typeof (info.exif as Record<string, unknown> | undefined)?.Model === "string"
        ? ((info.exif as Record<string, unknown>).Model as string)
        : "iPhone",
    sizeMB,
    width: asset.width || 0,
    height: asset.height || 0,
    hasGPS: Boolean(info.location?.latitude && info.location?.longitude),
    isCloudAsset: !localUri || localUri.startsWith("ph://"),
    creationTime: asset.creationTime,
    cleanupReasons: classifyAsset(asset, info, sizeMB, duplicateLookup, trimState),
    trimState,
  };
}

function usefulSmartAlbumScore(album: MediaAlbum): number {
  const title = String((album as MediaAlbum & { title?: string }).title ?? "").toLowerCase();
  if (title.includes("screenshot") || title.includes("screen shot")) return 10;
  if (title.includes("duplicate") || title.includes("similar")) return 9;
  if (title.includes("burst")) return 8;
  if (title.includes("selfie")) return 6;
  if (title.includes("panorama") || title.includes("slo") || title.includes("time-lapse")) return 4;
  return 0;
}

async function fetchSmartAlbumAssets(first: number): Promise<MediaLibrary.Asset[]> {
  try {
    const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
    const usefulAlbums = albums
      .map((album) => ({ album, score: usefulSmartAlbumScore(album) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const pages = await Promise.all(
      usefulAlbums.map((item) =>
        MediaLibrary.getAssetsAsync({
          album: item.album,
          first: Math.min(80, first),
          mediaType: "photo",
          sortBy: [[MediaLibrary.SortBy.creationTime, true]],
        }),
      ),
    );

    return pages.flatMap((page) => page.assets);
  } catch (error) {
    console.log("[NativePhotoSource] Could not read smart albums", { error });
    return [];
  }
}

async function fetchCandidateAssets(
  count: number,
  settings: NativeSettings,
): Promise<MediaLibrary.Asset[]> {
  const first = Math.min(600, Math.max(180, count * 24));
  const smartAlbumsPromise = fetchSmartAlbumAssets(first);

  if (settings.targetMode === "balanced") {
    const [result, smartAlbums] = await Promise.all([
      MediaLibrary.getAssetsAsync({
        first,
        mediaType: "photo",
        sortBy: [[MediaLibrary.SortBy.creationTime, true]],
      }),
      smartAlbumsPromise,
    ]);

    const byId = new Map<string, MediaLibrary.Asset>();
    [...result.assets, ...smartAlbums].forEach((asset) => byId.set(asset.id, asset));
    return [...byId.values()];
  }

  const cutoff = Date.now() - settings.minAgeYears * 365.25 * DAY_MS;
  const [recent, older, smartAlbums] = await Promise.all([
    MediaLibrary.getAssetsAsync({
      first,
      mediaType: "photo",
      sortBy: [[MediaLibrary.SortBy.creationTime, true]],
    }),
    MediaLibrary.getAssetsAsync({
      first,
      mediaType: "photo",
      createdBefore: cutoff,
      sortBy: [[MediaLibrary.SortBy.creationTime, true]],
    }),
    smartAlbumsPromise,
  ]);

  const byId = new Map<string, MediaLibrary.Asset>();
  [...recent.assets, ...older.assets, ...smartAlbums].forEach((asset) => byId.set(asset.id, asset));
  return [...byId.values()];
}

async function readDeviceStorageMB(): Promise<{ total: number | null; free: number | null }> {
  const fileSystem = FileSystem as typeof FileSystem & {
    getTotalDiskCapacityAsync?: () => Promise<number>;
    getFreeDiskStorageAsync?: () => Promise<number>;
  };

  const [totalResult, freeResult] = await Promise.allSettled([
    fileSystem.getTotalDiskCapacityAsync?.() ?? Promise.resolve(null),
    fileSystem.getFreeDiskStorageAsync?.() ?? Promise.resolve(null),
  ]);

  const total = totalResult.status === "fulfilled" && typeof totalResult.value === "number"
    ? +(totalResult.value / (1024 * 1024)).toFixed(2)
    : null;
  const free = freeResult.status === "fulfilled" && typeof freeResult.value === "number"
    ? +(freeResult.value / (1024 * 1024)).toFixed(2)
    : null;

  return { total, free };
}

type VerifiedSimilarityResult = {
  groups: MediaLibrary.Asset[][];
  analysisById: Map<string, PhotoIntelligenceAsset>;
  method: "vision" | "unavailable";
  candidateCount: number;
  analyzedCount: number;
};

function packSimilarityGroups(
  groups: MediaLibrary.Asset[][],
  maximumAssets: number,
): { candidateGroups: MediaLibrary.Asset[][]; batches: MediaLibrary.Asset[][] } {
  const capacity = Math.max(2, maximumAssets);
  const candidateGroups = groups.flatMap((group) => {
    if (group.length <= capacity) return [group];
    const chunks: MediaLibrary.Asset[][] = [];
    for (let index = 0; index < group.length; index += capacity) {
      const chunk = group.slice(index, index + capacity);
      if (chunk.length >= 2) chunks.push(chunk);
    }
    return chunks;
  });
  const batches: MediaLibrary.Asset[][] = [];
  let current: MediaLibrary.Asset[] = [];

  candidateGroups.forEach((group) => {
    if (current.length > 0 && current.length + group.length > capacity) {
      batches.push(current);
      current = [];
    }
    current.push(...group);
  });
  if (current.length > 0) batches.push(current);
  return { candidateGroups, batches };
}

async function findVerifiedSimilarAssetGroups(
  assets: MediaLibrary.Asset[],
  onProgress?: (progress: NativeLibraryScanProgress) => void,
): Promise<VerifiedSimilarityResult> {
  const broadGroups = buildSimilarityCandidateAssetGroups(assets);
  const candidateCount = broadGroups.reduce((sum, group) => sum + group.length, 0);
  const analysisById = new Map<string, PhotoIntelligenceAsset>();
  if (!isPhotoIntelligenceAvailable()) {
    return { groups: [], analysisById, method: "unavailable", candidateCount, analyzedCount: 0 };
  }
  if (candidateCount === 0) {
    return { groups: [], analysisById, method: "vision", candidateCount: 0, analyzedCount: 0 };
  }

  const maximumAssets = photoIntelligenceCapabilities()?.maximumAssetsPerBatch ?? 120;
  const { candidateGroups, batches } = packSimilarityGroups(broadGroups, maximumAssets);
  const verifiedPairs: VerifiedSimilarityPair[] = [];
  let succeededBatches = 0;
  let analyzedCount = 0;
  let processedCount = 0;

  for (const batch of batches) {
    try {
      const analysis = await findSimilarPhotosOnDevice(
        batch.map((asset) => asset.id),
        VISION_SIMILARITY_THRESHOLD,
      );
      succeededBatches += 1;
      processedCount += analysis.processedCount;
      analysis.items.forEach((item) => {
        analysisById.set(item.assetId, item);
        if (item.analysisAvailable) analyzedCount += 1;
      });
      verifiedPairs.push(...analysis.pairs);
    } catch (error) {
      console.log("[NativePhotoSource] Vision similarity batch failed", {
        error,
        batchSize: batch.length,
      });
    }
    onProgress?.({
      scanned: assets.length,
      total: assets.length,
      phase: "similarity",
      analyzed: Math.min(candidateCount, processedCount),
      analysisTotal: candidateCount,
    });
  }

  const method = succeededBatches > 0 && analyzedCount >= 2 ? "vision" : "unavailable";
  if (method !== "vision") {
    return { groups: [], analysisById, method, candidateCount, analyzedCount };
  }
  const verifiedItemGroups = clusterVerifiedSimilarityPairs(
    candidateGroups.map((group) => group.map(similarityItem)),
    verifiedPairs,
  );
  return {
    groups: mapItemGroupsToAssets(verifiedItemGroups, assets),
    analysisById,
    method,
    candidateCount,
    analyzedCount,
  };
}

async function buildVisionVerifiedDuplicateLookup(
  assets: MediaLibrary.Asset[],
): Promise<Set<string>> {
  const verified = await findVerifiedSimilarAssetGroups(assets);
  if (verified.method !== "vision") return new Set<string>();
  return new Set(verified.groups.flatMap((group) => group.map((asset) => asset.id)));
}

async function fetchAllPhotoAssets(
  onProgress?: (progress: NativeLibraryScanProgress) => void,
): Promise<MediaLibrary.Asset[]> {
  const assets: MediaLibrary.Asset[] = [];
  let after: string | undefined;
  let total: number | undefined;

  do {
    const page = await MediaLibrary.getAssetsAsync({
      after,
      first: 500,
      mediaType: "photo",
      sortBy: [[MediaLibrary.SortBy.creationTime, true]],
    });

    assets.push(...page.assets);
    after = page.hasNextPage ? page.endCursor : undefined;
    total = typeof (page as typeof page & { totalCount?: number }).totalCount === "number"
      ? (page as typeof page & { totalCount?: number }).totalCount
      : total;
    onProgress?.({ scanned: assets.length, total, phase: "indexing" });
  } while (after);

  return assets;
}

export async function scanPhotoLibrary(
  onProgress?: (progress: NativeLibraryScanProgress) => void,
): Promise<NativeLibraryScan> {
  const [assets, storage] = await Promise.all([fetchAllPhotoAssets(onProgress), readDeviceStorageMB()]);
  const similarity = await findVerifiedSimilarAssetGroups(assets, onProgress);
  const similaritySelection = selectSimilarityRemovals(
    similarity.groups.map((group) => group.map(similarityItem)),
  );
  const duplicateRemovalIds = similaritySelection.removalIds;
  const burstGroups = new Map<string, Array<{ id: string; sizeMB: number }>>();
  const summaries = assets.map((asset) => {
    const measuredSizeMB = assetSizeMB(asset);
    const sizeMB = estimatedAssetSizeMB(asset);
    const burst = burstKey(asset);
    const summary = {
      id: asset.id,
      burst,
      sizeMB,
      measured: measuredSizeMB > 0,
      similarRemoval: duplicateRemovalIds.has(asset.id),
      mistake: assetLooksLikeMistake(asset),
      screenshot: assetLooksLikeScreenshot(asset),
      large: sizeMB >= 5,
      ageYears: ageYears(asset.creationTime),
      old: ageYears(asset.creationTime) >= 1,
      live: assetLooksLikeLivePhoto(asset),
    };
    burstGroups.set(burst, [...(burstGroups.get(burst) ?? []), { id: asset.id, sizeMB }]);
    return summary;
  });

  const deleteCandidateIds = new Set<string>();
  const screenshotSummaries = summaries.filter((item) => item.screenshot);
  screenshotSummaries.forEach((item) => deleteCandidateIds.add(item.id));
  const screenshotSavingsMB = screenshotSummaries.reduce((sum, item) => sum + item.sizeMB, 0);
  const duplicateSummaries = summaries.filter((item) => item.similarRemoval && !deleteCandidateIds.has(item.id));
  duplicateSummaries.forEach((item) => deleteCandidateIds.add(item.id));
  const duplicateDeleteSavingsMB = duplicateSummaries.reduce((sum, item) => sum + item.sizeMB, 0);
  const duplicateRemovalCount = duplicateSummaries.length;

  let burstDeleteSavingsMB = 0;
  let burstCount = 0;
  burstGroups.forEach((items) => {
    if (items.length < 3) return;
    const removable = [...items].sort((a, b) => b.sizeMB - a.sizeMB).slice(1);
    removable.forEach((item) => {
      if (deleteCandidateIds.has(item.id)) return;
      deleteCandidateIds.add(item.id);
      burstCount += 1;
      burstDeleteSavingsMB += item.sizeMB;
    });
  });

  const mistakeSummaries = summaries.filter(
    (item) => item.mistake && !deleteCandidateIds.has(item.id),
  );
  mistakeSummaries.forEach((item) => deleteCandidateIds.add(item.id));
  const mistakeDeleteSavingsMB = mistakeSummaries.reduce((sum, item) => sum + item.sizeMB, 0);
  const deleteSavingsMB =
    screenshotSavingsMB + duplicateDeleteSavingsMB + burstDeleteSavingsMB + mistakeDeleteSavingsMB;

  const totalSizeMB = summaries.reduce((sum, item) => sum + item.sizeMB, 0);
  const localSizeMB = summaries
    .filter((item) => item.measured)
    .reduce((sum, item) => sum + item.sizeMB, 0);
  const storageByType = summaries.reduce<NativePhotoStorageBreakdown>(
    (breakdown, item) => {
      if (item.screenshot) breakdown.screenshotsMB += item.sizeMB;
      else if (item.live) breakdown.livePhotosMB += item.sizeMB;
      else if (item.similarRemoval) breakdown.similarPhotosMB += item.sizeMB;
      else breakdown.otherPhotosMB += item.sizeMB;
      return breakdown;
    },
    { screenshotsMB: 0, livePhotosMB: 0, similarPhotosMB: 0, otherPhotosMB: 0 },
  );
  const trimSavingsMB = summaries.reduce(
    (sum, item) =>
      sum +
      (deleteCandidateIds.has(item.id)
        ? 0
        : estimateTrimSavings({ sizeMB: item.sizeMB, hasGPS: false })),
    0,
  );
  const largeSavingsMB = summaries
    .filter((item) => item.large)
    .reduce((sum, item) => sum + estimateTrimSavings({ sizeMB: item.sizeMB, hasGPS: false }), 0);
  const oldSavingsMB = summaries
    .filter((item) => item.old)
    .reduce((sum, item) => sum + estimateTrimSavings({ sizeMB: item.sizeMB, hasGPS: false }), 0);
  const livePhotoSavingsMB = summaries
    .filter((item) => item.live)
    .reduce((sum, item) => sum + estimateTrimSavings({ sizeMB: item.sizeMB, hasGPS: false }), 0);

  return {
    assetCount: assets.length,
    localAssetCount: summaries.filter((item) => item.measured).length,
    unknownSizeCount: summaries.filter((item) => !item.measured).length,
    totalSizeMB: +totalSizeMB.toFixed(2),
    localSizeMB: +localSizeMB.toFixed(2),
    largestPhotoMB: +Math.max(0, ...summaries.map((item) => item.sizeMB)).toFixed(2),
    oldestPhotoAgeYears: +Math.max(0, ...assets.map((asset) => ageYears(asset.creationTime))).toFixed(4),
    filterIndex: summaries.map((item) => ({
      sizeMB: item.sizeMB,
      ageYears: item.ageYears,
      // Folder-specific estimates remain useful even when the same photo is a
      // delete candidate elsewhere; only the headline totals are de-duplicated.
      trimSavingsMB: +estimateTrimSavings({ sizeMB: item.sizeMB, hasGPS: false }).toFixed(2),
    })),
    storageByType: {
      screenshotsMB: +storageByType.screenshotsMB.toFixed(2),
      livePhotosMB: +storageByType.livePhotosMB.toFixed(2),
      similarPhotosMB: +storageByType.similarPhotosMB.toFixed(2),
      otherPhotosMB: +storageByType.otherPhotosMB.toFixed(2),
    },
    deviceCapacityMB: storage.total,
    freeSpaceMB: storage.free,
    similarityAnalysis: similarity.method,
    similarityCandidateCount: similarity.candidateCount,
    similarityAnalyzedCount: similarity.analyzedCount,
    trimSavingsMB: +trimSavingsMB.toFixed(2),
    duplicateDeleteSavingsMB: +duplicateDeleteSavingsMB.toFixed(2),
    mistakeDeleteSavingsMB: +mistakeDeleteSavingsMB.toFixed(2),
    deleteSavingsMB: +deleteSavingsMB.toFixed(2),
    duplicateRemovalCount,
    mistakeCount: mistakeSummaries.length,
    screenshotCount: summaries.filter((item) => item.screenshot).length,
    largeCount: summaries.filter((item) => item.large).length,
    oldCount: summaries.filter((item) => item.old).length,
    livePhotoCount: summaries.filter((item) => item.live).length,
    burstCount,
    largeSavingsMB: +largeSavingsMB.toFixed(2),
    oldSavingsMB: +oldSavingsMB.toFixed(2),
    screenshotSavingsMB: +screenshotSavingsMB.toFixed(2),
    livePhotoSavingsMB: +livePhotoSavingsMB.toFixed(2),
    burstDeleteSavingsMB: +burstDeleteSavingsMB.toFixed(2),
    scannedAt: new Date().toISOString(),
  };
}

export async function loadCleanupPlan(
  category: NativeCleanupCategory,
  count: number,
  settings: NativeSettings,
  options: NativePhotoRoundOptions = {},
): Promise<NativeCleanupPlan> {
  const targetModeByCategory: Record<NativeCleanupCategory, NativeSettings["targetMode"]> = {
    large: "big-only",
    old: "old-only",
    screenshots: "screenshots",
    live: "live-photos",
    duplicates: "similar",
    bursts: "multibursts",
    mistakes: "blurry",
  };
  const candidates = await loadPhotoRound(
    count,
    {
      ...settings,
      targetMode: targetModeByCategory[category],
      cardsPerRound: count,
      minSizeMB: settings.minSizeMB,
      minAgeYears: settings.minAgeYears,
    },
    options,
  );
  const deleteCategories = new Set<NativeCleanupCategory>(["screenshots", "bursts", "mistakes"]);
  const deleteCandidates =
    category === "duplicates"
      ? candidates.filter((photo) => includesReason(photo, "Similar"))
      : deleteCategories.has(category)
        ? candidates
        : [];
  const trimCandidates = deleteCategories.has(category)
    ? []
    : candidates.filter((photo) => {
        if (category === "duplicates" && includesReason(photo, "Similar")) return false;
        const trimOptions = {
          allowSecondPass: settings.trimReviewMode === "trimmed-only",
          quality: settings.trimQuality,
        };
        return (
          !photo.isCloudAsset &&
          getTrimStatus(photo, settings.trimKinds, settings.trimQuality, trimOptions).canTrim &&
          estimateTrimSavings(photo, settings.trimKinds, trimOptions) > 0
        );
      });
  const estimatedDeleteSavingsMB = deleteCandidates.reduce((sum, photo) => sum + photo.sizeMB, 0);
  const estimatedTrimSavingsMB = trimCandidates.reduce(
    (sum, photo) =>
      sum +
      estimateTrimSavings(photo, settings.trimKinds, {
        allowSecondPass: settings.trimReviewMode === "trimmed-only",
        quality: settings.trimQuality,
      }),
    0,
  );
  const titleByCategory: Record<NativeCleanupCategory, string> = {
    large: "Photos >5MB",
    old: "Photos >1 year old",
    screenshots: "Screenshots",
    live: "Live Photos",
    duplicates: "Similar Photos",
    bursts: "Bursts",
    mistakes: "Likely mistakes",
  };

  return {
    category,
    title: titleByCategory[category],
    candidates,
    deleteCandidates,
    trimCandidates,
    estimatedDeleteSavingsMB: +estimatedDeleteSavingsMB.toFixed(2),
    estimatedTrimSavingsMB: +estimatedTrimSavingsMB.toFixed(2),
  };
}

function chooseAssets(
  assets: MediaLibrary.Asset[],
  count: number,
  settings: NativeSettings,
  duplicateLookup: Set<string>,
): MediaLibrary.Asset[] {
  const targeted = assets.filter((asset) => matchesAssetSettings(asset, settings, duplicateLookup));
  const pool = settings.targetMode === "balanced" ? assets : targeted;
  if (settings.targetMode === "balanced") {
    return shuffle(pool)
      .sort((a, b) => b.creationTime - a.creationTime + (Math.random() - 0.5) * DAY_MS)
      .slice(0, count);
  }

  return shuffle(pool)
    .sort((a, b) => scoreAsset(b, settings) - scoreAsset(a, settings))
    .slice(0, count);
}

function relatedPairScore(a: MediaLibrary.Asset, b: MediaLibrary.Asset): number {
  const gapMs = Math.abs(a.creationTime - b.creationTime);
  const sameDuplicateKey = assetsLookSimilar(a, b);
  const sameDimensions = a.width === b.width && a.height === b.height;
  const sizeGap = Math.abs(estimatedAssetSizeMB(a) - estimatedAssetSizeMB(b));

  let score = 0;
  if (sameDuplicateKey) score += 120;
  if (gapMs <= 3_000) score += 90;
  else if (gapMs <= 60_000) score += 70;
  else if (gapMs <= 10 * 60_000) score += 45;
  else if (gapMs <= 60 * 60_000) score += 20;
  if (sameDimensions) score += 16;
  if (sizeGap <= 0.35) score += 8;
  return score - gapMs / (60 * 60_000);
}

export async function loadRelatedPhotoPairs(
  pairCount: number,
  settings: NativeSettings,
  options: { avoidIds?: string[] } = {},
): Promise<[NativePhoto, NativePhoto][]> {
  const requestedPairs = Math.max(1, pairCount);
  const avoidIds = new Set(options.avoidIds ?? []);
  const page = await MediaLibrary.getAssetsAsync({
    first: Math.min(500, Math.max(160, requestedPairs * 36)),
    mediaType: "photo",
    sortBy: [[MediaLibrary.SortBy.creationTime, true]],
  });
  const smartAlbums = await fetchSmartAlbumAssets(Math.min(160, requestedPairs * 24));
  const byId = new Map<string, MediaLibrary.Asset>();
  [...page.assets, ...smartAlbums].forEach((asset) => byId.set(asset.id, asset));
  const assets = [...byId.values()].sort((a, b) => b.creationTime - a.creationTime);

  const candidates: { a: MediaLibrary.Asset; b: MediaLibrary.Asset; score: number }[] = [];
  for (let i = 0; i < assets.length; i += 1) {
    for (let j = i + 1; j < Math.min(assets.length, i + 12); j += 1) {
      const gapMs = Math.abs(assets[i].creationTime - assets[j].creationTime);
      if (gapMs > SIMILAR_SESSION_WINDOW_MS && !assetsLookSimilar(assets[i], assets[j])) continue;
      const score = relatedPairScore(assets[i], assets[j]);
      if (score > 0) candidates.push({ a: assets[i], b: assets[j], score });
    }
  }

  const selectedAssets: [MediaLibrary.Asset, MediaLibrary.Asset][] = [];
  const used = new Set<string>();
  candidates
    .sort((a, b) => b.score - a.score)
    .forEach(({ a, b }) => {
      if (selectedAssets.length >= requestedPairs) return;
      if (used.has(a.id) || used.has(b.id)) return;
      selectedAssets.push([a, b]);
      used.add(a.id);
      used.add(b.id);
    });

  if (selectedAssets.length < requestedPairs) {
    const fallback = chooseAssets(
      assets.filter((asset) => !used.has(asset.id)),
      (requestedPairs - selectedAssets.length) * 2,
      { ...settings, targetMode: "balanced" },
      new Set<string>(),
    );
    for (let i = 0; i + 1 < fallback.length && selectedAssets.length < requestedPairs; i += 2) {
      selectedAssets.push([fallback[i], fallback[i + 1]]);
    }
  }

  // Related-pair mode is not a similarity classification surface.
  const duplicateLookup = new Set<string>();
  const flattened = selectedAssets.flat();
  const photos = await mapWithConcurrency(flattened, 3, (asset) => assetToPhoto(asset, duplicateLookup));
  await upsertCache(photos);

  const photoById = new Map(photos.map((photo) => [photo.id, photo]));
  return selectedAssets
    .map(([a, b]) => [photoById.get(a.id), photoById.get(b.id)] as const)
    .filter((pair): pair is [NativePhoto, NativePhoto] => Boolean(pair[0] && pair[1]))
    .filter(([a, b]) =>
      shouldUseRelatedPairPhoto(a, settings, avoidIds) && shouldUseRelatedPairPhoto(b, settings, avoidIds),
    );
}

/**
 * Builds real similarity clusters instead of flattening every candidate into a
 * single delete list. Vision runs entirely on-device; the conservative legacy
 * time/dimension grouping remains available for Expo Go and unsupported builds.
 */
export async function loadDuplicatePhotoGroups(
  groupCount: number,
  settings: NativeSettings,
  options: { avoidIds?: string[] } = {},
): Promise<NativeDuplicateGroup[]> {
  const avoidIds = new Set(options.avoidIds ?? []);
  const requestedGroups = Math.max(1, groupCount);
  const page = await MediaLibrary.getAssetsAsync({
    first: 120,
    mediaType: "photo",
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
  });
  const assets = page.assets.filter(
    (asset) => !avoidIds.has(asset.id) && !assetHasGeneratedTrimFilename(asset),
  );
  if (assets.length < 2) return [];

  const verified = await findVerifiedSimilarAssetGroups(assets);
  const analysisById = verified.analysisById;
  const usedVision = verified.method === "vision";
  let groupedAssets = usedVision ? verified.groups : buildConservativeSimilarGroups(assets);
  groupedAssets = groupedAssets
    .sort((a, b) => Math.max(...b.map((asset) => asset.creationTime)) - Math.max(...a.map((asset) => asset.creationTime)))
    .slice(0, requestedGroups);
  if (groupedAssets.length === 0) return [];

  const groupedIds = new Set(groupedAssets.flatMap((group) => group.map((asset) => asset.id)));
  const classificationIds = usedVision ? groupedIds : new Set<string>();
  const photoList = await mapWithConcurrency(
    assets.filter((asset) => groupedIds.has(asset.id)),
    3,
    (asset) => assetToPhoto(asset, classificationIds),
  );
  await upsertCache(photoList);
  const photoById = new Map(photoList.map((photo) => [photo.id, photo]));

  return groupedAssets.flatMap((assetGroup) => {
    const photos = assetGroup
      .map((asset) => photoById.get(asset.id))
      .filter((photo): photo is NativePhoto => Boolean(photo));
    if (photos.length < 2) return [];
    const maxPixels = Math.max(...photos.map((photo) => photo.width * photo.height), 1);
    const scored = photos
      .map((photo) => {
        const analysis = analysisById.get(photo.id);
        const aesthetic = analysis?.aestheticScore == null ? 0.5 : (analysis.aestheticScore + 1) / 2;
        const face = analysis?.bestFaceCaptureQuality ?? 0.5;
        const resolution = (photo.width * photo.height) / maxPixels;
        const utilityPenalty = analysis?.isUtility ? 0.12 : 0;
        return { photo, analysis, score: aesthetic * 0.55 + face * 0.3 + resolution * 0.15 - utilityPenalty };
      })
      .sort((a, b) => b.score - a.score);
    const keeper = scored[0];
    const runnerUp = scored[1];
    const reasons: string[] = [];
    const highestAesthetic = Math.max(...scored.map((item) => item.analysis?.aestheticScore ?? -2));
    const highestFace = Math.max(...scored.map((item) => item.analysis?.bestFaceCaptureQuality ?? -1));
    if (keeper.analysis?.aestheticScore != null && keeper.analysis.aestheticScore >= highestAesthetic) {
      reasons.push("Best overall image quality");
    }
    if (keeper.analysis?.bestFaceCaptureQuality != null && keeper.analysis.bestFaceCaptureQuality >= highestFace) {
      reasons.push("Best face quality");
    }
    if (keeper.photo.width * keeper.photo.height >= maxPixels) reasons.push("Highest available resolution");
    const confidence = Math.max(0.58, Math.min(0.94, 0.68 + (keeper.score - (runnerUp?.score ?? 0)) * 0.75));
    const decorated = scored.map(({ photo }) =>
      photo.id === keeper.photo.id
        ? { ...photo, suggestionReasons: reasons.slice(0, 2), suggestionConfidence: confidence }
        : photo,
    );
    return [{
      id: assetGroup.map((asset) => asset.id).sort().join(":"),
      photos: decorated,
      suggestedKeeperId: keeper.photo.id,
      similarityLabel: usedVision
        ? "Compared privately with Apple Vision on this iPhone"
        : "Short capture sequence to compare manually",
    }];
  });
}

function photoAccessLevel(permission: MediaLibrary.PermissionResponse): NativePhotoPermission["accessLevel"] {
  if (permission.status !== "granted") return "none";
  if (permission.accessPrivileges === "all") return "all";
  if (permission.accessPrivileges === "limited") return "selected";
  return permission.granted ? "limited" : "none";
}

function normalizePhotoPermission(permission: MediaLibrary.PermissionResponse): NativePhotoPermission {
  return {
    granted: permission.status === "granted",
    limited: permission.accessPrivileges === "limited",
    canAskAgain: permission.canAskAgain,
    accessLevel: photoAccessLevel(permission),
  };
}

export async function getPhotoPermissionStatus(): Promise<NativePhotoPermission> {
  return normalizePhotoPermission(await MediaLibrary.getPermissionsAsync());
}

export async function requestPhotoPermission(): Promise<NativePhotoPermission> {
  return normalizePhotoPermission(await MediaLibrary.requestPermissionsAsync());
}

export async function loadPhotoRound(
  count: number,
  settings: NativeSettings,
  options: NativePhotoRoundOptions = {},
): Promise<NativePhoto[]> {
  const cache = await readCache();
  const avoidIds = new Set(options.avoidIds ?? []);
  const excludeMaxTrimmed = options.excludeMaxTrimmed !== false;
  const includeTrimmed = options.includeTrimmed === true || settings.includePreviouslyReviewed;
  const requiresVisualSimilarity =
    settings.targetMode === "duplicates" || settings.targetMode === "similar";
  const cachedTargeted = shuffle(
    (requiresVisualSimilarity ? [] : cache.photos).filter(
      (photo) =>
        matchesPhotoSettings(photo, settings) &&
        shouldUseRoundPhoto(photo, settings, avoidIds, excludeMaxTrimmed, includeTrimmed),
    ),
  )
    .sort((a, b) => scorePhoto(b, settings) - scorePhoto(a, settings))
    .slice(0, count);

  if (settings.targetMode !== "balanced" && cachedTargeted.length >= count) {
    return cachedTargeted;
  }

  const assets = await fetchCandidateAssets(count, settings);
  const duplicateLookup = requiresVisualSimilarity
    ? await buildVisionVerifiedDuplicateLookup(assets)
    : new Set<string>();
  const cachedIds = new Set(cachedTargeted.map((photo) => photo.id));
  const selectedCount =
    settings.targetMode === "balanced" ? count : count - cachedTargeted.length;
  const selected = chooseAssets(
    assets.filter((asset) => !cachedIds.has(asset.id) && !avoidIds.has(asset.id)),
    selectedCount,
    settings,
    duplicateLookup,
  );
  const fresh = (await mapWithConcurrency(selected, 3, (asset) => assetToPhoto(asset, duplicateLookup))).filter(
    (photo) =>
      matchesPhotoSettings(photo, settings) &&
      shouldUseRoundPhoto(photo, settings, avoidIds, excludeMaxTrimmed, includeTrimmed),
  );
  await upsertCache(fresh);

  const combined = settings.targetMode === "balanced" ? [...fresh, ...cachedTargeted] : [...cachedTargeted, ...fresh];
  const matchedCount = combined.filter((photo) => matchesPhotoSettings(photo, settings)).length;
  const reportedFallback = settings.targetMode !== "balanced" && matchedCount < count;
  if (reportedFallback) {
    options.onFallback?.(fallbackDetail(settings, matchedCount, count));
  }
  if (combined.length >= count) return combined.slice(0, count);

  if (settings.targetMode !== "balanced" && combined.length < count) {
    const deepAssets = await fetchAllPhotoAssets();
    const deepDuplicateLookup = requiresVisualSimilarity
      ? await buildVisionVerifiedDuplicateLookup(deepAssets)
      : new Set<string>();
    const usedIds = new Set(combined.map((photo) => photo.id));
    const deepSelected = chooseAssets(
      deepAssets.filter((asset) => !usedIds.has(asset.id) && !avoidIds.has(asset.id)),
      count - combined.length,
      settings,
      deepDuplicateLookup,
    );
    const deepFresh = (await mapWithConcurrency(deepSelected, 3, (asset) => assetToPhoto(asset, deepDuplicateLookup))).filter(
      (photo) =>
        matchesPhotoSettings(photo, settings) &&
        shouldUseRoundPhoto(photo, settings, avoidIds, excludeMaxTrimmed, includeTrimmed),
    );
    await upsertCache(deepFresh);
    const deepCombined = [...combined, ...deepFresh].slice(0, count);
    if (deepCombined.length >= count) return deepCombined;
    if (deepCombined.length > combined.length) return deepCombined;
  }

  // For strict modes (anything other than "balanced") we deliberately stop here
  // and return only matching photos. Returning a short round of correctly-
  // filtered photos is better than padding with off-target ones (e.g. tiny
  // photos in "big-only" mode).
  if (settings.targetMode !== "balanced") {
    return combined;
  }

  const usedIds = new Set(combined.map((photo) => photo.id));
  const fallback = shuffle(
    cache.photos.filter(
      (photo) =>
        !usedIds.has(photo.id) &&
        shouldUseRoundPhoto(photo, settings, avoidIds, excludeMaxTrimmed, includeTrimmed),
    ),
  ).slice(0, count - combined.length);
  const next = [...combined, ...fallback].slice(0, count);
  if (next.length >= count) return next;

  const nextIds = new Set(next.map((photo) => photo.id));
  const broadAssets = chooseAssets(
    assets.filter((asset) => !nextIds.has(asset.id) && !avoidIds.has(asset.id)),
    count - next.length,
    { ...settings, targetMode: "balanced" },
    duplicateLookup,
  );
  const broadFresh = (await mapWithConcurrency(broadAssets, 3, (asset) => assetToPhoto(asset, duplicateLookup))).filter(
    (photo) =>
      matchesPhotoSettings(photo, settings) &&
      shouldUseRoundPhoto(photo, settings, avoidIds, excludeMaxTrimmed, includeTrimmed),
  );
  await upsertCache(broadFresh);
  const toppedUp = [...next, ...broadFresh].slice(0, count);
  if (toppedUp.length >= count) return toppedUp;

  const toppedUpIds = new Set(toppedUp.map((item) => item.id));
  const relaxedCache = shuffle(
    cache.photos.filter(
      (photo) =>
        !toppedUpIds.has(photo.id) &&
        shouldUseRoundPhoto(photo, settings, avoidIds, excludeMaxTrimmed, includeTrimmed),
    ),
  );
  if (relaxedCache.length > 0) return [...toppedUp, ...relaxedCache].slice(0, count);

  const relaxedAssets = chooseAssets(
    assets.filter((asset) => !toppedUpIds.has(asset.id) && !avoidIds.has(asset.id)),
    count - toppedUp.length,
    { ...settings, targetMode: "balanced" },
    duplicateLookup,
  );
  const relaxedFresh = (await mapWithConcurrency(relaxedAssets, 3, (asset) => assetToPhoto(asset, duplicateLookup))).filter(
    (photo) =>
      matchesPhotoSettings(photo, settings) &&
      shouldUseRoundPhoto(photo, settings, avoidIds, excludeMaxTrimmed, includeTrimmed),
  );
  await upsertCache(relaxedFresh);
  return [...toppedUp, ...relaxedFresh].slice(0, count);
}

export async function deletePhotos(ids: string[]): Promise<{ deleted: number }> {
  if (ids.length === 0) return { deleted: 0 };

  try {
    await MediaLibrary.deleteAssetsAsync(ids);
    await removeCacheIds(ids);
    await removeTrimTagIds(ids);
    return { deleted: ids.length };
  } catch (error) {
    console.log("[NativePhotoSource] Delete failed", { error });
    return { deleted: 0 };
  }
}

export async function trimPhoto(
  photo: NativePhoto,
  quality: number,
  replaceOriginal = true,
  trimKinds: NativeTrimKind[] = DEFAULT_TRIM_KINDS,
  options: { allowSecondPass?: boolean } = {},
): Promise<{ trimmed: boolean; newAssetId?: string; savedMB?: number; error?: string }> {
  const created = await createTrimmedAsset(photo, quality, trimKinds, options);
  if (!created.success) return { trimmed: false, error: created.error };
  if (!replaceOriginal) {
    return { trimmed: true, newAssetId: created.newAssetId, savedMB: created.savedMB };
  }
  try {
    await MediaLibrary.deleteAssetsAsync([photo.id]);
    await removeCacheIds([photo.id]);
    await removeTrimTagIds([photo.id]);
    return { trimmed: true, newAssetId: created.newAssetId, savedMB: created.savedMB };
  } catch (error) {
    await cleanupCreatedTrimAssets([created]);
    const message = error instanceof Error ? error.message : String(error);
    return { trimmed: false, error: message };
  }
}

type CreatedTrim =
  | { success: true; originalId: string; newAssetId: string; savedMB: number; appliedTrimKinds: NativeTrimKind[] }
  | { success: false; originalId: string; error: string };

export type PreparedTrim =
  | {
      success: true;
      originalId: string;
      tempUri: string;
      creationTime: number;
      savedMB: number;
      appliedTrimKinds: NativeTrimKind[];
    }
  | { success: false; originalId: string; error: string };

export async function cleanupPreparedTrims(prepared: PreparedTrim[]): Promise<void> {
  await Promise.all(
    prepared
      .filter((item): item is Extract<PreparedTrim, { success: true }> => item.success)
      .map((item) => FileSystem.deleteAsync(item.tempUri, { idempotent: true }).catch(() => undefined)),
  );
}

export async function prepareTrimPhoto(
  photo: NativePhoto,
  quality: number,
  trimKinds: NativeTrimKind[] = DEFAULT_TRIM_KINDS,
  options: { allowSecondPass?: boolean } = {},
): Promise<PreparedTrim> {
  const sourceUri = photo.localUri || photo.uri;
  if (!sourceUri || sourceUri.startsWith("ph://")) {
    return { success: false, originalId: photo.id, error: "Photo is not downloaded locally" };
  }
  const status = getTrimStatus(photo, trimKinds, quality, options);
  if (!status.canTrim) {
    return { success: false, originalId: photo.id, error: "Photo already has all selected trims" };
  }
  const isSecondPass = options.allowSecondPass === true && photo.trimState;
  const effectiveQuality = isSecondPass
    ? Math.min(quality, RESIZE_SCALE)
    : status.nextKinds.includes("compression")
      ? quality
      : Math.max(quality, 0.94);
  try {
    const imageManipulator = await import("expo-image-manipulator");
    // Try the requested quality first. iPhone JPEGs are often already encoded
    // around q=0.85, so re-encoding at q≥0.85 can produce a *bigger* file.
    // If that happens, retry at progressively lower qualities until we
    // actually save bytes instead of reporting a selected trim as skipped.
    const qualityLadder = [effectiveQuality, 0.82, 0.7, 0.55, 0.4].filter(
      (q, i, arr) => i === 0 || q < arr[i - 1] - 0.01,
    );
    const actions = status.nextKinds.includes("resize") && photo.width > 0
      ? [{ resize: { width: Math.max(1, Math.round(photo.width * RESIZE_SCALE)) } }]
      : [];
    const formats = status.nextKinds.includes("format") || isHeicPhotoName(photo.title)
      ? [imageManipulator.SaveFormat.JPEG, imageManipulator.SaveFormat.PNG]
      : [imageManipulator.SaveFormat.JPEG];
    const originalBytes = Math.max(0, photo.sizeMB * 1024 * 1024);
    let lastUri: string | null = null;
    let bestUri: string | null = null;
    let bestBytes = Number.POSITIVE_INFINITY;
    for (const format of formats) {
      for (const q of qualityLadder) {
        const result = await imageManipulator.manipulateAsync(sourceUri, actions, {
          compress: q,
          format,
        });
        lastUri = result.uri;
        const info = await FileSystem.getInfoAsync(result.uri);
        const bytes = (info as FileSystem.FileInfo & { size?: number }).size ?? 0;
        if (info.exists && bytes > 0 && bytes < bestBytes) {
          if (bestUri && bestUri !== result.uri) {
            await FileSystem.deleteAsync(bestUri, { idempotent: true }).catch(() => undefined);
          }
          bestUri = result.uri;
          bestBytes = bytes;
          if (originalBytes > 0 && bytes < originalBytes) break;
        } else if (result.uri !== bestUri) {
          await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
        }
      }
      if (originalBytes > 0 && bestBytes < originalBytes) break;
    }
    const trimmedBytes = bestBytes === Number.POSITIVE_INFINITY ? 0 : bestBytes;
    const finalUri = bestUri ?? lastUri;
    if (!finalUri || trimmedBytes <= 0 || (originalBytes > 0 && trimmedBytes >= originalBytes)) {
      if (finalUri) await FileSystem.deleteAsync(finalUri, { idempotent: true }).catch(() => undefined);
      await setTrimTag(photo.id, {
        applied: status.applied,
        updatedAt: new Date().toISOString(),
        blockedReason: "already-optimized",
      });
      return {
        success: false,
        originalId: photo.id,
        error: "Already optimized: this photo would not get smaller with the current Trim settings",
      };
    }
    const appliedTrimKinds = [
      ...new Set([
        ...status.applied,
        ...status.nextKinds,
        ...(isHeicPhotoName(photo.title) ? (["format"] as NativeTrimKind[]) : []),
      ]),
    ];
    return {
      success: true,
      originalId: photo.id,
      tempUri: finalUri,
      creationTime: photo.creationTime,
      savedMB: +((originalBytes - trimmedBytes) / (1024 * 1024)).toFixed(2),
      appliedTrimKinds,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, originalId: photo.id, error: message };
  }
}

async function createTrimmedAssetFromPrepared(prepared: PreparedTrim): Promise<CreatedTrim> {
  if (!prepared.success) return prepared;
  try {
    const datedAssetId = await createDatedPhotoAsset(prepared.tempUri, prepared.creationTime);
    const created = datedAssetId
      ? { id: datedAssetId }
      : await MediaLibrary.createAssetAsync(prepared.tempUri);
    await FileSystem.deleteAsync(prepared.tempUri, { idempotent: true }).catch(() => undefined);
    await setTrimTag(created.id, {
      applied: prepared.appliedTrimKinds,
      updatedAt: new Date().toISOString(),
    });
    return {
      success: true,
      originalId: prepared.originalId,
      newAssetId: created.id,
      savedMB: prepared.savedMB,
      appliedTrimKinds: prepared.appliedTrimKinds,
    };
  } catch (error) {
    await FileSystem.deleteAsync(prepared.tempUri, { idempotent: true }).catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, originalId: prepared.originalId, error: message };
  }
}

async function createTrimmedAsset(
  photo: NativePhoto,
  quality: number,
  trimKinds: NativeTrimKind[] = DEFAULT_TRIM_KINDS,
  options: { allowSecondPass?: boolean } = {},
  prepared?: PreparedTrim,
): Promise<CreatedTrim> {
  return createTrimmedAssetFromPrepared(
    prepared ?? (await prepareTrimPhoto(photo, quality, trimKinds, options)),
  );
}

/**
 * Batch-trim multiple photos with a SINGLE iOS delete confirmation prompt.
 * Phase 1: create new (trimmed) assets for every photo. Phase 2: one
 * MediaLibrary.deleteAssetsAsync() call to remove all originals at once.
 */
export async function commitTrims(
  photos: NativePhoto[],
  quality: number,
  replaceOriginal = true,
  trimKinds: NativeTrimKind[] = DEFAULT_TRIM_KINDS,
  options: { allowSecondPass?: boolean; prepared?: PreparedTrim[] } = {},
): Promise<Array<{ id: string; trimmed: boolean; newAssetId?: string; savedMB?: number; error?: string }>> {
  if (photos.length === 0) return [];
  const results: CreatedTrim[] = [];
  const preparedById = new Map((options.prepared ?? []).map((item) => [item.originalId, item]));
  for (const p of photos) {
    // Sequential to avoid hitting expo-image-manipulator concurrency limits.
    results.push(await createTrimmedAsset(p, quality, trimKinds, options, preparedById.get(p.id)));
  }
  const created = results.filter((r): r is Extract<CreatedTrim, { success: true }> => r.success);
  if (replaceOriginal && created.length > 0) {
    try {
      await MediaLibrary.deleteAssetsAsync(created.map((c) => c.originalId));
      await removeCacheIds(created.map((c) => c.originalId));
      await removeTrimTagIds(created.map((c) => c.originalId));
    } catch (error) {
      await cleanupCreatedTrimAssets(created);
      const message = error instanceof Error ? error.message : String(error);
      return results.map((r) => ({
        id: r.originalId,
        trimmed: false,
        error: r.success ? message : r.error,
      }));
    }
  }
  return results.map((r) =>
    r.success
      ? { id: r.originalId, trimmed: true, newAssetId: r.newAssetId, savedMB: r.savedMB }
      : { id: r.originalId, trimmed: false, error: r.error },
  );
}

export async function commitTrimsAndDeletes(
  deletes: NativePhoto[],
  trims: NativePhoto[],
  quality: number,
  replaceTrimOriginals = true,
  trimKinds: NativeTrimKind[] = DEFAULT_TRIM_KINDS,
  options: { allowSecondPass?: boolean; prepared?: PreparedTrim[] } = {},
): Promise<{
  deletedCount: number;
  deletedPhotos: NativePhoto[];
  trimResults: Array<{ id: string; trimmed: boolean; newAssetId?: string; savedMB?: number; error?: string }>;
}> {
  const deleteIds = new Set(deletes.map((photo) => photo.id));
  const trimCandidates = trims.filter((photo) => !deleteIds.has(photo.id));
  const trimCreates: CreatedTrim[] = [];
  const preparedById = new Map((options.prepared ?? []).map((item) => [item.originalId, item]));

  for (const photo of trimCandidates) {
    // Sequential to avoid hitting expo-image-manipulator concurrency limits.
    trimCreates.push(await createTrimmedAsset(photo, quality, trimKinds, options, preparedById.get(photo.id)));
  }

  const createdTrims = trimCreates.filter(
    (result): result is Extract<CreatedTrim, { success: true }> => result.success,
  );
  const idsToDelete = [
    ...deleteIds,
    ...(replaceTrimOriginals ? createdTrims.map((result) => result.originalId) : []),
  ];

  if (idsToDelete.length === 0) {
    if (!replaceTrimOriginals && createdTrims.length > 0) {
      return {
        deletedCount: 0,
        deletedPhotos: [],
        trimResults: trimCreates.map((result) =>
          result.success
            ? { id: result.originalId, trimmed: true, newAssetId: result.newAssetId, savedMB: result.savedMB }
            : { id: result.originalId, trimmed: false, error: result.error },
        ),
      };
    }
    return {
      deletedCount: 0,
      deletedPhotos: [],
      trimResults: trimCreates.map((result) => ({
        id: result.originalId,
        trimmed: false,
        error: result.success ? "Trim was not applied" : result.error,
      })),
    };
  }

  try {
    await MediaLibrary.deleteAssetsAsync(idsToDelete);
    await removeCacheIds(idsToDelete);
    await removeTrimTagIds(idsToDelete);
  } catch (error) {
    if (replaceTrimOriginals) {
      await cleanupCreatedTrimAssets(createdTrims);
    }
    const message = error instanceof Error ? error.message : String(error);
    return {
      deletedCount: 0,
      deletedPhotos: [],
      trimResults: trimCreates.map((result) => ({
        id: result.originalId,
        trimmed: false,
        error: result.success ? message : result.error,
      })),
    };
  }

  return {
    deletedCount: deletes.length,
    deletedPhotos: deletes,
    trimResults: trimCreates.map((result) =>
      result.success
        ? { id: result.originalId, trimmed: true, newAssetId: result.newAssetId, savedMB: result.savedMB }
        : { id: result.originalId, trimmed: false, error: result.error },
    ),
  };
}

export function estimateTrimSavings(
  photo: Pick<NativePhoto, "sizeMB" | "hasGPS"> &
    Partial<Pick<NativePhoto, "isCloudAsset" | "trimState" | "width" | "height" | "title">>,
  trimKinds: NativeTrimKind[] = DEFAULT_TRIM_KINDS,
  options: { allowSecondPass?: boolean; quality?: number } = {},
): number {
  const status = getTrimStatus(
    {
      ...photo,
      isCloudAsset: photo.isCloudAsset ?? false,
      trimState: photo.trimState,
    },
    trimKinds,
    options.quality,
    { allowSecondPass: options.allowSecondPass },
  );
  if (!status.canTrim) return 0;
  return +status.nextKinds
    .reduce((sum, kind) => sum + estimateTrimKindSavings(photo, kind, options.quality), 0)
    .toFixed(2);
}

export function estimateTrimmedSizeMB(
  photo: Pick<NativePhoto, "sizeMB" | "hasGPS"> &
    Partial<Pick<NativePhoto, "isCloudAsset" | "trimState" | "width" | "height" | "title">>,
  trimKinds: NativeTrimKind[] = DEFAULT_TRIM_KINDS,
  options: { allowSecondPass?: boolean; quality?: number } = {},
): number {
  return +Math.max(0, photo.sizeMB - estimateTrimSavings(photo, trimKinds, options)).toFixed(2);
}
