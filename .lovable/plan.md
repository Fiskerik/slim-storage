# Slim → App Store: Step-by-Step Publishing Plan

You have RevenueCat. You don't yet have an Apple Developer account, an App Store Connect listing, EAS configured, or store assets. Here is the exact order to do everything, with what I (Lovable) will do for you vs. what only you can do (because Apple requires your real identity, payment, and 2FA device).

---

## Step 1 — Apple Developer Program enrollment (YOU, ~1–3 days)

Only you can do this. Apple needs your legal identity.

1. Go to https://developer.apple.com/programs/enroll/
2. Sign in with your Apple ID (turn on 2FA if not already).
3. Choose **Individual** (fastest, ~24 h) or **Organization** (needs a D-U-N-S number, 3–7 days, but lets you publish under a company name).
4. Pay **$99 USD/year**.
5. Wait for the "Welcome to the Apple Developer Program" email.

Blocker until done: you cannot create an App Store Connect record or run `eas submit -p ios`.

---

## Step 2 — App Store Connect setup (YOU, 30 min)

Once enrolled:

1. Go to https://appstoreconnect.apple.com → **Agreements, Tax, and Banking** → fill all three (legal, tax forms, bank account). Even free apps need this completed before publishing.
2. **Users and Access → Integrations → App Store Connect API** → create a key with "App Manager" role. Download the `.p8` file (you only get to download it once). Note the **Key ID** and **Issuer ID**. EAS uses these to submit automatically.
3. **My Apps → "+" → New App**:
   - Platform: iOS
   - Name: `Slim`
   - Primary language: English
   - Bundle ID: `com.slim.app` (or whatever your `app.json` has — must match exactly)
   - SKU: `slim-001`
   - User access: Full

---

## Step 3 — RevenueCat ↔ App Store wiring (YOU + me, 45 min)

Order matters: products must exist in App Store Connect first, then in RevenueCat.

1. In App Store Connect → your app → **Monetization → Subscriptions** → create a Subscription Group "Slim Pro" with:
   - `slim_pro_monthly` ($2.99/mo)
   - `slim_pro_yearly` ($19.99/yr)
2. **Monetization → In-App Purchases** → add `slim_pro_lifetime` ($39.99, non-consumable).
3. In RevenueCat dashboard:
   - Add the iOS app, paste your Bundle ID and your App Store Connect API key (the `.p8` from Step 2).
   - Create an **Entitlement** called `pro`.
   - Create **Products** matching the three IDs above and attach them to `pro`.
   - Create an **Offering** "default" containing all three.
4. Give me the RevenueCat **iOS public SDK key** (starts with `appl_…`). I'll wire it into the Expo app as `EXPO_PUBLIC_RC_IOS_KEY`. Public SDK keys are safe to commit but I'll keep it in env.

---

## Step 4 — I wire RevenueCat into the Expo app (ME, this turn after approval)

I'll update `slim-expo.zip` with:
- `react-native-purchases` installed.
- `lib/iap.ts` with `configureRC()`, `getOfferings()`, `purchase(pkg)`, `restorePurchases()`, `isPro()`.
- Paywall screen reads live offerings from RevenueCat (no hardcoded prices).
- Streak Shield purchase routed through RevenueCat as a **consumable** product `slim_shield_token` (also create this in App Store Connect, $0.99).
- Pro gating: free users get 50 trims/day; Pro is unlimited.
- Restore Purchases button in Settings (Apple requires this).

---

## Step 5 — Final pre-submission polish (ME)

Things Apple's reviewer will check for and reject if missing:
- Privacy policy URL + ToS URL — I'll generate the markdown; you host on any free static host (GitHub Pages, Vercel, or even a Notion public page works).
- "Delete all data" button in Settings (Apple requires this since 2022).
- Permission prompt copy in `app.json` (`NSPhotoLibraryUsageDescription`) — must explain *why* in plain language, not "We need access".
- App icon 1024×1024 (no alpha, no rounded corners — Apple rounds them).
- Launch screen.

