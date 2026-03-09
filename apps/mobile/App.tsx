import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { NativeApp } from "./src/native/NativeApp";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NativeApp />
    </SafeAreaProvider>
  );
}
