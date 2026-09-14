import { Slot } from 'expo-router';
import { I18nextProvider } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import i18n from '../lib/i18n';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <Slot />
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
