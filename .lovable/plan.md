# Native iOS UI Revamp (mobile/mobile)

Scope: native Expo app only (`mobile/mobile/`). Touches Home/Dashboard, Stats/Profile, Onboarding, and the Trim flow. SwipeDeck gestures/mapping stay as today. Warm sandstone/terracotta/sage palette is preserved — only the composition and motion change. Density target: 4/5 (bold).

## 1. Design language

Introduce a small native design-token module that mirrors the web palette and keeps colors consistent across screens.

- New file `mobile/mobile/constants/design.ts` — tokens for color (background, card, primary terracotta, sage accent, warm honey, destructive), radii, spacing, shadow presets, type ramp (display/title/body/caption), motion durations.
- New file `mobile/mobile/components/ui/primitives.tsx` — small RN building blocks: `Card`, `Pill`, `IconTile`, `ProgressRing`, `SegmentedToggle`, `Sparkline`, `BarChart`, `BeforeAfterSlider`, `Sheet` (bottom sheet). Built with `react-native-reanimated` + `react-native-gesture-handler` (already installed).
- Replace ad-hoc `Text`/`View` styling sprinkled in `NativeTrimSwipeApp.tsx` with these primitives where it touches the revamped screens; leave SwipeDeck untouched.

## 2. Home / Games dashboard (`GamesScreen` in NativeTrimSwipeApp.tsx)

Photos become the hero; text shrinks to labels and inline hints.

- New top hero: large circular `ProgressRing` showing "X GB freed / Y GB potential" with a tiny avatar stack of 3 recent photo thumbnails inside the ring. Tap → quick-scan.
- Replace the row of stat numbers with three compact pill chips (Freed, Streak, Level) — single line each, icon + value.
- New "Quick actions" row: 2x2 grid of large rounded tiles with icon + one-word label: Scan, Swipe, Trim, Games. Color-coded with palette accents. Min 56pt touch target.
- New "Problematic photos" horizontal carousel: cards for categories ("Large", "Old", "Screenshots", "Similar") each showing 1 representative thumbnail + count + est. MB. Tap → starts a swipe round filtered to that focus (re-uses existing `loadRound` with target overrides).
- Keep game mode cards but compress to a single horizontal scroller below the carousel.
- Floating action button (bottom-right, above BottomNav) for "Quick scan" — kicks `runLibraryScan`.

## 3. Trim flow (new screen)

Today trimming happens silently as a swipe action. Add a dedicated visual trim experience reachable from Home → Trim tile and from the SwipeDeck "Trim" action when batch mode kicks in.

- New screen key `"trim"` added to the `Screen` union with a route through `setScreen`.
- New component `TrimScreen` in NativeTrimSwipeApp.tsx (or a new file `mobile/mobile/components/TrimScreen.tsx`).
- Layout:
  - Full-bleed photo at top (~55% of screen) using `expo-image`.
  - `BeforeAfterSlider` primitive — draggable handle that reveals the trimmed (re-encoded) version. While dragging, show a small badge ("−1.8 MB").
  - Preset chip row: "Remove EXIF", "Strip Location", "Compress 50%", "Compress 80%". Each chip shows live estimated savings via `estimateTrimSavings`.
  - Sticky bottom bar: "Trim photo" primary button (terracotta) + cancel. Haptic + `CelebrationBurst` on success.
  - Daily free-trim counter shown as a small inline meter (re-uses `trimsRemainingToday`).
- Wire from Home Trim tile and from a new "Customize trim" affordance inside the existing swipe flow (small icon, optional, does not change gestures).

## 4. Stats / Profile

Move from text rows to dashboard-style charts and badges.

- Rebuild `StatsScreen` body:
  - Header: level chip + `ProgressRing` of weekly goal (uses `WEEKLY_SAVINGS_TARGET_MB`).
  - 7-day `BarChart` of MB freed per day (replaces `ActivityBars` with a proper grouped bar: trim vs delete, sage vs terracotta).
  - Pie/donut: trim vs delete share of freed MB.
  - Top space hogs: horizontal list with thumbnail + size, derived from `actionLog`.
  - Achievements: re-skin `AchievementGrid` into card grid with icon, gradient accent, lock state, progress ring per badge. Add 4 new badges: First Trim, 1 GB Freed, 100 Trimmed, 7-day Streak.
  - "Share progress" CTA generates a card via existing `progressShareText` plus a rendered before/after thumbnail (reuse `Share.share`).
- Profile-ish settings entry collapses into a single row at bottom that pushes to existing `SettingsScreen` — no functional change to settings.

## 5. Onboarding

Replace the current single-page `OnboardingScreen` with a 4-step horizontal carousel (paged `ScrollView` + dot indicator).

- Slides:
  1. "Meet TrimSwipe" — large illustration (use existing icon, animated subtle float).
  2. "Before vs After" — `BeforeAfterSlider` demo on a bundled placeholder image, with a counter that animates from "12.4 GB" → "8.9 GB".
  3. "Swipe to decide" — animated card mock showing left/up/right hint arrows with the current gesture mapping.
  4. "Scan your library" — kicks `runLibraryScan` button; shows progress inline.
- Skip + Next buttons at the bottom. Haptic on page change. Calls `completeOnboarding` on finish.

## 6. Motion + polish

- Add `react-native-reanimated` shared-value driven transitions for: progress ring fill, bar chart bar grow, carousel paging, FAB scale-on-press, tile press depth.
- Reuse existing `CelebrationBurst` on milestone hits (first trim of day, 1 GB total, weekly goal).
- Skeleton placeholders (light shimmer using Reanimated) while `scanBusy` / `loading` are true on Home and Stats.
- Haptics: `Haptics.selectionAsync()` on chip/segment changes, `notificationAsync(Success)` on trim complete and onboarding finish.

## 7. What's explicitly NOT touched

- Web app under `src/` — unchanged.
- SwipeDeck gestures and action mapping (left=keep, up=trim, right=delete remain).
- Business logic in `lib/native-photo-source.ts`, `lib/native-store.ts`, trim/delete pipeline, RevenueCat, settings schema.
- `BottomNav` structure / tabs (visual restyle only — same screens).

## Technical notes

- All edits land in `mobile/mobile/`. Most changes are inside `components/NativeTrimSwipeApp.tsx`; new files: `constants/design.ts`, `components/ui/primitives.tsx`, optionally `components/TrimScreen.tsx`, `components/OnboardingCarousel.tsx`, `components/StatsDashboard.tsx`.
- No new npm packages required — `react-native-reanimated`, `react-native-gesture-handler`, `expo-haptics`, `expo-image`, `@expo/vector-icons` already in `package.json`.
- No native module additions, no `prebuild` needed, no iOS Podfile changes — keeps EAS build green.
- Charts hand-rolled with RN `View` + Reanimated (no `victory-native` / `react-native-svg-charts`) to avoid native deps.
- `BeforeAfterSlider` implemented with `PanResponder` + clipped `Animated.View`; no SVG required.
- Type-safe `Screen` union extended for `"trim"`; switch in render block updated; `BottomNav` icon list extended only if we expose Trim as a tab (currently planned as Home tile + deep entry, not a tab).

## Out of scope (call out for a follow-up if you want them)

- SwipeDeck full-screen immersive redo + new overlays.
- Animated Lottie assets.
- Dark mode pass (palette is light-warm today).
- Real chart library / SVG rendering.
