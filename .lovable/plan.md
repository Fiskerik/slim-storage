## What you have today

- A polished web prototype (Lovable / TanStack Start) using mock photos from picsum.
- A bundled `slim-expo.zip` containing the Expo (React Native) MVP scaffold with: real swipe deck, `expo-media-library` access, EXIF strip via `expo-image-manipulator`, Memory year-guess game, persistent stats, `app.json`, `eas.json`, README.

The web prototype is the **marketing/demo**. The Expo project is what actually ships to the stores. The plan below is everything between "scaffold" and "live in both stores".

---

## Phase A — Get the Expo project running locally (Day 1)

1. Unzip `slim-expo.zip`, `npm install`, `npx expo start`.
2. Test on a real iPhone via Expo Go (gesture deck, permission flow, slim, delete).
3. Test on a real Android device.
4. Fix anything that broke between the web prototype and native (gesture thresholds, safe-area insets, status-bar color in light/dark).

Acceptance: full loop works on both platforms with your own camera roll.

---

## Phase B — Productize the MVP (Week 1)

Things the scaffold leaves as TODO that the stores expect:

- **Onboarding** (3 screens): Privacy promise → Permission request → How to swipe.
- **Permission denial recovery**: deep-link to Settings if user denied photo access.
- **Empty / end-of-set states**: real copy, not placeholder.
- **Undo last action** (one-step), required to avoid 1-star reviews.
- **Confirm-before-delete** modal (Apple HIG strongly expects this for destructive batch ops).
- **Error boundaries + crash reporting** (Sentry or Expo's built-in).
- **Analytics events** for the KPIs in the roadmap (sessions, MB freed, slim conversion, streak).
- **Haptics** on swipe commit (Phase 2 in the roadmap, but cheap and expected).
- **Settings screen**: JPEG quality slider, Reset stats, Privacy policy link, Support email.

---

## Phase C — Monetization plumbing (Week 2)

Required if you want to charge anything from day one.

- Add `react-native-iap` (or RevenueCat — recommended, much less StoreKit pain).
- Define products in App Store Connect and Google Play Console:
  - `slim_pro_monthly`, `slim_pro_yearly`, `slim_pro_lifetime`.
- Free tier limit (e.g. 50 trims/day) + paywall screen.
- Restore purchases button (Apple requires it).

---

## Phase D — Legal & store-required pages (Week 2)

These are blockers for review:

- **Privacy policy URL** (publicly hosted). Must explicitly say no photos leave the device.
- **Terms of service URL**.
- **Support URL** + support email.
- **Apple Privacy Nutrition Label**: declare "Data Not Collected" (this is your edge — say it loud).
- **Google Play Data Safety form**: same answers.
- **Account deletion flow** (Apple requires this since 2022, even if you have no accounts — a "Reset all data" button satisfies it).

---

## Phase E — Store assets (Week 2-3)

Both stores need these before you can submit:

| Asset | iOS | Android |
|---|---|---|
| App icon | 1024×1024 PNG | 512×512 PNG |
| Screenshots | 6.7" + 6.5" + 5.5" iPhone, plus iPad if supported | Phone + 7" + 10" tablet |
| Preview video | optional but +30% conversion | optional |
| Feature graphic | — | 1024×500 PNG required |
| Short description | — | 80 chars |
| Full description | up to 4000 chars | up to 4000 chars |
| Promotional text | 170 chars | — |
| Keywords | 100 chars (comma-sep) | — (Play uses description) |

The README already drafted copy — needs final pass + screenshots from the actual built app.

---

## Phase F — Build, test, submit (Week 3-4)

1. `eas build --profile production --platform ios` and `--platform android`.
2. **TestFlight beta** with 10–20 testers for at least 3 days.
3. **Google Play internal testing** track, same idea.
4. Fix beta feedback.
5. Submit:
   - `eas submit -p ios` → App Store review (24–72 h typical).
   - `eas submit -p android` → Play review (a few hours to a few days for first submission; first-time apps often get 7-day extended review).

---

## Phase G — Launch readiness checklist

- App Store Connect: tax + banking forms filled (you cannot publish even a free app without "Agreements, Tax, and Banking" green).
- Apple Developer Program account active ($99/yr).
- Google Play Developer account active ($25 one-time).
- Bundle IDs reserved on both stores.
- App signing: iOS provisioning profile (EAS handles), Android upload key + Play App Signing enrollment.
- Crash-free rate ≥ 99% on TestFlight before submitting.
- Tested on the smallest supported screen (iPhone SE) and a low-end Android.
- Cold-start time under 2 s.

---

## Recommended order of work for the next Lovable turn

A single follow-up build can knock out the highest-impact gaps before you switch over to Xcode/EAS work. Suggested batch:

1. Onboarding (3 screens) + permission flow polish.
2. Undo + confirm-before-delete modal.
3. Settings screen (quality slider, reset, links).
4. Paywall scaffold + RevenueCat wiring (keys as env, not committed).
5. Privacy policy + ToS markdown pages (so you can host them anywhere).
6. Updated `slim-expo.zip` containing all of the above + refreshed README with the exact App Store / Play submission checklist.

Approve and I'll do that batch in the next turn. If you'd rather pick a subset (e.g. skip paywall for a free v1), say which.
