import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { Platform, View, StyleSheet, Text, Pressable, ActivityIndicator } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Server, {
  extractBundledAssets,
  getActiveServer,
  resolveAssetsPath,
} from "@dr.pogodin/react-native-static-server";
import * as FileSystem from "expo-file-system/legacy";
import { handleBridgeMessage } from "../lib/bridge";

const WEB_ROOT_ASSET_DIR = "www";
const PRIMARY_PORT = Number(process.env.EXPO_PUBLIC_STATIC_SERVER_PORT || 8765);
const FALLBACK_PORTS = [PRIMARY_PORT, 0, 8766, 8767, 8768].filter(
  (port, index, ports) => Number.isFinite(port) && ports.indexOf(port) === index,
);

type StaticServerInstance = InstanceType<typeof Server>;

type ServerState = {
  url: string | null;
  error: string | null;
};

async function pathExists(uri: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists;
}

async function prepareAndroidWebRoot(): Promise<string> {
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) {
    throw new Error("Expo document directory is unavailable");
  }

  const webRootUri = `${documentDirectory}${WEB_ROOT_ASSET_DIR}`;
  const markerUri = `${webRootUri}/index.html`;

  if (!(await pathExists(markerUri))) {
    console.log("[LocalWebView] Extracting bundled web assets", { webRootUri });
    if (await pathExists(webRootUri)) {
      await FileSystem.deleteAsync(webRootUri, { idempotent: true });
    }
    await FileSystem.makeDirectoryAsync(webRootUri, { intermediates: true });
    await extractBundledAssets(webRootUri, WEB_ROOT_ASSET_DIR);
  }

  return webRootUri;
}

async function getWebRootPath(): Promise<string> {
  if (Platform.OS === "android") {
    return prepareAndroidWebRoot();
  }

  return resolveAssetsPath(WEB_ROOT_ASSET_DIR);
}

function buildBridgeSetupScript(insets: {
  top: number;
  bottom: number;
  left: number;
  right: number;
}) {
  return `
    (function() {
      if (window.__SLIM_BRIDGE_INSTALLED__) {
        window.__SLIM_SAFE_AREA__ = {
          top: ${insets.top},
          bottom: ${insets.bottom},
          left: ${insets.left},
          right: ${insets.right}
        };
        window.dispatchEvent(new Event('slimBridgeReady'));
        return true;
      }

      window.__SLIM_NATIVE__ = true;
      window.__SLIM_BUNDLED_NATIVE__ = true;
      window.__SLIM_BRIDGE_VERSION__ = 2;
      window.__SLIM_BRIDGE_INSTALLED__ = true;
      window.__SLIM_SAFE_AREA__ = {
        top: ${insets.top},
        bottom: ${insets.bottom},
        left: ${insets.left},
        right: ${insets.right}
      };

      var pendingCallbacks = {};
      window.__slimBridgeCall = function(method, data) {
        return new Promise(function(resolve, reject) {
          if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) {
            reject(new Error('Native WebView bridge unavailable'));
            return;
          }

          var id = Math.random().toString(36).slice(2) + Date.now();
          pendingCallbacks[id] = { resolve: resolve, reject: reject };
          console.log('[SlimBridge] web -> native', method, data || {});
          window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, method: method, data: data || {} }));
          setTimeout(function() {
            if (pendingCallbacks[id]) {
              pendingCallbacks[id].reject(new Error('Bridge timeout'));
              delete pendingCallbacks[id];
            }
          }, 30000);
        });
      };

      function receiveBridgeMessage(e) {
        try {
          var msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (msg && msg.__bridge_response && pendingCallbacks[msg.id]) {
            console.log('[SlimBridge] native -> web', msg.error ? 'error' : 'ok', msg.id);
            if (msg.error) {
              pendingCallbacks[msg.id].reject(new Error(msg.error));
            } else {
              pendingCallbacks[msg.id].resolve(msg.result);
            }
            delete pendingCallbacks[msg.id];
          }
        } catch(err) {}
      }

      window.addEventListener('message', receiveBridgeMessage);
      document.addEventListener('message', receiveBridgeMessage);
      window.dispatchEvent(new Event('slimBridgeReady'));
      true;
    })();
  `;
}

