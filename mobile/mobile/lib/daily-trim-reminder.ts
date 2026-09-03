import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { t } from "./i18n";

export const DAILY_TRIM_REMINDER_ID = "trimswipe-daily-trim-2030";
export const DAILY_TRIM_REMINDER_PROMPT_VERSION = 1;
export const DEFAULT_DAILY_TRIM_REMINDER_TIME = "20:30";
// Kept for callers that still display the original default schedule.
export const DAILY_TRIM_REMINDER_HOUR = 20;
export const DAILY_TRIM_REMINDER_MINUTE = 30;

function parseReminderTime(value: string | undefined): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? DEFAULT_DAILY_TRIM_REMINDER_TIME);
  if (!match) return { hour: 20, minute: 30 };
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return { hour: 20, minute: 30 };
  return { hour, minute };
}

export type DailyTrimReminderPermission = {
  granted: boolean;
  canAskAgain: boolean;
  blocked: boolean;
};

function permissionStatus(status: Notifications.NotificationPermissionsStatus): DailyTrimReminderPermission {
  return {
    granted: Boolean(status.granted),
    canAskAgain: Boolean(status.canAskAgain),
    blocked: !status.granted && !status.canAskAgain,
  };
}

export async function getDailyTrimReminderPermission(): Promise<DailyTrimReminderPermission> {
  try {
    return permissionStatus(await Notifications.getPermissionsAsync());
  } catch {
    return { granted: false, canAskAgain: false, blocked: true };
  }
}

export async function requestDailyTrimReminderPermission(): Promise<DailyTrimReminderPermission> {
  try {
    return permissionStatus(
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      }),
    );
  } catch {
    return { granted: false, canAskAgain: false, blocked: true };
  }
}

async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("daily-trim-reminder", {
    name: t("ui.daily-trim-reminder-channel"),
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 150, 250],
    sound: "default",
  });
}

export async function cancelDailyTrimReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_TRIM_REMINDER_ID).catch(() => undefined);
}

export async function scheduleDailyTrimReminder(time = DEFAULT_DAILY_TRIM_REMINDER_TIME): Promise<boolean> {
  const permission = await getDailyTrimReminderPermission();
  if (!permission.granted) return false;

  try {
    await configureAndroidChannel();
    await cancelDailyTrimReminder();
    const { hour, minute } = parseReminderTime(time);
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_TRIM_REMINDER_ID,
      content: {
        title: t("ui.daily-trim-reminder-title"),
        body: t("ui.daily-trim-reminder-body"),
        sound: "default",
        data: { type: "daily-trim-reminder", screen: "daily-cleanup" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: Platform.OS === "android" ? "daily-trim-reminder" : undefined,
      },
    });
    return true;
  } catch (error) {
    console.log("[TrimSwipe] Daily trim reminder schedule failed", { error });
    return false;
  }
}

export async function reconcileDailyTrimReminder(options: {
  enabled: boolean;
  promptAcknowledged: boolean;
  time?: string;
}): Promise<DailyTrimReminderPermission> {
  const permission = await getDailyTrimReminderPermission();
  if (!options.enabled || !options.promptAcknowledged || !permission.granted) {
    await cancelDailyTrimReminder();
    return permission;
  }
  await scheduleDailyTrimReminder(options.time);
  return permission;
}
