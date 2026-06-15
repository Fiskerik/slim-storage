import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Trimswipe",
  slug: "slim-storage",
  version: "1.0.4",
  orientation: "portrait",
  scheme: "trimswipe",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.fiskerik.trimswipe",
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription: "Needed to find your pictures.",
      NSPhotoLibraryUsageDescription:
        "Trimswipe needs access to your photo library so you can swipe through your photos and free up storage.",
      NSPhotoLibraryAddUsageDescription:
        "Trimswipe may save optimized versions of your photos.",
      NSUserTrackingUsageDescription:
        "This identifier will be used to deliver personalized ads to you.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.fiskerik.trimswipe",
    permissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
      "android.permission.ACCESS_MEDIA_LOCATION",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_AUDIO",
    ],
  },
  plugins: [
    "expo-router",
    [
      "expo-media-library",
      {
        photosPermission:
          "Trimswipe needs access to your photos so you can review and clean up your camera roll.",
        savePhotosPermission: "Trimswipe may save optimized versions of your photos.",
        isAccessMediaLocationEnabled: true,
      },
    ],
    "expo-image",
    "expo-web-browser",
    [
      "react-native-google-mobile-ads",
      {
        iosAppId:
          process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ??
          "ca-app-pub-8854735603167656~1027546750",
        androidAppId:
          process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ??
          "ca-app-pub-3940256099942544~3347511713",
        userTrackingUsageDescription:
          "This identifier will be used to deliver personalized ads to you.",
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "761a961b-b2ba-48b1-9e2f-8051dee70c08",
    },
    router: {},
  },
  owner: "eddypham1981",
};

export default config;
