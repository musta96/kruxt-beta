import React, { useState, useCallback } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { darkTheme, Button } from "@kruxt/ui";

const theme = darkTheme;

interface ConsentItem {
  id: string;
  title: string;
  summary: string;
  required: boolean;
}

const CONSENT_ITEMS: ConsentItem[] = [
  {
    id: "terms",
    title: "Terms of Service",
    summary:
      "You agree to the KRUXT Terms of Service governing your use of the platform, including account responsibilities and acceptable use policies.",
    required: true,
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    summary:
      "We collect and process your personal data as described in our Privacy Policy, including workout logs, profile information, and usage analytics.",
    required: true,
  },
  {
    id: "health_data",
    title: "Health Data Processing",
    summary:
      "KRUXT processes fitness and health-related data (workout logs, body metrics) to provide personalized tracking and insights. This data is stored securely and never sold to third parties.",
    required: true,
  },
  {
    id: "marketing",
    title: "Marketing Communications",
    summary:
      "Receive occasional emails about new features, challenges, and community events. You can unsubscribe at any time.",
    required: false,
  },
];

export default function ConsentsScreen() {
  const router = useRouter();

  const [consents, setConsents] = useState<Record<string, boolean>>(
    Object.fromEntries(CONSENT_ITEMS.map((c) => [c.id, false])),
  );

  const allRequiredAccepted = CONSENT_ITEMS.filter((c) => c.required).every(
    (c) => consents[c.id],
  );

  const toggleConsent = useCallback((id: string) => {
    setConsents((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const acceptAll = useCallback(() => {
    setConsents(Object.fromEntries(CONSENT_ITEMS.map((c) => [c.id, true])));
  }, []);

  const handleContinue = useCallback(() => {
    if (!allRequiredAccepted) return;
    router.push("/(onboarding)/gym-select");
  }, [allRequiredAccepted, router]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading} accessibilityRole="header">
          Consents & Agreements
        </Text>
        <Text style={styles.subtitle}>
          Review and accept the required agreements to continue.
        </Text>

        {CONSENT_ITEMS.map((item) => (
          <View key={item.id} style={styles.consentCard}>
            <View style={styles.consentHeader}>
              <View style={styles.consentTitleRow}>
                <Text style={styles.consentTitle}>{item.title}</Text>
                {item.required && (
                  <Text style={styles.requiredBadge}>Required</Text>
                )}
              </View>
              <Switch
                value={consents[item.id]}
                onValueChange={() => toggleConsent(item.id)}
                trackColor={{
                  false: "rgba(141, 153, 174, 0.3)",
                  true: "rgba(53, 208, 255, 0.4)",
                }}
                thumbColor={consents[item.id] ? "#35D0FF" : "#8D99AE"}
                accessibilityLabel={`${item.title} consent toggle`}
                accessibilityRole="switch"
                accessibilityState={{ checked: consents[item.id] }}
              />
            </View>
            <Text style={styles.consentSummary}>{item.summary}</Text>
          </View>
        ))}

        <Pressable
          onPress={acceptAll}
          style={styles.acceptAllLink}
          accessibilityLabel="Accept all consents"
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>Accept All</Text>
        </Pressable>

        <Button
          theme={theme}
          variant="primary"
          size="lg"
          label="Accept & Continue"
          onPress={handleContinue}
          disabled={!allRequiredAccepted}
          accessibilityLabel="Accept required consents and continue"
          style={styles.continueButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0E1116",
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  heading: {
    fontFamily: "Oswald",
    fontSize: 28,
    fontWeight: "700",
    color: "#F4F6F8",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Sora",
    fontSize: 15,
    color: "#A7B1C2",
    marginBottom: 24,
    lineHeight: 22,
  },
  consentCard: {
    backgroundColor: "#171C24",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(141, 153, 174, 0.2)",
  },
  consentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  consentTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
    gap: 8,
  },
  consentTitle: {
    fontFamily: "Sora",
    fontSize: 15,
    fontWeight: "600",
    color: "#F4F6F8",
  },
  requiredBadge: {
    fontFamily: "Sora",
    fontSize: 10,
    fontWeight: "700",
    color: "#35D0FF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  consentSummary: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#A7B1C2",
    lineHeight: 19,
  },
  acceptAllLink: {
    alignSelf: "center",
    marginVertical: 16,
  },
  linkText: {
    fontFamily: "Sora",
    fontSize: 14,
    color: "#35D0FF",
    fontWeight: "600",
  },
  continueButton: {
    width: "100%",
  },
});
