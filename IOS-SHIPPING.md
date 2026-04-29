# Shipping Slim to the App Store

This project is configured to be wrapped as a native iOS app via **Capacitor**.
The same React code that runs in the web preview also runs inside the iOS
webview — but with one critical difference: on the device it reads from the
real Photos library, not the bundled sample images.

## One-time setup (on a Mac)

You need **Xcode 15+** and **CocoaPods** installed.

```bash
# 1. Install JS deps
bun install

# 2. Install iOS deps (CocoaPods)
cd ios/App && pod install && cd ../..
```

## Every build / iteration cycle

```bash
# Build the web app + prerender the routes + copy to iOS project
bun run ios:sync

# Open in Xcode
bun run ios:open
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities** → set your Apple
   Developer Team. The bundle id is `com.fiskerik.trimswipe` (change in
   `capacitor.config.ts` and Xcode project settings if needed).
2. Plug in your iPhone (or pick a simulator) and press ▶.
3. The first time the app starts, iOS will show the photo permission prompt
   defined in `Info.plist`.

## What's where

| File | What it does |
|---|---|
| `capacitor.config.ts` | App id, name, splash screen, native settings |
| `ios/App/App/Info.plist` | iOS permissions, status bar style, encryption flag |
| `src/lib/photo-source.ts` | Platform-aware photo provider (native vs web sample data) |
| `src/lib/native-shell.ts` | Status bar + splash screen + haptics setup |
| `scripts/build-ios.ts` | Prerenders the SSR routes into static HTML for the webview |

## Photo library access

Slim uses [`@capacitor-community/media`](https://github.com/capacitor-community/media)
to enumerate the user's photo library, and writes deletions through the
plugin's `deleteMedias` call (which uses Apple's standard `PHPhotoLibrary`
flow — iOS shows its own confirm dialog before anything is removed).

On **web** (Lovable preview) the same `PhotoSource` interface returns the
bundled `SAMPLE_PHOTOS` so you can keep designing without permission prompts.

## App Store submission checklist

- [ ] Set a real bundle id you own in `capacitor.config.ts` and Xcode.
- [ ] Configure code signing under **Signing & Capabilities**.
- [ ] Update `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in Xcode.
- [ ] Add 1024×1024 app icon to `ios/App/App/Assets.xcassets/AppIcon.appiconset`.
- [ ] Update `ios/App/App/Assets.xcassets/Splash.imageset` with your splash.
- [ ] In App Store Connect, declare:
  - Photo library usage (matches `NSPhotoLibraryUsageDescription`).
  - Encryption: **None** (already set via `ITSAppUsesNonExemptEncryption=false`).
- [ ] Upload via **Product → Archive → Distribute**.

## Troubleshooting

- **"Photo access needed" screen on launch** — iOS denied permission. Open
  Settings → Slim → Photos and choose *All Photos* or *Selected Photos*.
- **White screen in webview** — check Xcode console; usually means a JS
  asset path didn't resolve. Confirm `dist/client/index.html` exists after
  `bun run ios:sync`.
- **`pod install` fails** — run `sudo gem install cocoapods` and retry.
