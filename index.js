import registerRootComponent from 'expo/src/launch/registerRootComponent';
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocalWebViewScreen } from './mobile/mobile/components/LocalWebViewScreen';
import { initializePurchases } from './mobile/mobile/lib/purchases';

const App = () => {
  useEffect(() => {
    initializePurchases().then((ok) => {
      console.log('[App] RevenueCat initialized:', ok);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <LocalWebViewScreen />
    </SafeAreaProvider>
  );
};

registerRootComponent(App);
