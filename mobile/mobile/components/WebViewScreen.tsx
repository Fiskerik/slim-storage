import { useRef, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { handleBridgeMessage } from '../lib/bridge';

const WEB_URL = 'https://trimswipe.lovable.app';

export function WebViewScreen() {
  const webViewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const request = JSON.parse(event.nativeEvent.data);
      const response = await handleBridgeMessage(request);
      webViewRef.current?.postMessage(JSON.stringify(response));
    } catch (err) {
      console.warn('[Bridge] Error handling message:', err);
    }
  }, []);

  // Inject a script that tells the web app it's inside a native WebView
  // and sets up the message listener for bridge responses
  const injectedJS = `
    (function() {
      window.__SLIM_NATIVE__ = true;
      window.__SLIM_SAFE_AREA__ = {
        top: ${insets.top},
        bottom: ${insets.bottom},
        left: ${insets.left},
        right: ${insets.right}
      };

      // Bridge response handler
      var pendingCallbacks = {};
      window.__slimBridgeCall = function(method, data) {
        return new Promise(function(resolve, reject) {
          var id = Math.random().toString(36).slice(2) + Date.now();
          pendingCallbacks[id] = { resolve: resolve, reject: reject };
          window.ReactNativeWebView.postMessage(JSON.stringify({
            id: id,
            method: method,
            data: data || {}
          }));
          // Timeout after 30s
          setTimeout(function() {
            if (pendingCallbacks[id]) {
              pendingCallbacks[id].reject(new Error('Bridge timeout'));
              delete pendingCallbacks[id];
            }
          }, 30000);
        });
      };

      // Listen for responses from native side
      var origHandler = window.onmessage;
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

      true; // Required for iOS
    })();
  `;

  return (
    <View style={[styles.container, { backgroundColor: '#0a0a0a' }]}>
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        style={styles.webview}
        onMessage={onMessage}
        injectedJavaScriptBeforeContentLoaded={injectedJS}
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        decelerationRate="normal"
        contentMode="mobile"
        allowsLinkPreview={false}
        // Extend content behind safe areas — web app handles its own padding
        // via the __SLIM_SAFE_AREA__ values
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
