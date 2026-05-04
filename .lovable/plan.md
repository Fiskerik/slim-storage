
# Real Device Photos via Native Bridge

## Problem

The app is a WebView loading `trimswipe.lovable.app`. The web code uses fake picsum.photos images. A WebView cannot access iOS photo APIs directly — we need the Expo native shell to act as a bridge.

## Architecture

```text
┌─────────────────────────────────┐
│  Expo Native Shell (React Native)│
│  ┌───────────────────────────┐  │
│  │  expo-media-library        │  │  ← reads real photos, checks iCloud status
│  │  expo-haptics              │  │  ← real haptic feedback
│  │  Bridge handler            │  │  ← listens to postMessage from WebView
│  └───────────────────────────┘  │
│            ↕ postMessage         │
│  ┌───────────────────────────┐  │
│  │  WebView (trimswipe.lovable) │
│  │  photo-source.ts detects   │  │  ← if inside WebView, calls bridge
│  │  native bridge & delegates │  │     instead of returning sample photos
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

## Changes

### 1. Expo native shell — new bridge + photo access

**In `mobile/mobile/`:**

- Install `expo-media-library` (photo access + delete) and `expo-haptics`
- Replace the default tab app with a single full-screen WebView (`react-native-webview`)
- Implement a message bridge that handles requests from the WebView:
  - `requestPermission` — calls `MediaLibrary.requestPermissionsAsync()`
  - `getPhotos` — fetches N random photos with metadata (date, size, location, device model) via `MediaLibrary.getAssetsAsync()`
  - `getOlderPhotos` — same but filtered by `createdBefore`
  - `getBurstGroups` — fetches burst/similar photos (by timestamp proximity)
  - `deletePhotos` — calls `MediaLibrary.deleteAssetsAsync()` (triggers iOS confirmation)
  - `checkCloudStatus` — reads the asset's `isFavorite` and network URI to infer iCloud sync state
  - `hapticTap` — triggers real haptic feedback via `expo-haptics`
- Update `app.json` with `NSPhotoLibraryUsageDescription` and `NSPhotoLibraryAddUsageDescription` permission strings

### 2. Web app — detect native bridge and delegate

**`src/lib/photo-source.ts`:**

- Add a `nativeBridgeSource` that detects `window.ReactNativeWebView` (injected by `react-native-webview`)
- When detected, all `PhotoSource` methods send a JSON `postMessage` to the native shell and await a response via a `window.addEventListener("message", ...)` callback
- Each photo URL becomes a `data:` URI or a local file URI provided by the native side
- Falls back to the existing `webSource` (sample photos) when not in a WebView — so the web preview keeps working

**`src/lib/native-shell.ts`:**

- `hapticTap()` sends a bridge message when in WebView, no-op otherwise

### 3. Remove template photos from production path

**`src/lib/photos.ts`:**

- Keep the file as-is (it's the web fallback for development/preview)
- `photo-source.ts` simply won't use it when the native bridge is available

### 4. iCloud backup awareness

- The native bridge returns an `isCloudAsset` boolean per photo (based on whether the asset's resource is available locally or only in iCloud)
- The existing `ICloudWarnModal` in `SwipeDeck.tsx` already handles this — we wire it to the real data instead of the hardcoded setting
- If a photo is not yet downloaded from iCloud, show a warning before delete

### 5. Permissions

- `app.json` gets proper iOS permission descriptions
- On first launch, the bridge requests photo library access with "full access" scope
- If denied, the existing `permissionDenied` UI in `SwipeDeck.tsx` already handles it (shows "Open Settings" prompt)

### 6. Additional iOS adaptations

- **Haptics**: Real `expo-haptics` calls on swipe actions
- **Safe area**: WebView uses `useSafeAreaInsets()` to avoid notch/home-indicator overlap
- **Status bar**: Proper status bar style via `expo-status-bar`
- **Photo metadata**: Real EXIF data (date taken, device model, GPS, file size) replaces the hardcoded sample values

## What stays the same

- The web app at `trimswipe.lovable.app` continues to work standalone with sample photos
- All game modes (Memory, This-or-That, Speed Round, Storage Budget) automatically get real photos because they all go through `getPhotoSource()`
- Stats, streaks, settings all remain in localStorage (persisted in the WebView)
- No backend/database changes needed

## Files touched

| Area | Files |
|------|-------|
| Expo shell | `mobile/mobile/app/` (replace tabs with WebView bridge), `mobile/mobile/package.json`, `mobile/mobile/app.json` |
| Web bridge | `src/lib/photo-source.ts`, `src/lib/native-shell.ts` |
| Config | Root `app.json` (permission strings) |
