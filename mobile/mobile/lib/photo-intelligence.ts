import { requireOptionalNativeModule } from "expo-modules-core";

export type PhotoIntelligenceCapabilities = {
  featurePrint: boolean;
  faceCaptureQuality: boolean;
  imageAesthetics: boolean;
  maximumAssetsPerBatch: number;
};

export type PhotoIntelligenceAsset = {
  assetId: string;
  isScreenshot: boolean;
  isUtility: boolean;
  analysisAvailable: boolean;
  unavailableReason?: string;
  bestFaceCaptureQuality?: number;
  aestheticScore?: number;
};

export type SimilarPhotoPair = {
  firstAssetId: string;
  secondAssetId: string;
  /** Lower is more visually similar. Compare only results from the same request revision. */
  distance: number;
};

export type SimilarPhotoAnalysis = {
  items: PhotoIntelligenceAsset[];
  pairs: SimilarPhotoPair[];
  limited: boolean;
  processedCount: number;
};

type NativePhotoIntelligenceModule = {
  getCapabilities(): PhotoIntelligenceCapabilities;
  analyzeAssets(assetIds: string[]): Promise<PhotoIntelligenceAsset[]>;
  findSimilarAssets(assetIds: string[], threshold: number): Promise<SimilarPhotoAnalysis>;
  createPhotoAsset(fileUri: string, creationTime: number): Promise<string>;
};

const nativeModule = requireOptionalNativeModule<NativePhotoIntelligenceModule>("ExpoPhotoIntelligence");

/**
 * The native module is absent in Expo Go and web builds. Callers can retain their
 * existing PhotoKit/heuristic flow when this returns false.
 */
export function isPhotoIntelligenceAvailable(): boolean {
  return nativeModule != null;
}

export function photoIntelligenceCapabilities(): PhotoIntelligenceCapabilities | null {
  return nativeModule?.getCapabilities() ?? null;
}

export async function analyzePhotosOnDevice(assetIds: string[]): Promise<PhotoIntelligenceAsset[]> {
  return nativeModule?.analyzeAssets(assetIds) ?? [];
}

export async function findSimilarPhotosOnDevice(
  assetIds: string[],
  threshold = 12,
): Promise<SimilarPhotoAnalysis> {
  return nativeModule?.findSimilarAssets(assetIds, threshold) ?? {
    items: [],
    pairs: [],
    limited: false,
    processedCount: 0,
  };
}

/** Saves an image through PhotoKit so its replacement keeps the original capture date. */
export async function createDatedPhotoAsset(fileUri: string, creationTime: number): Promise<string | null> {
  if (!nativeModule) return null;
  return nativeModule.createPhotoAsset(fileUri, creationTime);
}
