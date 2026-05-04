import registerRootComponent from 'expo/src/launch/registerRootComponent';
import { createWebView } from 'react-native-webview'; // Om du vill köra din Vite-app i en WebView
import React from 'react';
import { View, StyleSheet } from 'react-native';


const App = () => {
  return (
    <View style={styles.container}>
      {/* Här kan du senare lägga till en WebView som laddar din Vite-build */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 }
});

registerRootComponent(App);