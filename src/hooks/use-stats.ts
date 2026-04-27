import { useSyncExternalStore } from "react";
import { getStats, subscribeStats, type Stats } from "@/lib/storage";

const empty: Stats = {
  cleaned: 0, deleted: 0, slimmed: 0, mbFreed: 0,
  streak: 0, lastSessionDate: null,
  memoryPlayed: 0, memoryCorrect: 0, memoryBestStreak: 0,
  memoryCurrentStreak: 0, memoryTotalDelta: 0,
  isPro: false, trimsToday: 0, trimsTodayDate: null, daily: [],
  settings: {
    cardsPerRound: 10,
    iCloudSync: false,
    reminderEnabled: true,
    reminderTime: "19:00",
    iCloudBackupWarn: true,
    onboarded: false,
    displayName: "You",
  },
  pendingDelete: [],
};

export function useStats(): Stats {
  return useSyncExternalStore(
    (cb) => subscribeStats(cb),
    () => getStats(),
    () => empty,
  );
}
