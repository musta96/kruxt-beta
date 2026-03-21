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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const supabase = useSupabase();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = useCallback(async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
  }, [email, supabase]);

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
            Reset Password
          </Text>
          <Text style={styles.subtitle}>
            Enter your email and we'll send you a link to reset your password.
          </Text>

          {sent ? (
            <View style={styles.successBanner} accessibilityRole="alert">
              <Text style={styles.successText}>
                Check your inbox! We've sent a password reset link to{" "}
                {email.trim()}.
              </Text>
              <Pressable
                onPress={() => router.replace("/(auth)/sign-in")}
                style={styles.returnLink}
                accessibilityLabel="Return to sign in"
                accessibilityRole="link"
              >
                <Text style={styles.linkText}>Return to Sign In</Text>
              </Pressable>
            </View>
          ) : (
            <>
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

              <Button
                theme={theme}
                variant="primary"
                size="lg"
                label="Send Reset Link"
                onPress={handleReset}
                loading={loading}
                disabled={loading}
                accessibilityLabel="Send password reset link"
                style={styles.submitButton}
              />
            </>
          )}
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
  successBanner: {
    backgroundColor: "rgba(75, 213, 156, 0.12)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(75, 213, 156, 0.3)",
  },
  successText: {
    fontFamily: "Sora",
    fontSize: 14,
    color: "#4BD59C",
    lineHeight: 20,
  },
  returnLink: {
    marginTop: 16,
  },
  linkText: {
    fontFamily: "Sora",
    fontSize: 14,
    color: "#35D0FF",
    fontWeight: "600",
  },
  input: {
    marginBottom: 24,
  },
  submitButton: {
    width: "100%",
  },
});
