import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

const CLEANUP_TASK = "trimswipe-cleanup-maintenance";

TaskManager.defineTask(CLEANUP_TASK, () =>
  Promise.resolve(BackgroundTask.BackgroundTaskResult.Success),
);

export async function registerCleanupBackgroundTask(): Promise<void> {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(CLEANUP_TASK);
    if (!registered) {
      await BackgroundTask.registerTaskAsync(CLEANUP_TASK, { minimumInterval: 60 });
    }
  } catch (error) {
    console.log("[TrimSwipe] Background task registration skipped", { error });
  }
}
