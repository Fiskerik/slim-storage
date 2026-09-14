import * as Notifications from "expo-notifications";
import { AppState } from "react-native";

// Cleanup feedback lives in the app. Scheduled/push reminders still reach the
// system normally when the app is closed; suppress them while the user is here
// (including transient inactive states such as the Photos confirmation sheet).
Notifications.setNotificationHandler({
  handleNotification: async () => {
    const away = AppState.currentState === "background";
    return {
      shouldPlaySound: away,
      shouldSetBadge: false,
      shouldShowBanner: away,
      shouldShowList: away,
    };
  },
});
