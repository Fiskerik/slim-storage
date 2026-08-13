# TrimSwipe App Store localization upload

This workflow mirrors the Atomic Fusion Rush metadata uploader. It updates the 30 localized App Store listings while keeping credentials outside the repository.

## What it uploads

- App name and subtitle
- Privacy policy URL
- Description and keywords
- Promotional text and What's New
- Support and marketing URLs

It does not currently change screenshots, App Review notes, subscriptions, or in-app purchase localizations. Those resources have separate App Store Connect workflows. The preview reports product aliases that are not safely mapped.

## 1. Generate and validate

From `mobile/mobile`:

```powershell
npm.cmd run generate:store-listings
npm.cmd run validate:store
```

Review `app-store-metadata.json` before uploading. Normal generation refreshes keywords and What's New, but preserves each locale's existing promotional text. Promotional text only changes when explicitly requested:

```powershell
npm.cmd run generate:store-listings -- --refresh-promotional-text
```

Use `--refresh-all` only when the other translated listing fields should also be regenerated.

To refresh the full localized description while preserving promotional text:

```powershell
npm.cmd run generate:store-listings -- --refresh-description
```

## 2. Configure credentials for the PowerShell session

Create an App Store Connect API key with an appropriate App Manager or Admin role. Keep its `.p8` file outside this repository.

```powershell
$env:ASC_ISSUER_ID = "YOUR_ISSUER_ID"
$env:ASC_KEY_ID = "YOUR_KEY_ID"
$env:ASC_PRIVATE_KEY_PATH = "C:\secure\AuthKey_YOUR_KEY_ID.p8"
```

`ASC_APP_ID` and `ASC_APP_INFO_ID` are optional overrides. Normally the uploader discovers the app using `com.fiskerik.trimswipe`.

## 3. Preview (no authentication and no network changes)

```powershell
.\scripts\app-store\Publish-AppStoreLocalizations.ps1 `
  -MetadataPath ".\app-store-metadata.json" `
  -Version "1.1.3" `
  -Preview
```

## 4. Upload

The App Store version must already exist in App Store Connect and be editable.

```powershell
.\scripts\app-store\Publish-AppStoreLocalizations.ps1 `
  -MetadataPath ".\app-store-metadata.json" `
  -Version "1.1.3" `
  -Apply
```

The upload is idempotent: missing localizations are created, changed fields are updated, and matching fields are left untouched.
