import React, { useCallback, useState } from "react";
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
import { Button, Input } from "@kruxt/ui";
import { darkTheme } from "@kruxt/ui/theme";
import { createMobileSupabaseClient, MobileAuthService } from "../services";

const theme = darkTheme;

const MIN_PASSWORD_LENGTH = 8;

export function ChangePasswordScreen() {
  const router = useRouter();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && next !== confirm;
  const sameAsCurrent = next.length > 0 && next === current;

  const canSave =
    !saving &&
    current.length > 0 &&
    next.length >= MIN_PASSWORD_LENGTH &&
    next === confirm &&
    !sameAsCurrent;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    setFormError(null);
    try {
      const auth = new MobileAuthService(createMobileSupabaseClient());
      await auth.changePassword(current, next);
      setSuccess(true);
      setSaving(false);
      // Brief confirmation, then return to Profile.
      setTimeout(() => router.back(), 900);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      setFormError(
        code === "AUTH_REAUTH_FAILED"
          ? "Current password is incorrect."
          : e instanceof Error
            ? e.message
            : "Unable to change password.",
      );
      setSaving(false);
    }
  }, [canSave, current, next, router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.headerBack}>{"‹"}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>CHANGE PASSWORD</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            theme={theme}
            label="Current Password"
            placeholder="Your current password"
            value={current}
            onChangeText={(t) => {
              setCurrent(t);
              if (formError) setFormError(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            style={styles.field}
          />

          <Input
            theme={theme}
            label="New Password"
            placeholder="At least 8 characters"
            value={next}
            onChangeText={setNext}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            error={
              tooShort
                ? "Must be at least 8 characters."
                : sameAsCurrent
                  ? "Choose a password different from your current one."
                  : undefined
            }
            style={styles.field}
          />

          <Input
            theme={theme}
            label="Confirm New Password"
            placeholder="Re-enter new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            error={mismatch ? "Passwords don't match." : undefined}
            style={styles.field}
          />

          {formError && <Text style={styles.formError}>{formError}</Text>}
          {success && <Text style={styles.success}>Password updated.</Text>}

          <Button
            theme={theme}
            variant="primary"
            size="lg"
            label="Update Password"
            onPress={handleSave}
            loading={saving}
            disabled={!canSave}
            style={styles.saveButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E1116" },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(141,153,174,0.1)",
  },
  headerBack: { fontSize: 30, color: "#35D0FF", width: 32, lineHeight: 32 },
  headerTitle: {
    flex: 1,
    fontFamily: "Oswald",
    fontSize: 20,
    fontWeight: "700",
    color: "#F4F6F8",
    letterSpacing: 2,
    textAlign: "center",
  },
  headerSpacer: { width: 32 },
  scroll: { padding: 20, paddingBottom: 48 },
  field: { marginBottom: 20 },
  formError: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#FF6B6B",
    marginTop: 8,
    marginBottom: 4,
  },
  success: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#35D0FF",
    marginTop: 8,
    marginBottom: 4,
  },
  saveButton: { width: "100%", marginTop: 24 },
});
