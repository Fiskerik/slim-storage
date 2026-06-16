import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

const CLEANUP_TASK = "trimswipe-cleanup-maintenance";

TaskManager.defineTask(CLEANUP_TASK, () =>
  Promise.resolve(BackgroundTask.BackgroundTaskResult.Success),
);

let notificationsReady = false;

export async function ensureCleanupNotifications(): Promise<boolean> {
  if (notificationsReady) return true;
  try {
    const current = await Notifications.getPermissionsAsync();
    const finalStatus =
      current.status === "granted"
        ? current.status
        : (await Notifications.requestPermissionsAsync()).status;
    notificationsReady = finalStatus === "granted";
    return notificationsReady;
  } catch (error) {
    console.log("[TrimSwipe] Notification permission unavailable", { error });
    return false;
  }
}

export async function notifyCleanupProgress(title: string, body: string): Promise<void> {
  if (!(await ensureCleanupNotifications())) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: false },
    trigger: null,
  }).catch((error) => console.log("[TrimSwipe] Progress notification failed", { error }));
}

export async function registerCleanupBackgroundTask(): Promise<void> {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(CLEANUP_TASK);
    if (!registered) {
      await BackgroundTask.registerTaskAsync(CLEANUP_TASK, { minimumInterval: 60 * 60 });
    }
  } catch (error) {
    console.log("[TrimSwipe] Background task registration skipped", { error });
  }
}
