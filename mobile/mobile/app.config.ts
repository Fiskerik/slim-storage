import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Trimswipe",
  slug: "slim-storage",
  version: "1.0.4",
  icon: "./assets/images/icon-glassy-scissors-1024.png",
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
    "expo-web-browser",
    [
      "react-native-google-mobile-ads",
      {
        ios_app_id:
          process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ??
          "ca-app-pub-8854735603167656~1027546750",
        android_app_id:
          process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ??
          "ca-app-pub-3940256099942544~3347511713",
        user_tracking_usage_description:
          "This identifier will be used to deliver personalized ads to you.",
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "ddf5633b-2fa9-4f34-b960-fbc01e8b5729",
    },
    router: {},
  },
  owner: "fiskerik89",
};

export default config;