---

## Step 6 — Build with EAS (ME + YOU, 30 min)

I run, you watch:
```
npx eas login            # you log in once with your Apple ID
npx eas build:configure
npx eas build -p ios --profile production
```
EAS will:
- Generate the iOS provisioning profile and distribution certificate automatically (you just approve the 2FA prompt on your phone).
- Upload to Apple's build servers.
- Give you a `.ipa` file URL after ~15–25 min.

---

## Step 7 — TestFlight (YOU, 2–3 days minimum)

1. `npx eas submit -p ios --latest` → uploads the build to App Store Connect.
2. App Store Connect → **TestFlight** → wait ~10 min for "Processing" to finish.
3. Add yourself + 5–20 friends as **Internal Testers** (no Apple review needed, instant).
4. Install TestFlight app on your iPhone, accept invite, install Slim.
5. Use it for at least 3 days. Look for: crashes, permission flow, purchase flow (TestFlight uses sandbox StoreKit — purchases are free), restore flow.

---

## Step 8 — Store listing content (YOU fill in App Store Connect, I draft the copy)

I'll provide drafts; you paste them in:
- App name, subtitle (30 chars), promotional text (170 chars), description (4000 chars), keywords (100 chars), support URL, marketing URL, privacy policy URL.
- **Screenshots**: 6.7" (iPhone 15 Pro Max) and 6.5" (iPhone 11 Pro Max) — minimum 3 each. Easiest: take them on the iPhone simulator running your TestFlight build, or use the real device + a frame tool like https://screenshots.pro.
- **App Privacy** section: declare "Data Not Collected" across the board. This is your differentiator — say so loudly in the description too.
- Age rating: answer the questionnaire (yours is 4+).
- Category: Primary "Photo & Video", Secondary "Utilities".

---

## Step 9 — Submit for review (YOU click one button, 24–72 h wait)

App Store Connect → **App Review → Submit for Review**.

If rejected (common on first submission), Apple sends a written reason. Most common rejections for an app like Slim:
- "Permission prompt unclear" → fix copy in `app.json`, rebuild, resubmit.
- "Missing account deletion" → add the button (Step 5 covers it).
- "Subscriptions don't restore" → add Restore button (Step 4 covers it).

Each resubmission is another 24–48 h.

---

## Step 10 — Release

After approval you choose:
- **Manual release** (recommended) — you press a button when you're ready.
- **Automatic** — goes live immediately.

---

## What happens in the next Lovable turn (after you approve this plan)

I will, in one batch:
1. Wire RevenueCat into the Expo project (`react-native-purchases`, paywall reads live offerings, restore button, pro gating, shield token as consumable).
2. Add the "Delete all data" button + finalize permission prompt copy in `app.json`.
3. Generate Privacy Policy and ToS markdown (you host them anywhere).
4. Generate the 1024×1024 App Store icon from the existing brand.
5. Draft App Store listing copy (name, subtitle, description, keywords, promo text).
6. Update `eas.json` with a `production` profile and submit config that uses your `.p8` API key (you'll paste the Key ID / Issuer ID into env when ready).
7. Refresh the README into a literal "do these 9 things in this order" checklist.
8. Repackage `slim-expo.zip`.

After that the ball is in your court for Steps 1, 2, 3, 7, 8, 9 (Apple-side actions only you can do). I'll stay on standby for any code change a TestFlight tester or App Review surfaces.

---

## What I need from you to start the next turn

Nothing required up front, but these unblock later steps faster:
- **Bundle ID** you want (default `com.slim.app`, or pick your own — must be globally unique on Apple).
- **Pricing** for monthly / yearly / lifetime / shield token (defaults above are fine).
- **Support email** to put in the listing.
- Whether you want the paywall to appear **on first launch after onboarding**, **after 3 sessions**, or **only when a free user hits the daily limit**. (My recommendation: third option — least pushy, highest long-term retention.)

You can answer those after approval; I'll start with sensible defaults and you change them later.
