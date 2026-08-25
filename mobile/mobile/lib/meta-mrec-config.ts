const META_PLACEMENT_ID_PATTERN = /^\d+_\d+$/;

/** Meta placement IDs contain the numeric property ID and placement ID. */
export function normalizeMetaMrecPlacementId(value: string | undefined): string | null {
  const placementId = value?.trim();
  if (!placementId || !META_PLACEMENT_ID_PATTERN.test(placementId)) return null;
  return placementId;
}

export const META_IOS_MREC_PLACEMENT_ID = normalizeMetaMrecPlacementId(
  process.env.EXPO_PUBLIC_META_IOS_MREC_PLACEMENT_ID,
);
