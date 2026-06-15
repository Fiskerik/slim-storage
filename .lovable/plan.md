
## Goal

Wire up 5 RevenueCat products (4 token packs + Lifetime Pro) and an AdMob rewarded ad that grants 5 Trim Tokens. Add a Shop screen and a "Watch ad for tokens" button on Home. Tokens stored locally; Lifetime Pro = unlimited tokens + no ads.

## 1. Environment variables

All RC + AdMob values are **public client identifiers** (not secrets), but we still keep them out of source so dev/prod can differ.

| Variable | Value | Purpose |
|---|---|---|
| `EXPO_PUBLIC_RC_KEY` | `appl_...` | RevenueCat iOS SDK key (already used) |
| `EXPO_PUBLIC_RC_KEY_ANDROID` | `goog_...` | RevenueCat Android SDK key |
| `EXPO_PUBLIC_RC_ENTITLEMENT_ID` | `TrimswipePro` | Lifetime entitlement (already used) |
| `EXPO_PUBLIC_RC_LIFETIME_PRODUCT_ID` | `lifetime_premium_1` | (already used) |
| `EXPO_PUBLIC_RC_TOKEN_PRODUCT_IDS` | `tokens_50,tokens_100,tokens_200,tokens_500` | Comma-list of consumable token packs |
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | `ca-app-pub-8854735603167656~1027546750` | iOS AdMob app id |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | *(needed)* | Android AdMob app id |
| `EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID` | `ca-app-pub-8854735603167656/4735986775` | iOS rewarded unit |
| `EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID` | *(needed)* | Android rewarded unit |
| `EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID` | `ca-app-pub-8854735603167656/5063289836` | (optional, available) |

> Need from you: the **Android AdMob app ID + Android rewarded unit ID**, and the **Android RC key** (`goog_...`) if you plan to ship Android. Otherwise we gate Android behind iOS-only.

### Where to put them

EAS does the native builds, so:

1. **Primary location: EAS environment variables** (Expo dashboard → Project → Environment variables) for the `production`, `preview`, and `development` environments. EAS injects them into `expo prebuild`/build so `app.config.ts` and the JS bundle both see them.
2. **GitHub: not needed** for build values — EAS builds aren't run on GitHub. Only put them in GitHub Actions if you trigger EAS from CI (then use GitHub Action secrets and forward via `eas build --non-interactive`).
3. **Local dev**: a `.env.local` (gitignored) with the same `EXPO_PUBLIC_*` keys.

`EXPO_PUBLIC_*` is intentional — these are public IDs and need to be readable from the JS bundle.

## 2. RevenueCat dashboard setup (you do this)

- Add `tokens_50/100/200/500` as **Consumable** products in App Store Connect, then import into RC.
- Create one **Offering** named `default` with 4 packages pointing at the token products + 1 package for `lifetime_premium_1` (already exists).
- Lifetime stays attached to the `TrimswipePro` entitlement. Token packs have **no entitlement** (they're consumables credited app-side).

## 3. Code changes

### a. `mobile/mobile/app.config.ts` (new, replaces static `app.json`)
- Convert `app.json` → `app.config.ts` so we can read `process.env.EXPO_PUBLIC_ADMOB_*` and inject into the `react-native-google-mobile-ads` plugin config (requires app IDs in native Info.plist / AndroidManifest).
- Add plugin entry:
  ```ts
  ["react-native-google-mobile-ads", {
    iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
    androidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID,
    userTrackingUsageDescription: "This identifier will be used to deliver personalized ads to you."
  }]
  ```
- Add iOS `SKAdNetworkItems` (AdMob's published list) and `NSUserTrackingUsageDescription`.

### b. Dependencies
`bun add react-native-google-mobile-ads` inside `mobile/mobile/`.

### c. `mobile/mobile/lib/tokens.ts` (new)
- AsyncStorage-backed store: `getTokens()`, `addTokens(n)`, `spendToken()`, `subscribe(cb)`.
- Helper `hasUnlimited()` → reads RC pro flag.
- `canTrim()` = pro || tokens > 0.

### d. `mobile/mobile/lib/ads.ts` (new)
- Lazy `initAds()` (calls `mobile.initialize()` once).
- `showRewardedAd(): Promise<boolean>` — loads + shows rewarded; resolves true if user earned reward; on success calls `addTokens(5)`. Skips entirely if `hasUnlimited()`.
- Preloads next rewarded after each show.

### e. `mobile/mobile/lib/purchases.ts` (edit)
- Extend `getProducts()` to surface all packages (already does).
- Add `purchaseTokenProduct(productId)` that on success credits the matching pack amount locally:
  - `tokens_50 → +50`, `tokens_100 → +100`, `tokens_200 → +200`, `tokens_500 → +500`.
- Lifetime purchase flow unchanged (entitlement flips `isPro`).

### f. `mobile/mobile/components/ShopScreen.tsx` (new)
- 4 token pack cards (price from RC product, "Best value" badge on 500).
- Lifetime Pro hero card (hidden / shows "Owned" when `isPro`).
- "Watch ad → +5 tokens" button (hidden when Pro).
- Current balance + Pro badge at top.

### g. `mobile/mobile/components/HomeDashboard.tsx` (edit)
- Add small "Tokens: N" chip in hero card.
- Add "Watch ad +5" button (hidden when Pro).
- Add "Shop" entry in quick-actions grid.

### h. `mobile/mobile/components/NativeTrimSwipeApp.tsx` (edit)
- Add `"shop"` to `Screen` union; route from Home + bottom nav.
- Before each trim/delete in swipe + trim flows: if `!isPro && tokens === 0` → open Shop. Else spend 1 token per photo trimmed.

### i. Profile screen (edit)
- Show token balance, "Restore purchases" already exists, add "Manage tokens → Shop" link.
- Remove the web "unlock pro" backdoor noted in `IOS_LAUNCH_AUDIT.md` since real IAP now works.

## 4. Verification

- Local sandbox: TestFlight build with sandbox Apple ID → purchase each token pack, verify balance increments, verify lifetime flips Pro and hides ads.
- AdMob: use Google's test unit IDs in dev (`ca-app-pub-3940256099942544/5224354917` rewarded) gated by `__DEV__`.
- Confirm `EXPO_PUBLIC_RC_KEY_ANDROID` / Android AdMob IDs once you provide them; otherwise Android builds will warn at runtime.

## Open items I need from you

1. Android AdMob App ID + Rewarded unit ID (or confirm iOS-only).
2. Android RevenueCat key (`goog_...`) if Android is in scope.
3. Confirm "1 token = 1 photo trimmed" applies to both the manual **Trim** flow and the **Swipe → trim** action (vs. only manual trim).
