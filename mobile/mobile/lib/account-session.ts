import * as FileSystem from "expo-file-system/legacy";

export type AccountSession = {
  signedIn: boolean;
};

const ACCOUNT_SESSION_FILE = "trimswipe-account-session-v1.json";
const DEFAULT_SESSION: AccountSession = { signedIn: true };

let cachedSession: AccountSession | null = null;
let loadingSession: Promise<AccountSession> | null = null;

function sessionUri(): string | null {
  return FileSystem.documentDirectory
    ? `${FileSystem.documentDirectory}${ACCOUNT_SESSION_FILE}`
    : null;
}

export async function loadAccountSession(): Promise<AccountSession> {
  if (cachedSession) return cachedSession;
  if (loadingSession) return loadingSession;

  loadingSession = (async () => {
    const uri = sessionUri();
    if (!uri) {
      cachedSession = DEFAULT_SESSION;
      return cachedSession;
    }

    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        const value = JSON.parse(await FileSystem.readAsStringAsync(uri)) as {
          signedIn?: unknown;
        };
        cachedSession = { signedIn: value.signedIn === true };
        return cachedSession;
      }
    } catch (error) {
      console.log("[account] session load failed", error);
    }

    // Preserve the behavior existing installs had before the account switch was added.
    cachedSession = DEFAULT_SESSION;
    return cachedSession;
  })().finally(() => {
    loadingSession = null;
  });

  return loadingSession;
}

export async function setAccountSignedIn(signedIn: boolean): Promise<AccountSession> {
  const next = { signedIn };
  cachedSession = next;
  const uri = sessionUri();
  if (uri) {
    try {
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(next));
    } catch (error) {
      console.log("[account] session save failed", error);
    }
  }
  return next;
}
