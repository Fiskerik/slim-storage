import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NativeTrimSwipeApp } from '../components/NativeTrimSwipeApp';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NativeTrimSwipeApp />
    </SafeAreaProvider>
  );
}
