import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import { handlePurchaseMessage } from './purchases';

type BridgeRequest = {
  id: string;
  method: string;
  data: Record<string, any>;
};

type BridgeResponse = {
  __bridge_response: true;
  id: string;
  result?: any;
  error?: string;
};

export async function handleBridgeMessage(request: BridgeRequest): Promise<BridgeResponse> {
  const { id, method, data } = request;

  try {
    let result: any;

    switch (method) {
      case 'requestPermission':
        result = await requestPermission();
        break;
      case 'getPhotos':
        result = await getPhotos(data.count || 10);
        break;
      case 'getOlderPhotos':
        result = await getOlderPhotos(data.beforeYear || 2020, data.count || 10);
        break;
      case 'getBurstGroups':
        result = await getBurstGroups(data.maxGroups || 5);
        break;
      case 'deletePhotos':
        result = await deletePhotos(data.ids || []);
        break;
      case 'hapticTap':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        result = { ok: true };
        break;
      case 'hapticSuccess':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        result = { ok: true };
        break;
      case 'hapticError':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        result = { ok: true };
        break;
      default:
        // Check if it's a purchase-related method
        if (method.startsWith('purchases_')) {
          result = await handlePurchaseMessage(method, data);
          break;
        }
        return { __bridge_response: true, id, error: `Unknown method: ${method}` };
    }

    return { __bridge_response: true, id, result };
  } catch (err: any) {
    return { __bridge_response: true, id, error: err?.message || 'Unknown error' };
  }
}

// ─── Permission ──────────────────────────────────

async function requestPermission(): Promise<{ granted: boolean }> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return { granted: status === 'granted' };
}

// ─── Photo fetching ──────────────────────────────

type PhotoDTO = {
  id: string;
  uri: string;        // base64 data URI for small thumb, or file:// URI
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

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

async function assetToDTO(asset: MediaLibrary.Asset): Promise<PhotoDTO> {
  // Get asset info for GPS and more metadata
  const info = await MediaLibrary.getAssetInfoAsync(asset);

  const creationDate = new Date(asset.creationTime);
  const sizeMB = asset.fileSize ? +(asset.fileSize / (1024 * 1024)).toFixed(2) : 0;

  // Detect if asset might be iCloud-only (not locally available)
  // If the local URI is missing or the file size is 0, it's likely cloud-only
  const localUri = info.localUri || asset.uri;
  const isCloudAsset = !localUri || sizeMB === 0;

  return {
    id: asset.id,
    uri: asset.uri,
    thumbUri: asset.uri, // On iOS, the uri works as a thumbnail too
    title: asset.filename || 'Photo',
    year: creationDate.getFullYear(),
    month: MONTHS[creationDate.getMonth()],
    device: (info.exif as any)?.Model || 'iPhone',
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
    mediaType: 'photo',
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
        mediaType: 'photo',
        first: 1,
        offset,
        sortBy: [MediaLibrary.SortBy.creationTime],
      });
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
    mediaType: 'photo',
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
    mediaType: 'photo',
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
      const timeDiff = Math.abs(assets[i].creationTime - currentGroup[currentGroup.length - 1].creationTime);
      if (timeDiff < 3000) { // within 3 seconds
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
  const topGroups = groups
    .sort((a, b) => b.length - a.length)
    .slice(0, maxGroups);

  return Promise.all(
    topGroups.map(group => Promise.all(group.map(assetToDTO)))
  );
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
