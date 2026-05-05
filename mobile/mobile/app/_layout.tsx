import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WebViewScreen } from '../components/WebViewScreen';
import { initializePurchases } from '../lib/purchases';

export default function RootLayout() {
  useEffect(() => {
    initializePurchases().then((ok) => {
      console.log('[App] RevenueCat initialized:', ok);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <WebViewScreen />
    </SafeAreaProvider>
  );
}
