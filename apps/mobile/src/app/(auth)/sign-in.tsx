import React, { useState, useCallback } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { darkTheme, Button, Input } from "@kruxt/ui";
import { useSupabase } from "../../contexts/supabase-context";

const theme = darkTheme;

export default function SignInScreen() {
  const router = useRouter();
  const supabase = useSupabase();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = useCallback(async () => {
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
    }
    // Auth state change will trigger redirect via root layout
  }, [email, password, supabase]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text style={styles.backText}>{"\u2190"} Back</Text>
          </Pressable>

          <Text style={styles.heading} accessibilityRole="header">
            Sign In
          </Text>
          <Text style={styles.subtitle}>
            Welcome back to KRUXT. Log your legend.
          </Text>

          {error && (
            <View style={styles.errorBanner} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Input
            theme={theme}
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            accessibilityLabel="Email address"
            style={styles.input}
          />

          <Input
            theme={theme}
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            accessibilityLabel="Password"
            style={styles.input}
          />

          <Pressable
            onPress={() => router.push("/(auth)/forgot-password")}
            style={styles.forgotLink}
            accessibilityLabel="Forgot password"
            accessibilityRole="link"
          >
            <Text style={styles.linkText}>Forgot password?</Text>
          </Pressable>

          <Button
            theme={theme}
            variant="primary"
            size="lg"
            label="Sign In"
            onPress={handleSignIn}
            loading={loading}
            disabled={loading}
            accessibilityLabel="Sign in"
            style={styles.submitButton}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Pressable
              onPress={() => router.replace("/(auth)/sign-up")}
              accessibilityLabel="Go to sign up"
              accessibilityRole="link"
            >
              <Text style={styles.linkText}>Sign Up</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0E1116",
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  backButton: {
    marginBottom: 24,
    alignSelf: "flex-start",
  },
  backText: {
    fontFamily: "Sora",
    fontSize: 15,
    color: "#35D0FF",
  },
  heading: {
    fontFamily: "Oswald",
    fontSize: 32,
    fontWeight: "700",
    color: "#F4F6F8",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Sora",
    fontSize: 15,
    color: "#A7B1C2",
    marginBottom: 32,
  },
  errorBanner: {
    backgroundColor: "rgba(255, 107, 107, 0.15)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.3)",
  },
  errorText: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#FF6B6B",
  },
  input: {
    marginBottom: 16,
  },
  forgotLink: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },
  linkText: {
    fontFamily: "Sora",
    fontSize: 14,
    color: "#35D0FF",
    fontWeight: "600",
  },
  submitButton: {
    width: "100%",
    marginBottom: 24,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  footerText: {
    fontFamily: "Sora",
    fontSize: 14,
    color: "#A7B1C2",
  },
});