async function startStaticServer(): Promise<{ server: StaticServerInstance; url: string }> {
  const activeServer = getActiveServer?.();
  if (activeServer?.origin) {
    console.log("[LocalWebView] Reusing active static server", { origin: activeServer.origin });
    return { server: activeServer, url: `${activeServer.origin}/index.html` };
  }

  const fileDir = await getWebRootPath();
  let lastError: unknown;

  for (const port of FALLBACK_PORTS) {
    const server = new Server({
      fileDir,
      hostname: "127.0.0.1",
      port,
      stopInBackground: Platform.OS === "ios" ? 1000 : false,
      extraConfig: `
        server.modules += ("mod_rewrite")
        url.rewrite-if-not-file = ("^/(.*)$" => "/index.html")
      `,
    });

    server.addStateListener?.((state: string, details: string, error?: Error) => {
      console.log("[LocalWebView] Static server state", { state, details, error: error?.message });
    });

    try {
      const origin = await server.start(`TrimSwipe web root on port ${port}`);
      console.log("[LocalWebView] Static server started", { origin, fileDir, port });
      return { server, url: `${origin}/index.html` };
    } catch (error) {
      lastError = error;
      console.log("[LocalWebView] Static server failed", { port, error });
      await server.stop().catch(() => undefined);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to start local static server");
}

export function LocalWebViewScreen() {
  const webViewRef = useRef<WebView>(null);
  const serverRef = useRef<StaticServerInstance | null>(null);
  const insets = useSafeAreaInsets();
  const [serverState, setServerState] = useState<ServerState>({ url: null, error: null });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const bootServer = useCallback(() => {
    let cancelled = false;
    setServerState({ url: null, error: null });

    startStaticServer()
      .then(({ server, url }) => {
        if (cancelled) {
          server.stop().catch(() => undefined);
          return;
        }
        serverRef.current = server;
        setServerState({ url, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to start local web server";
        console.log("[LocalWebView] Unable to start static server", { error });
        setServerState({ url: null, error: message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancelBoot = bootServer();
    return () => {
      cancelBoot();
      serverRef.current?.stop().catch(() => undefined);
      serverRef.current = null;
    };
  }, [bootServer]);

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const request = JSON.parse(event.nativeEvent.data);
      const response = await handleBridgeMessage(request);
      webViewRef.current?.postMessage(JSON.stringify(response));
    } catch (err) {
      console.warn("[Bridge] Error handling message:", err);
    }
  }, []);

  const injectedJS = useMemo(
    () =>
      buildBridgeSetupScript({
        top: insets.top,
        bottom: insets.bottom,
        left: insets.left,
        right: insets.right,
      }),
    [insets.bottom, insets.left, insets.right, insets.top],
  );

  const retry = useCallback(() => {
    setLoadError(null);
    setReloadKey((key) => key + 1);
    if (!serverState.url) {
      bootServer();
    }
  }, [bootServer, serverState.url]);

  return (
    <View style={[styles.container, { backgroundColor: "#0a0a0a" }]}>
      {serverState.error || loadError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Couldn’t load TrimSwipe</Text>
          <Text style={styles.errorText}>{loadError || serverState.error}</Text>
          <Pressable onPress={retry} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : serverState.url ? (
        <WebView
          key={reloadKey}
          ref={webViewRef}
          source={{ uri: serverState.url }}
          style={styles.webview}
          onMessage={onMessage}
          onError={(event) => {
            const description = event.nativeEvent.description || "Unknown error";
            console.log("[LocalWebView] Load error:", description);
            setLoadError(description);
          }}
          injectedJavaScript={injectedJS}
          onLoadEnd={() => {
            webViewRef.current?.injectJavaScript(injectedJS);
          }}
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>Loading TrimSwipe…</Text>
            </View>
          )}
          decelerationRate="normal"
          contentMode="mobile"
          allowsLinkPreview={false}
          originWhitelist={["http://127.0.0.1:*", "http://localhost:*"]}
        />
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Starting TrimSwipe…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#0a0a0a",
  },
  loadingText: { color: "#cbd5e1", fontSize: 14 },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
  errorTitle: { color: "#f8fafc", fontSize: 20, fontWeight: "600" },
  errorText: { color: "#94a3b8", fontSize: 14, textAlign: "center" },
  retryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  retryButtonText: { color: "#fff", fontWeight: "600" },
});
