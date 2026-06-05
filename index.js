import registerRootComponent from "expo/src/launch/registerRootComponent";
import React from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LocalWebViewScreen } from "./mobile/mobile/components/LocalWebViewScreen";

const App = () => {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <LocalWebViewScreen />
    </SafeAreaProvider>
  );
};

registerRootComponent(App);
