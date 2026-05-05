import { useRef, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Text, Pressable, ActivityIndicator } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { handleBridgeMessage } from '../lib/bridge';

const WEB_URL = 'https://trimswipe.lovable.app';

export function WebViewScreen() {
  const webViewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const [isConnected, setIsConnected] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected;
      console.log('[WebView] NetInfo changed:', connected);
      setIsConnected(connected);
    });
    return () => unsub();
  }, []);

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const request = JSON.parse(event.nativeEvent.data);
      const response = await handleBridgeMessage(request);
      webViewRef.current?.postMessage(JSON.stringify(response));
    } catch (err) {
      console.warn('[Bridge] Error handling message:', err);
    }
  }, []);

  const injectedJS = `
    (function() {
      window.__SLIM_NATIVE__ = true;
      window.__SLIM_SAFE_AREA__ = {
        top: ${insets.top},
        bottom: ${insets.bottom},
        left: ${insets.left},
        right: ${insets.right}
      };
      var pendingCallbacks = {};
      window.__slimBridgeCall = function(method, data) {
        return new Promise(function(resolve, reject) {
          var id = Math.random().toString(36).slice(2) + Date.now();
          pendingCallbacks[id] = { resolve: resolve, reject: reject };
          window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, method: method, data: data || {} }));
          setTimeout(function() {
            if (pendingCallbacks[id]) {
              pendingCallbacks[id].reject(new Error('Bridge timeout'));
              delete pendingCallbacks[id];
            }
          }, 30000);
        });
      };
      window.addEventListener('message', function(e) {
        try {
          var msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (msg && msg.__bridge_response && pendingCallbacks[msg.id]) {
            if (msg.error) {
              pendingCallbacks[msg.id].reject(new Error(msg.error));
            } else {
              pendingCallbacks[msg.id].resolve(msg.result);
            }
            delete pendingCallbacks[msg.id];
          }
        } catch(err) {}
      });
      window.__SLIM_NATIVE__ = true;
      window.dispatchEvent(new Event('slimBridgeReady'));
      true;
    })();
  `;

  return (
    <View style={[styles.container, { backgroundColor: '#0a0a0a' }]}> 
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>You are offline. Trying to reconnect…</Text>
        </View>
      )}
      {loadError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Couldn’t load TrimSwipe</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable onPress={() => { setLoadError(null); setReloadKey((k) => k + 1); }} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          key={reloadKey}
          ref={webViewRef}
          source={{ uri: WEB_URL }}
          style={styles.webview}
          onMessage={onMessage}
          onError={(event) => {
            const description = event.nativeEvent.description || 'Unknown error';
            console.log('[WebView] Load error:', description);
            setLoadError(description);
          }}
          injectedJavaScriptBeforeContentLoaded={injectedJS}
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
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  offlineBanner: { backgroundColor: '#78350f', paddingVertical: 8, paddingHorizontal: 12 },
  offlineText: { color: '#fff7ed', fontSize: 12, textAlign: 'center' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#0a0a0a' },
  loadingText: { color: '#cbd5e1', fontSize: 14 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  errorTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '600' },
  errorText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
  retryButton: { backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12 },
  retryButtonText: { color: '#fff', fontWeight: '600' },
});
