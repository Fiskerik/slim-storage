import registerRootComponent from 'expo/src/launch/registerRootComponent';
import React from 'react';
import { WebView } from 'react-native-webview';
import { SafeAreaView, StyleSheet } from 'react-native';

const App = () => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <WebView 
        source={{ uri: 'https://trimswipe.lovable.app' }} 
        style={{ flex: 1 }}
      />
    </SafeAreaView>
  );
};

registerRootComponent(App);