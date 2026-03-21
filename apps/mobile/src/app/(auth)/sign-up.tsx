import React, { useState, useCallback, useMemo } from "react";
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

// ---------------------------------------------------------------------------
// Password strength helper
// ---------------------------------------------------------------------------

function getPasswordStrength(pw: string): { label: string; ratio: number; color: string } {
  if (pw.length === 0) return { label: "", ratio: 0, color: "transparent" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { label: "Weak", ratio: 0.2, color: "#FF6B6B" };
  if (score <= 2) return { label: "Fair", ratio: 0.4, color: "#FFC85A" };
  if (score <= 3) return { label: "Good", ratio: 0.6, color: "#FFC85A" };
  if (score <= 4) return { label: "Strong", ratio: 0.8, color: "#4BD59C" };
  return { label: "Excellent", ratio: 1, color: "#4BD59C" };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SignUpScreen() {
  const router = useRouter();
  const supabase = useSupabase();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSignUp = useCallback(async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
    }
    // Auth state change will trigger redirect via root layout
  }, [email, password, confirmPassword, supabase]);

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
            Create Account
          </Text>
          <Text style={styles.subtitle}>
            Start logging your legend today.
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
            placeholder="Create a strong password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            accessibilityLabel="Password"
            style={styles.input}
          />

          {/* Password strength indicator */}
          {password.length > 0 && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthTrack}>
                <View
                  style={[
                    styles.strengthFill,
                    {
                      width: `${strength.ratio * 100}%`,
                      backgroundColor: strength.color,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>
                {strength.label}
              </Text>
            </View>
          )}

          <Input
            theme={theme}
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            error={
              confirmPassword.length > 0 && password !== confirmPassword
                ? "Passwords do not match"
                : undefined
            }
            accessibilityLabel="Confirm password"
            style={styles.input}
          />

          <Button
            theme={theme}
            variant="primary"
            size="lg"
            label="Create Account"
            onPress={handleSignUp}
            loading={loading}
            disabled={loading}
            accessibilityLabel="Create account"
            style={styles.submitButton}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Pressable
              onPress={() => router.replace("/(auth)/sign-in")}
              accessibilityLabel="Go to sign in"
              accessibilityRole="link"
            >
              <Text style={styles.linkText}>Sign In</Text>
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
  strengthContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: -8,
    gap: 8,
  },
  strengthTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(141, 153, 174, 0.2)",
    overflow: "hidden",
  },
  strengthFill: {
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontFamily: "Sora",
    fontSize: 12,
    fontWeight: "600",
    width: 64,
    textAlign: "right",
  },
  submitButton: {
    width: "100%",
    marginTop: 8,
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
  linkText: {
    fontFamily: "Sora",
    fontSize: 14,
    color: "#35D0FF",
    fontWeight: "600",
  },
});
