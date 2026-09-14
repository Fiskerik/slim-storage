import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import "./notification-presentation";
import { reconcileDailyTrimReminder, DAILY_TRIM_REMINDER_ID } from "./daily-trim-reminder";
import { registerCleanupBackgroundTask } from "./progress-notifications";

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  SchedulableTriggerInputTypes: { DAILY: "daily" },
}));
jest.mock("expo-task-manager", () => ({ defineTask: jest.fn(), isTaskRegisteredAsync: jest.fn().mockResolvedValue(true) }));
jest.mock("expo-background-task", () => ({ BackgroundTaskResult: { Success: 1 } }));
jest.mock("./i18n", () => ({ t: (key: string) => key }));

const handler = jest.mocked(Notifications.setNotificationHandler).mock.calls[0][0]!;
const initialState = AppState.currentState;
afterEach(() => { AppState.currentState = initialState; jest.clearAllMocks(); });

describe("notification presentation", () => {
  it.each(["active", "inactive", "unknown"] as const)("suppresses banners, list entries and sound while %s", async (state) => {
    AppState.currentState = state;
    const result = await handler.handleNotification({} as Notifications.Notification);
    expect(result).toEqual({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: false, shouldShowList: false });
  });

  it("allows system reminders when the app is in the background", async () => {
    AppState.currentState = "background";
    expect(await handler.handleNotification({} as Notifications.Notification)).toEqual({
      shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true,
    });
  });

  it("keeps opted-in reminders scheduled at the user's chosen time", async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: true } as Notifications.NotificationPermissionsStatus);
    await reconcileDailyTrimReminder({ enabled: true, promptAcknowledged: true, time: "19:45" });
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(DAILY_TRIM_REMINDER_ID);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
      identifier: DAILY_TRIM_REMINDER_ID,
      content: expect.objectContaining({ data: { type: "daily-trim-reminder", screen: "daily-cleanup" }, sound: "default" }),
      trigger: expect.objectContaining({ type: "daily", hour: 19, minute: 45 }),
    }));
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it.each([
    { enabled: false, promptAcknowledged: true, granted: true },
    { enabled: true, promptAcknowledged: false, granted: true },
    { enabled: true, promptAcknowledged: true, granted: false },
  ])("does not bypass notification opt-in: %j", async ({ granted, ...settings }) => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted, canAskAgain: true } as Notifications.NotificationPermissionsStatus);
    await reconcileDailyTrimReminder(settings);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(DAILY_TRIM_REMINDER_ID);
  });

  it("cleanup registration never requests notification permission or schedules an alert", async () => {
    await registerCleanupBackgroundTask();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
