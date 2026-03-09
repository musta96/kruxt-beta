import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card, Field, Heading, Pill, ScreenScroll } from "../ui";
import { palette, spacing } from "../theme";
import { useNativeSession } from "../session";

type AuthMode = "signin" | "signup";

export function AuthLandingScreen() {
  const { signIn, signUp } = useNativeSession();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        await signUp({ email, password, displayName, username });
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenScroll>
      <Heading
        eyebrow="KRUXT Mobile"
        title="No log, no legend."
        subtitle="Native member shell for feed, logging, profile, and gym-linked access."
      />

      <Card>
        <View style={styles.pillRow}>
          <Pill tone="primary">Members</Pill>
          <Pill>Gym-linked auth</Pill>
          <Pill>Native baseline</Pill>
        </View>
        <Text style={styles.copy}>
          Founder and gym operations stay on web. The mobile app is the member-facing surface: claim account,
          log sessions, review feed, and manage your own profile.
        </Text>
      </Card>

      <Card>
        <View style={styles.modeRow}>
          <Button tone={mode === "signin" ? "primary" : "secondary"} onPress={() => setMode("signin")}>
            Sign in
          </Button>
          <Button tone={mode === "signup" ? "primary" : "secondary"} onPress={() => setMode("signup")}>
            Sign up
          </Button>
        </View>

        {mode === "signup" ? (
          <>
            <Field
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Edoardo Mustarelli"
            />
            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholder="musta96"
            />
          </>
        ) : null}

        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          placeholder="mustarelli.edoardo@gmail.com"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder={mode === "signup" ? "Minimum 8 characters" : "Your password"}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button onPress={handleSubmit} loading={loading}>
          {mode === "signin" ? "Enter KRUXT" : "Create account"}
        </Button>
      </Card>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  copy: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22
  },
  modeRow: {
    gap: spacing.sm
  },
  error: {
    color: palette.danger,
    fontSize: 14,
    lineHeight: 20
  }
});
