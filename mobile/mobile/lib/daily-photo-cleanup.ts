import { estimateTrimSavings, getTrimStatus, loadTodayPhotoSet, type NativePhoto } from "./native-photo-source";
import type { NativeSettings } from "./native-store";
import {
  buildDailyCleanupPlan,
  type DailyCleanupPlan,
  type DailyTrimEvaluator,
} from "./daily-cleanup-policy";

export { buildDailyCleanupPlan } from "./daily-cleanup-policy";
export { selectSuggestedTrimIds } from "./daily-cleanup-policy";
export type { DailyCleanupAction, DailyCleanupItem, DailyCleanupPlan, DailyTrimEvaluator } from "./daily-cleanup-policy";

const evaluateTrim: DailyTrimEvaluator = (photo: NativePhoto, settings: NativeSettings) => {
  const options = { allowSecondPass: settings.trimReviewMode === "trimmed-only", quality: settings.trimQuality };
  const status = getTrimStatus(photo, settings.trimKinds, settings.trimQuality, options);
  const savings = status.canTrim ? estimateTrimSavings(photo, settings.trimKinds, options) : 0;
  return { canTrim: status.canTrim && savings > 0 && !photo.trimState?.blockedReason, trimSavingsMB: savings };
};

export async function loadDailyCleanupPlan(settings: NativeSettings, now = new Date()): Promise<DailyCleanupPlan> {
  return buildDailyCleanupPlan(await loadTodayPhotoSet(now), settings, evaluateTrim, now);
}
