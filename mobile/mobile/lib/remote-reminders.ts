import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { httpsCallable } from "firebase/functions";

import type { NativeBackgroundScanSchedule, NativeEngagementSnapshot, SmartReminderPreferences } from "./native-store";
import { getFirebaseSession, isFirebaseConfigured } from "./firebase-client";

type ReminderSyncResult = {
  configured: boolean;
  enabled: boolean;
  permissionGranted: boolean;
  error?: string;
};

export type ReminderSyncPayload = {
  preferences?: SmartReminderPreferences;
  snapshot?: NativeEngagementSnapshot | null;
  locale?: string;
  streak?: number;
  reviewedToday?: number;
  lastCleanupAt?: string | null;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function timeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

async function expoPushToken(): Promise<string> {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error("Missing Expo EAS project ID");
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

function publicSchedules(schedules: NativeBackgroundScanSchedule[]) {
  return schedules.slice(0, 8).map((schedule) => ({
    id: schedule.id,
    label: schedule.label,
    active: schedule.active,
    days: schedule.days,
    times: schedule.times,
    targetMB: schedule.targetMB,
  }));
}

export async function syncRemoteCleanupReminders(
  schedules: NativeBackgroundScanSchedule[],
  options: { requestPermission?: boolean } = {},
  engagement?: ReminderSyncPayload,
): Promise<ReminderSyncResult> {
  if (!isFirebaseConfigured()) {
    return { configured: false, enabled: false, permissionGranted: false };
  }

  try {
    const activeSchedules = schedules.filter((schedule) => schedule.active);
    let permission = await Notifications.getPermissionsAsync();
    const smartEnabled = engagement?.preferences?.enabled === true;
    if ((activeSchedules.length > 0 || smartEnabled) && !permission.granted && options.requestPermission) {
      permission = await Notifications.requestPermissionsAsync();
    }

    const session = await getFirebaseSession();
    if (!session) return { configured: false, enabled: false, permissionGranted: false };

    const enabled = (activeSchedules.length > 0 || smartEnabled) && permission.granted;
    const syncInstallation = httpsCallable(session.functions, "syncReminderInstallation");
    await syncInstallation({
      expoPushToken: enabled ? await expoPushToken() : null,
      enabled,
      timezone: timeZone(),
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version ?? "unknown",
      schedules: permission.granted ? publicSchedules(activeSchedules) : [],
      smartReminders: engagement?.preferences ?? { enabled: false, streak: true, storage: true, newPhotos: true, cleanup: true, weekly: true },
      engagementSnapshot: engagement?.snapshot ?? null,
      locale: engagement?.locale ?? "en",
      streak: engagement?.streak ?? 0,
      reviewedToday: engagement?.reviewedToday ?? 0,
      lastCleanupAt: engagement?.lastCleanupAt ?? null,
    });

    return {
      configured: true,
      enabled,
      permissionGranted: permission.granted,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("[TrimSwipe] Remote reminder sync failed", { error: message });
    return {
      configured: true,
      enabled: false,
      permissionGranted: false,
      error: message,
    };
  }
}

export function subscribeToReminderResponses(onOpenAutomation: () => void): () => void {
  const openIfReminder = (response: Notifications.NotificationResponse | null) => {
    const type = response?.notification.request.content.data?.type;
    if (type === "cleanup-reminder" || type === "smart-reminder") {
      onOpenAutomation();
    }
  };

  void Notifications.getLastNotificationResponseAsync().then(openIfReminder);
  const subscription = Notifications.addNotificationResponseReceivedListener(openIfReminder);
  return () => subscription.remove();
}
