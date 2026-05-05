# iOS Launch Audit (May 5, 2026)

## What is already in place

- Photo library permission copy is configured in Expo config (`NSPhotoLibraryUsageDescription` and `NSPhotoLibraryAddUsageDescription`).
- Native bridge methods exist for requesting permission, reading photos, and deleting assets through `expo-media-library`.
- RevenueCat bridge is wired end-to-end (configure, get offerings, purchase, restore, paywall, customer center).
- Profile upgrade button already opens `presentPaywall()` in native app.

## Critical gaps to fix before App Store submission

1. **Remove web/test backdoor that unlocks Pro without purchase**
   - In `ProfilePage`, free users on web can unlock Pro with `setPro(true)` immediately.
   - This must not ship in production builds, or app review may reject for misleading purchase flow.

2. **Replace hardcoded lifetime product fallback ID**
   - `EXPO_PUBLIC_RC_LIFETIME_PRODUCT_ID` falls back to `prod5debd6b43b` if env var is missing.
   - Fallback IDs are risky; production should fail fast when env vars are missing.

3. **Avoid ambiguous entitlement naming**
   - Entitlement check is hardcoded to `'TrimSwipe Pro'`.
   - Ensure RevenueCat entitlement identifier exactly matches dashboard value and document it as a single source of truth.

4. **Handle limited Photos access explicitly**
   - Permission logic treats only `granted` as success and does not surface `limited` UX.
   - Add user guidance to manage selected photos (iOS limited library mode) to avoid confusion.

5. **Add missing legal/commerce metadata for listing**
   - Ensure Terms of Use (EULA) and Privacy Policy URLs are fully set in App Store Connect and in-app paywall context.
   - For paid unlocks, clearly show price, what unlock includes, and restore path near upgrade CTA.

6. **Add review-ready purchase test notes**
   - Prepare App Review notes with sandbox test account steps for RevenueCat paywall and restore.
   - Include where reviewer can find Upgrade and Restore in the app.

## Nice-to-have launch hardening

- Add telemetry/logging guard so RevenueCat debug logs are reduced in production.
- Add retry + empty-state UX when offerings fail to load.
- Add a preflight launch check screen in internal QA build (permissions + offerings + entitlement status).
