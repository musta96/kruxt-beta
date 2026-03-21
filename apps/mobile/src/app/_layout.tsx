import React, { useCallback, useEffect } from "react";
import { StatusBar, StyleSheet, View, ActivityIndicator, Text } from "react-native";
import { Slot, SplashScreen, useRouter, useSegments } from "expo-router";
import { useFonts } from "expo-font";

import { SupabaseProvider } from "../contexts/supabase-context";
import { AuthProvider, useAuth } from "../contexts/auth-context";

// Prevent splash screen from auto-hiding until fonts load
SplashScreen.preventAutoHideAsync();

// ---------------------------------------------------------------------------
// Auth-aware navigator: redirects based on auth + onboarding state
// ---------------------------------------------------------------------------

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuth = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "(onboarding)";

    if (!user && !inAuth) {
      router.replace("/(auth)/welcome");
    } else if (user) {
      // Check if onboarding is complete via user metadata
      const onboarded = user.user_metadata?.onboarded === true;
      if (!onboarded && !inOnboarding) {
        router.replace("/(onboarding)/profile");
      } else if (onboarded && (inAuth || inOnboarding)) {
        router.replace("/(tabs)");
      }
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#35D0FF" />
      </View>
    );
  }

  return <Slot />;
}

// ---------------------------------------------------------------------------
// Root layout — loads fonts, wraps app in providers
// ---------------------------------------------------------------------------

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Oswald: require("../../assets/fonts/Oswald-Regular.ttf"),
    "Oswald-Bold": require("../../assets/fonts/Oswald-Bold.ttf"),
    Sora: require("../../assets/fonts/Sora-Regular.ttf"),
    "Sora-SemiBold": require("../../assets/fonts/Sora-SemiBold.ttf"),
    "Sora-Bold": require("../../assets/fonts/Sora-Bold.ttf"),
    "Roboto Mono": require("../../assets/fonts/RobotoMono-Regular.ttf"),
    "RobotoMono-Bold": require("../../assets/fonts/RobotoMono-Bold.ttf"),
  });

  const onLayoutReady = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    onLayoutReady();
  }, [onLayoutReady]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#35D0FF" />
      </View>
    );
  }

  if (fontError) {
    // Graceful fallback — app still works with system fonts
    console.warn("Font loading error:", fontError.message);
  }

  return (
    <SupabaseProvider>
      <AuthProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0E1116" />
        <View style={styles.root}>
          <RootNavigator />
        </View>
      </AuthProvider>
    </SupabaseProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0E1116",
  },
  loader: {
    flex: 1,
    backgroundColor: "#0E1116",
    alignItems: "center",
    justifyContent: "center",
  },
});
