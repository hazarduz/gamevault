import React from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppModeProvider } from "@/state/AppModeContext";
import { RootNavigator } from "@/navigation/RootNavigator";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppModeProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AppModeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
