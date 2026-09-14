export type SwipeAction = "keep" | "trim" | "delete";

export const SWIPE_THRESHOLD = 110;

export function resolveSwipeAction(translationX: number, translationY: number): SwipeAction | null {
  if (translationY < -SWIPE_THRESHOLD && Math.abs(translationY) > Math.abs(translationX)) return "trim";
  if (translationX > SWIPE_THRESHOLD) return "delete";
  if (translationX < -SWIPE_THRESHOLD) return "keep";
  return null;
}

export function actionCode(action: SwipeAction): number {
  if (action === "keep") return 1;
  if (action === "trim") return 2;
  return 3;
}

export function exitDuration(action: SwipeAction, reducedMotion: boolean): number {
  if (reducedMotion) return 140;
  if (action === "delete") return 480;
  if (action === "trim") return 280;
  return 220;
}
