import registerRootComponent from 'expo/src/launch/registerRootComponent';
import React, { useState } from 'react';
import { WebView } from 'react-native-webview';
import { SafeAreaView, ActivityIndicator, Text, View } from 'react-native';

const App = () => {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Failed to load. Check your connection.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <WebView
        source={{ uri: 'https://trimswipe.lovable.app' }}
        style={{ flex: 1 }}
        onError={() => setError(true)}
        onHttpError={() => setError(true)}
        startInLoadingState
        renderLoading={() => <ActivityIndicator style={{ flex: 1 }} />}
      />
    </SafeAreaView>
  );
};

registerRootComponent(App);
