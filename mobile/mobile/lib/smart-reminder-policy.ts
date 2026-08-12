import type { NativeEngagementSnapshot, NativeStats, SmartReminderPreferences } from "./native-store";

export type SmartReminderTrigger = "low-storage" | "streak-at-risk" | "new-photos" | "cleanup-opportunity" | "inactivity" | "weekly-progress";

export type SmartReminderCandidate = {
  trigger: SmartReminderTrigger;
  priority: number;
  reason: string;
};

const DAY_MS = 86_400_000;

function dayKey(date: Date): string { return date.toISOString().slice(0, 10); }

function currentStreak(stats: NativeStats, now: Date): number {
  let streak = 0;
  for (let offset = 1; offset <= 365; offset += 1) {
    const date = new Date(now.getTime() - offset * DAY_MS);
    if ((stats.dailyActivity[dayKey(date)]?.reviewed ?? 0) <= 0) break;
    streak += 1;
  }
  return streak;
}

function daysSince(dateValue: string | null | undefined, now: Date): number {
  if (!dateValue) return Infinity;
  const timestamp = Date.parse(dateValue);
  return Number.isFinite(timestamp) ? Math.max(0, (now.getTime() - timestamp) / DAY_MS) : Infinity;
}

export function chooseSmartReminder(
  stats: NativeStats,
  snapshot: NativeEngagementSnapshot,
  preferences: SmartReminderPreferences,
  now = new Date(),
): SmartReminderCandidate | null {
  if (!preferences.enabled || !snapshot.capturedAt || daysSince(snapshot.capturedAt, now) > 3) return null;
  const candidates: SmartReminderCandidate[] = [];
  const freeRatio = snapshot.deviceCapacityMB && snapshot.freeSpaceMB != null
    ? snapshot.freeSpaceMB / snapshot.deviceCapacityMB
    : null;
  const today = stats.dailyActivity[dayKey(now)]?.reviewed ?? 0;
  const streak = currentStreak(stats, now);
  const lastAction = stats.actionLog[0]?.createdAt;
  const daysSinceCleanup = daysSince(lastAction, now);

  if (preferences.storage && freeRatio != null && freeRatio < 0.10) {
    candidates.push({ trigger: "low-storage", priority: freeRatio < 0.05 ? 100 : 90, reason: "Your iPhone is running low on free space." });
  }
  if (preferences.streak && streak >= 2 && today === 0 && now.getHours() >= 18) {
    candidates.push({ trigger: "streak-at-risk", priority: 80, reason: "A quick cleanup can keep your streak going." });
  }
  const hasNewPhotos = snapshot.photoCount >= 25 || snapshot.totalSizeMB >= 250;
  if (preferences.newPhotos && hasNewPhotos && daysSinceCleanup >= 3) {
    candidates.push({ trigger: "new-photos", priority: 70, reason: "Your camera roll has grown since your last cleanup." });
  }
  const cleanupMB = snapshot.trimSavingsMB + snapshot.deleteSavingsMB;
  if (preferences.cleanup && daysSinceCleanup >= 7 && (cleanupMB >= 500 || snapshot.screenshotsCount >= 50 || snapshot.similarCount >= 20)) {
    candidates.push({ trigger: "cleanup-opportunity", priority: 60, reason: "TrimSwipe found a useful cleanup opportunity." });
  }
  if (preferences.cleanup && daysSinceCleanup >= 7 && cleanupMB >= 500) {
    candidates.push({ trigger: "inactivity", priority: 50, reason: "Your photo library may be ready for a quick refresh." });
  }
  if (preferences.weekly && now.getDay() === 0 && now.getHours() >= 18 && today === 0 && stats.reviewed > 0) {
    candidates.push({ trigger: "weekly-progress", priority: 40, reason: "A short session can help you make progress this week." });
  }
  return candidates.sort((a, b) => b.priority - a.priority)[0] ?? null;
}

export function withinSmartQuietHours(now = new Date()): boolean {
  return now.getHours() >= 9 && now.getHours() < 20;
}

export function smartReminderCapAllows(lastSmartSentAt: string | null | undefined, now = new Date()): boolean {
  if (!lastSmartSentAt) return true;
  return now.getTime() - Date.parse(lastSmartSentAt) >= 72 * 60 * 60 * 1000;
}
