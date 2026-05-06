import * as MediaLibrary from "expo-media-library";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { handlePurchaseMessage } from "./purchases";

type BridgeRequest = {
  id: string;
  method: string;
  data: Record<string, unknown>;
};

type BridgeResponse = {
  __bridge_response: true;
  id: string;
  result?: unknown;
  error?: string;
};

function numberFromData(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringArrayFromData(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function handleBridgeMessage(request: BridgeRequest): Promise<BridgeResponse> {
  const { id, method, data } = request;

  try {
    let result: unknown;

    switch (method) {
      case "requestPermission":
        result = await requestPermission();
        break;
      case "getPhotos":
        result = await getPhotos(numberFromData(data.count, 10));
        break;
      case "getOlderPhotos":
        result = await getOlderPhotos(
          numberFromData(data.beforeYear, 2020),
          numberFromData(data.count, 10),
        );
        break;
      case "getBurstGroups":
        result = await getBurstGroups(numberFromData(data.maxGroups, 5));
        break;
      case "deletePhotos":
        result = await deletePhotos(stringArrayFromData(data.ids));
        break;
      case "hapticTap":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        result = { ok: true };
        break;
      case "hapticSuccess":
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        result = { ok: true };
        break;
      case "hapticError":
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        result = { ok: true };
        break;
      default:
        // Check if it's a purchase-related method
        if (method.startsWith("purchases_")) {
          result = await handlePurchaseMessage(method, data);
          break;
        }
        return { __bridge_response: true, id, error: `Unknown method: ${method}` };
    }

    return { __bridge_response: true, id, result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { __bridge_response: true, id, error: message };
  }
}

// ─── Permission ──────────────────────────────────

async function requestPermission(): Promise<{
  granted: boolean;
  limited: boolean;
  canAskAgain: boolean;
}> {
  const { status, accessPrivileges, canAskAgain } = await MediaLibrary.requestPermissionsAsync();
  const limited = accessPrivileges === "limited";
  return { granted: status === "granted", limited, canAskAgain };
}

// ─── Photo fetching ──────────────────────────────

type PhotoDTO = {
  id: string;
  uri: string; // base64 data URI for small thumb, or file:// URI
  thumbUri: string;
  title: string;
  year: number;
  month: string;
  device: string;
  sizeMB: number;
  hasGPS: boolean;
  isNative: true;
  nativeId: string;
  isCloudAsset: boolean;
  creationTime: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function mimeTypeForAsset(asset: MediaLibrary.Asset): string {
  const name = asset.filename?.toLowerCase() || asset.uri.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".heic") || name.endsWith(".heif")) return "image/heic";
  if (name.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function readableAssetUri(
  asset: MediaLibrary.Asset,
  localUri?: string | null,
): Promise<string> {
  const sourceUri = localUri || asset.uri;
  if (!sourceUri || sourceUri.startsWith("data:")) return sourceUri;

  try {
    const base64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:${mimeTypeForAsset(asset)};base64,${base64}`;
  } catch (err: unknown) {
    console.log("[Bridge] Could not inline photo for WebView preview", {
      assetId: asset.id,
      uri: sourceUri,
      error: err instanceof Error ? err.message : String(err),
    });
    return sourceUri;
  }
}

async function assetToDTO(asset: MediaLibrary.Asset): Promise<PhotoDTO> {
  // Get asset info for GPS and more metadata
  const info = await MediaLibrary.getAssetInfoAsync(asset);

  const creationDate = new Date(asset.creationTime);
  const fileSize = (asset as MediaLibrary.Asset & { fileSize?: number }).fileSize;
  const sizeMB = fileSize ? +(fileSize / (1024 * 1024)).toFixed(2) : 0;

  // Detect if asset might be iCloud-only (not locally available)
  // If the local URI is missing or the file size is 0, it's likely cloud-only
  const localUri = info.localUri || asset.uri;
  const isCloudAsset = !localUri || sizeMB === 0;
  const previewUri = await readableAssetUri(asset, localUri);

  return {
    id: asset.id,
    uri: previewUri,
    thumbUri: previewUri,
    title: asset.filename || "Photo",
    year: creationDate.getFullYear(),
    month: MONTHS[creationDate.getMonth()],
    device:
      typeof (info.exif as Record<string, unknown> | undefined)?.Model === "string"
        ? ((info.exif as Record<string, unknown>).Model as string)
        : "iPhone",
    sizeMB,
    hasGPS: !!(info.location?.latitude && info.location?.longitude),
    isNative: true,
    nativeId: asset.id,
    isCloudAsset,
    creationTime: asset.creationTime,
  };
}

async function getPhotos(count: number): Promise<PhotoDTO[]> {
  const totalAssets = await MediaLibrary.getAssetsAsync({
    mediaType: "photo",
    first: 1,
  });

  const total = totalAssets.totalCount;
  if (total === 0) return [];

  // Pick random offsets to get a varied selection
  const indices = new Set<number>();
  const maxAttempts = count * 3;
  for (let i = 0; i < maxAttempts && indices.size < Math.min(count, total); i++) {
    indices.add(Math.floor(Math.random() * total));
  }

  const photos: PhotoDTO[] = [];
  for (const offset of indices) {
    try {
      const page = await MediaLibrary.getAssetsAsync({
        mediaType: "photo",
        first: 1,
        offset,
        sortBy: [MediaLibrary.SortBy.creationTime],
      } as MediaLibrary.AssetsOptions & { offset: number });
      if (page.assets.length > 0) {
        const dto = await assetToDTO(page.assets[0]);
        photos.push(dto);
      }
    } catch {
      // Skip failed assets
    }
  }

  return photos;
}

async function getOlderPhotos(beforeYear: number, count: number): Promise<PhotoDTO[]> {
  const cutoffDate = new Date(beforeYear, 0, 1).getTime();

  const result = await MediaLibrary.getAssetsAsync({
    mediaType: "photo",
    first: count * 2, // fetch extra to have variety
    createdBefore: cutoffDate,
    sortBy: [[MediaLibrary.SortBy.creationTime, false]], // oldest first
  });

  // Shuffle and take count
  const shuffled = result.assets.sort(() => Math.random() - 0.5).slice(0, count);
  return Promise.all(shuffled.map(assetToDTO));
}

async function getBurstGroups(maxGroups: number): Promise<PhotoDTO[][]> {
  // Fetch recent photos and group by timestamp proximity (within 3 seconds)
  const result = await MediaLibrary.getAssetsAsync({
    mediaType: "photo",
    first: 200,
    sortBy: [MediaLibrary.SortBy.creationTime],
  });

  const assets = result.assets;
  const groups: MediaLibrary.Asset[][] = [];
  let currentGroup: MediaLibrary.Asset[] = [];

  for (let i = 0; i < assets.length; i++) {
    if (currentGroup.length === 0) {
      currentGroup.push(assets[i]);
    } else {
      const timeDiff = Math.abs(
        assets[i].creationTime - currentGroup[currentGroup.length - 1].creationTime,
      );
      if (timeDiff < 3000) {
        // within 3 seconds
        currentGroup.push(assets[i]);
      } else {
        if (currentGroup.length >= 2) {
          groups.push(currentGroup);
        }
        currentGroup = [assets[i]];
      }
    }
  }
  if (currentGroup.length >= 2) {
    groups.push(currentGroup);
  }

  // Take top N groups, sorted by group size descending
  const topGroups = groups.sort((a, b) => b.length - a.length).slice(0, maxGroups);

  return Promise.all(topGroups.map((group) => Promise.all(group.map(assetToDTO))));
}

async function deletePhotos(ids: string[]): Promise<{ deleted: number }> {
  if (ids.length === 0) return { deleted: 0 };

  try {
    const success = await MediaLibrary.deleteAssetsAsync(ids);
    return { deleted: success ? ids.length : 0 };
  } catch {
    return { deleted: 0 };
  }
}
