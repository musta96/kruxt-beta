import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Banner, Button, Card, Heading, ScreenScroll } from "../ui";
import { palette, spacing } from "../theme";
import { useNativeSession } from "../session";

export function AcceptInviteScreen({
  token,
  onDone
}: {
  token: string;
  onDone: () => void;
}) {
  const { supabase, state } = useNativeSession();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setPending(true);
    setMessage(null);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("accept-invite", {
        body: { token }
      });

      if (invokeError) {
        throw new Error(invokeError.message || "Unable to accept invite.");
      }

      if (!data?.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to accept invite.");
      }

      setMessage("Invite accepted successfully. Your organization access has been updated.");
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Unable to accept invite.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ScreenScroll>
      <Heading
        eyebrow="Gym invite"
        title="Accept organization access"
        subtitle={`Signed in as ${state.access.user?.email ?? "unknown user"}. Confirm this is the account that should receive the invite.`}
      />

      <Card>
        <View style={styles.tokenBlock}>
          <Text style={styles.tokenLabel}>Invite token</Text>
          <Text style={styles.tokenValue}>{token}</Text>
        </View>
        <Text style={styles.copy}>
          Accepting the invite adds your user to the target gym organization with the role encoded in the invite.
        </Text>
        <Button onPress={handleAccept} loading={pending}>Accept invite</Button>
        <Button tone="secondary" onPress={onDone} disabled={pending}>Back to app</Button>
      </Card>

      {message ? <Banner message={message} tone="success" /> : null}
      {error ? <Banner message={error} tone="danger" /> : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  tokenBlock: {
    gap: 4
  },
  tokenLabel: {
    color: palette.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700"
  },
  tokenValue: {
    color: palette.text,
    fontSize: 13,
    lineHeight: 19
  },
  copy: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20
  }
});
