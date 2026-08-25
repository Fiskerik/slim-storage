import { Platform } from "react-native";
import { META_IOS_MREC_PLACEMENT_ID } from "./meta-mrec-config";

export type PreparedSwipeMidsetMrecAd = {
  placementId: string;
};

/**
 * The Meta MREC view loads itself after mounting. Preparing it separately keeps
 * LevelPlay initialization out of the swipe-card path.
 */
export function prepareSwipeMidsetMrecAd(): PreparedSwipeMidsetMrecAd | null {
  if (Platform.OS !== "ios") return null;
  if (!META_IOS_MREC_PLACEMENT_ID) {
    console.log("[ads] Meta iOS MREC placement is missing or invalid");
    return null;
  }
  return { placementId: META_IOS_MREC_PLACEMENT_ID };
}
