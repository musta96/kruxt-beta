import React, { useEffect, useRef } from "react";
import {
  Animated,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { darkTheme, Button } from "@kruxt/ui";

const theme = darkTheme;

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Glow effect */}
        <View style={styles.glowOuter}>
          <View style={styles.glowInner} />
        </View>

        <Animated.View
          style={[
            styles.brandContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Text style={styles.logo} accessibilityRole="header">
            KRUXT
          </Text>
          <Text style={styles.tagline}>No log, no legend.</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
        <Button
          theme={theme}
          variant="primary"
          size="lg"
          label="Get Started"
          onPress={() => router.push("/(auth)/sign-up")}
          accessibilityLabel="Get started with KRUXT"
          style={styles.primaryButton}
        />
        <Button
          theme={theme}
          variant="secondary"
          size="lg"
          label="Sign In"
          onPress={() => router.push("/(auth)/sign-in")}
          accessibilityLabel="Sign in to KRUXT"
          style={styles.secondaryButton}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0E1116",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  glowOuter: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(53, 208, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  glowInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(53, 208, 255, 0.12)",
  },
  brandContainer: {
    alignItems: "center",
  },
  logo: {
    fontFamily: "Oswald",
    fontSize: 64,
    fontWeight: "700",
    color: "#F4F6F8",
    letterSpacing: 6,
  },
  tagline: {
    fontFamily: "Sora",
    fontSize: 16,
    fontStyle: "italic",
    color: "#A7B1C2",
    marginTop: 12,
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 12,
  },
  primaryButton: {
    width: "100%",
  },
  secondaryButton: {
    width: "100%",
  },
});
