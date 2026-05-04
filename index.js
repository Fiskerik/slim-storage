import registerRootComponent from 'expo/src/launch/registerRootComponent';
import { WebView } from 'react-native-webview';
import React from 'react';
import { SafeAreaView, StyleSheet, StatusBar, Platform } from 'react-native';

const App = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <WebView 
        // Byt ut URL:en nedan till din faktiska sajt (t.ex. på Vercel/Netlify)
        source={{ uri: 'https://din-webb-url.com' }} 
        style={{ flex: 1 }}
        startInLoadingState={true}
        // Tillåt inline-video och andra mobilfunktioner
        allowsInlineMediaPlayback={true}
        domStorageEnabled={true}
        javaScriptEnabled={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff',
    // Hanterar padding för notch/statusfält på iOS
    paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight 
  }
});

registerRootComponent(App);