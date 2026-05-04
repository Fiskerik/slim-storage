import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WebViewScreen } from '../components/WebViewScreen';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <WebViewScreen />
    </SafeAreaProvider>
  );
}
