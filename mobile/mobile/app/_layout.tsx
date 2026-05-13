import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocalWebViewScreen } from '../components/LocalWebViewScreen';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <LocalWebViewScreen />
    </SafeAreaProvider>
  );
}
