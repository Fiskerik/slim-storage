import registerRootComponent from "expo/src/launch/registerRootComponent";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NativeTrimSwipeApp } from "./mobile/mobile/components/NativeTrimSwipeApp";

const App = () => {
  return (
    <SafeAreaProvider>
      <NativeTrimSwipeApp />
    </SafeAreaProvider>
  );
};

registerRootComponent(App);
