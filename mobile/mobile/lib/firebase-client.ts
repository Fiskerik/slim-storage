import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import * as ReactNativeFirebaseAuth from "@firebase/auth";
import {
  getAuth,
  initializeAuth,
  signInAnonymously,
  type Auth,
  type Persistence,
  type User,
} from "@firebase/auth";
import { getFunctions, type Functions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const requiredConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
];

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseFunctions: Functions | null = null;

// The package's React Native runtime exports this helper, but its top-level
// TypeScript condition currently exposes only the shared declaration surface.
const getReactNativePersistence = (
  ReactNativeFirebaseAuth as typeof ReactNativeFirebaseAuth & {
    getReactNativePersistence(storage: typeof AsyncStorage): Persistence;
  }
).getReactNativePersistence;

export function isFirebaseConfigured(): boolean {
  return requiredConfig.every((value) => typeof value === "string" && value.length > 0);
}

function initializeFirebase(): { app: FirebaseApp; auth: Auth; functions: Functions } | null {
  if (!isFirebaseConfigured()) return null;
  if (firebaseApp && firebaseAuth && firebaseFunctions) {
    return { app: firebaseApp, auth: firebaseAuth, functions: firebaseFunctions };
  }

  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  try {
    firebaseAuth = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Fast Refresh or another module may already have initialized Auth.
    firebaseAuth = getAuth(firebaseApp);
  }
  firebaseFunctions = getFunctions(
    firebaseApp,
    process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION || "europe-west1",
  );
  return { app: firebaseApp, auth: firebaseAuth, functions: firebaseFunctions };
}

export async function getFirebaseSession(): Promise<{
  user: User;
  functions: Functions;
} | null> {
  const initialized = initializeFirebase();
  if (!initialized) return null;

  const user = initialized.auth.currentUser ?? (await signInAnonymously(initialized.auth)).user;
  return { user, functions: initialized.functions };
}
