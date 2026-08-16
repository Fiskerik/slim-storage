# TrimSwipe cloud reminders

The repository contains both sides of the reminder system:

- `mobile/mobile/lib/remote-reminders.ts` registers the installation and syncs active Pro automation schedules.
- `firebase/functions/src/index.ts` stores schedules, sends due reminders through Expo Push Service, and checks delivery receipts.
- Firestore is server-only; direct client reads and writes are denied.

## Required Firebase console setup

1. Open the new TrimSwipe Firebase project.
2. Upgrade it to the Blaze plan so Cloud Functions can call Expo and Cloud Scheduler can run.
3. Under **Build > Authentication > Sign-in method**, enable **Anonymous**.
4. Under **Build > Firestore Database**, create the database in Production mode. Choose the European location closest to the function region when possible.
5. The Firebase Web app named `TrimSwipe Mobile` has already been registered. This is correct even though TrimSwipe is an Expo mobile app; the app uses the Firebase JavaScript SDK for Auth and callable Functions.
6. Its public configuration has already been written to the ignored `mobile/mobile/.env.local` file. Use `mobile/mobile/.env.example` as the template if it ever needs to be recreated.

The required public app values are:

```text
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
```

Keep `EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION=europe-west1` unless the source code region is changed too. These Firebase web configuration values identify the project; they are not service-account secrets. Do not put an Admin SDK JSON file in the mobile app.

## Required Expo setup

1. Open the TrimSwipe project in the EAS Dashboard.
2. Verify that iOS has a Push Notifications key under **Credentials**. If it is absent, run `eas credentials -p ios` and let EAS create one.
3. Enable **Enhanced Push Security** for the project.
4. Create an Expo personal or robot access token with access to the TrimSwipe EAS project.
5. Store that token in Firebase Functions Secret Manager as `EXPO_ACCESS_TOKEN`; never put it in an `EXPO_PUBLIC_` variable or `.env.local`.

For Android later, register the Android app `com.fiskerik.trimswipe` in Firebase and upload its FCM V1 service-account credential to EAS. This is separate from the Firebase web-app values used by the client.

## Link and deploy the Firebase project

The repository is already linked to Firebase project `trimswipe` in `.firebaserc`. Deploy from the repository root after completing the console prerequisites:

```powershell
cd firebase/functions
npx firebase login
npx firebase functions:secrets:set EXPO_ACCESS_TOKEN
npm run build
npx firebase deploy --only functions,firestore:rules,firestore:indexes
```

The deploy creates:

- `syncReminderInstallation`: authenticated callable registration endpoint.
- `sendDueCleanupReminders`: runs every 5 minutes through Cloud Scheduler.
- `checkCleanupReminderReceipts`: removes installations that Expo/APNs/FCM reports as unregistered.

## Configure EAS build environments

Add the same six `EXPO_PUBLIC_FIREBASE_*` values and the functions region to the EAS `preview` and `production` environments. A local `.env.local` file is not automatically a production secret source.

The Firestore index deployment also enables TTL cleanup for abandoned installations and old push-receipt records; no separate Google Cloud TTL setup is required.

## Test

1. Make a new development or preview build; remote push tokens cannot be fully validated in a browser.
2. Install it on a physical iPhone.
3. Open **Auto**, activate a schedule a few minutes in the future, and grant notification permission.
4. In Firestore, confirm that `pushInstallations/{anonymousUid}` contains the Expo token and `nextSendAt`.
5. For a quick test, temporarily change `nextSendAt` in Firestore to a timestamp in the past and run `sendDueCleanupReminders` from Google Cloud Console, or wait for the next 5-minute Scheduler run.
6. Put the app in the background and confirm that the push appears. Tapping it should open Pro automation.

Delivery is best-effort: the user can revoke permission and Apple or Google may delay or suppress a notification. The backend handles invalid installations, but no push system can force a notification onto a device.
