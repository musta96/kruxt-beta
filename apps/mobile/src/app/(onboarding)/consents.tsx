import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
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
import type { PolicyVersion } from "@kruxt/types";
import { useSupabase } from "../../contexts/supabase-context";
import { useAuth } from "../../contexts/auth-context";
import { PolicyService, type BaselinePolicies } from "../../services";

const theme = darkTheme;

type RequiredConsentId = "terms" | "privacy" | "health_data";
type ConsentState = Record<RequiredConsentId | "marketing", boolean>;

const INITIAL_CONSENTS: ConsentState = {
  terms: false,
  privacy: false,
  health_data: false,
  marketing: false,
};

const INITIAL_REVIEWED: Record<RequiredConsentId, boolean> = {
  terms: false,
  privacy: false,
  health_data: false,
};

interface RequiredConsentItem {
  id: RequiredConsentId;
  policy: PolicyVersion;
  summary: string;
}

export default function ConsentsScreen() {
  const router = useRouter();
  const supabase = useSupabase();
  const { user, loading: authLoading } = useAuth();

  const [policies, setPolicies] = useState<BaselinePolicies | null>(null);
  const [consents, setConsents] = useState<ConsentState>(INITIAL_CONSENTS);
  const [reviewed, setReviewed] = useState(INITIAL_REVIEWED);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPolicies = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setLoadingPolicies(false);
      setLoadError("You need to be signed in to review and accept policies.");
      return;
    }

    setLoadingPolicies(true);
    setLoadError(null);
    setPolicies(null);
    setConsents(INITIAL_CONSENTS);
    setReviewed(INITIAL_REVIEWED);
    try {
      setPolicies(await new PolicyService(supabase).getCurrentBaselinePolicies());
    } catch (loadFailure: unknown) {
      setLoadError(
        loadFailure instanceof Error
          ? loadFailure.message
          : "Unable to load the required policy documents.",
      );
    } finally {
      setLoadingPolicies(false);
    }
  }, [authLoading, supabase, user]);

  useEffect(() => {
    void loadPolicies();
  }, [loadPolicies]);

  const requiredItems = useMemo<RequiredConsentItem[]>(() => {
    if (!policies) return [];
    return [
      {
        id: "terms",
        policy: policies.terms,
        summary: "The terms that govern your KRUXT account and use of the service.",
      },
      {
        id: "privacy",
        policy: policies.privacy,
        summary: "How KRUXT collects, uses, stores, and protects your personal data.",
      },
      {
        id: "health_data",
        policy: policies.healthData,
        summary: "Your explicit consent for processing workout and health-related data.",
      },
    ];
  }, [policies]);

  const allRequiredAccepted = requiredItems.every(
    (item) => reviewed[item.id] && consents[item.id],
  );

  const handleReviewDocument = useCallback(
    async (id: RequiredConsentId, policy: PolicyVersion) => {
      setError(null);
      try {
        await Linking.openURL(policy.documentUrl);
        setReviewed((current) => ({ ...current, [id]: true }));
      } catch {
        setError(`Unable to open ${policy.label}. Please try again.`);
      }
    },
    [],
  );

  const handleContinue = useCallback(async () => {
    if (!user || !policies || !allRequiredAccepted || saving) return;

    setSaving(true);
    setError(null);
    try {
      await new PolicyService(supabase).captureBaselineConsents(user.id, {
        acceptTerms: consents.terms,
        acceptPrivacy: consents.privacy,
        acceptHealthData: consents.health_data,
        marketingEmailOptIn: consents.marketing,
        pushNotificationsOptIn: false,
        termsPolicyId: policies.terms.id,
        privacyPolicyId: policies.privacy.id,
        healthDataPolicyId: policies.healthData.id,
        source: "mobile",
      });
      router.push("/(onboarding)/gym-select");
    } catch (saveFailure: unknown) {
      const code = (saveFailure as { code?: string })?.code;
      if (code === "POLICY_BASELINE_CHANGED") {
        await loadPolicies();
      }
      setError(
        saveFailure instanceof Error
          ? saveFailure.message
          : "Unable to save your consents. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }, [allRequiredAccepted, consents, loadPolicies, policies, router, saving, supabase, user]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading} accessibilityRole="header">
          Privacy & Consents
        </Text>
        <Text style={styles.subtitle}>
          Review the current documents and accept each required policy to continue.
        </Text>

        {(error || loadError) && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorText}>{error ?? loadError}</Text>
            {loadError && user && !authLoading ? (
              <Pressable
                onPress={() => void loadPolicies()}
                accessibilityLabel="Retry loading policies"
                accessibilityRole="button"
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {loadingPolicies || authLoading ? (
          <View style={styles.loadingContainer} accessibilityLabel="Loading policy documents">
            <ActivityIndicator color="#35D0FF" />
          </View>
        ) : null}

        {requiredItems.map((item) => (
          <View key={item.id} style={styles.consentCard}>
            <View style={styles.consentHeader}>
              <View style={styles.consentTitleRow}>
                <Text style={styles.consentTitle}>{item.policy.label}</Text>
                <Text style={styles.requiredBadge}>Required</Text>
              </View>
              <Switch
                value={consents[item.id]}
                onValueChange={(value) =>
                  setConsents((current) => ({ ...current, [item.id]: value }))
                }
                disabled={!reviewed[item.id] || saving}
                trackColor={{ false: "#2A303B", true: "rgba(53, 208, 255, 0.4)" }}
                thumbColor={consents[item.id] ? "#35D0FF" : "#8D99AE"}
                accessibilityLabel={`Accept ${item.policy.label} ${item.policy.version}`}
                accessibilityRole="switch"
                accessibilityState={{ checked: consents[item.id], disabled: !reviewed[item.id] }}
              />
            </View>
            <Text style={styles.versionText}>
              Version {item.policy.version} | Effective {item.policy.effectiveAt.slice(0, 10)}
            </Text>
            <Text style={styles.consentSummary}>{item.summary}</Text>
            <Pressable
              onPress={() => void handleReviewDocument(item.id, item.policy)}
              style={styles.documentLink}
              accessibilityLabel={`Review ${item.policy.label} version ${item.policy.version}`}
              accessibilityRole="link"
            >
              <Text style={styles.linkText}>
                {reviewed[item.id] ? "Review document again" : "Review document"}
              </Text>
              <Text style={styles.documentUrl} numberOfLines={1}>
                {item.policy.documentUrl}
              </Text>
            </Pressable>
          </View>
        ))}

        {policies ? (
          <View style={styles.consentCard}>
            <View style={styles.consentHeader}>
              <View style={styles.consentTitleRow}>
                <Text style={styles.consentTitle}>Marketing emails</Text>
                <Text style={styles.optionalBadge}>Optional</Text>
              </View>
              <Switch
                value={consents.marketing}
                onValueChange={(value) =>
                  setConsents((current) => ({ ...current, marketing: value }))
                }
                disabled={!reviewed.privacy || saving}
                trackColor={{ false: "#2A303B", true: "rgba(53, 208, 255, 0.4)" }}
                thumbColor={consents.marketing ? "#35D0FF" : "#8D99AE"}
                accessibilityLabel="Opt in to marketing emails"
                accessibilityRole="switch"
                accessibilityState={{ checked: consents.marketing, disabled: !reviewed.privacy }}
              />
            </View>
            <Text style={styles.versionText}>
              Governed by {policies.privacy.label} {policies.privacy.version}
            </Text>
            <Text style={styles.consentSummary}>
              Receive product news and training updates. You can change this later.
            </Text>
          </View>
        ) : null}

        <Button
          theme={theme}
          variant="primary"
          size="lg"
          label="Accept & Continue"
          onPress={handleContinue}
          loading={saving}
          disabled={
            !user ||
            authLoading ||
            loadingPolicies ||
            Boolean(loadError) ||
            !allRequiredAccepted ||
            saving
          }
          accessibilityLabel="Accept reviewed required policies and continue"
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
  errorBanner: {
    backgroundColor: "rgba(255, 107, 107, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.4)",
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#FF6B6B",
    lineHeight: 18,
  },
  retryText: {
    fontFamily: "Sora",
    fontSize: 13,
    fontWeight: "600",
    color: "#35D0FF",
    marginTop: 10,
  },
  loadingContainer: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  consentCard: {
    backgroundColor: "#171C24",
    borderRadius: 8,
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
    flexShrink: 1,
  },
  requiredBadge: {
    fontFamily: "Sora",
    fontSize: 10,
    fontWeight: "700",
    color: "#35D0FF",
    textTransform: "uppercase",
  },
  optionalBadge: {
    fontFamily: "Sora",
    fontSize: 10,
    fontWeight: "700",
    color: "#A7B1C2",
    textTransform: "uppercase",
  },
  versionText: {
    fontFamily: "Roboto Mono",
    fontSize: 11,
    color: "#8D99AE",
    marginBottom: 8,
  },
  consentSummary: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#A7B1C2",
    lineHeight: 19,
  },
  documentLink: {
    marginTop: 12,
  },
  linkText: {
    fontFamily: "Sora",
    fontSize: 14,
    color: "#35D0FF",
    fontWeight: "600",
  },
  documentUrl: {
    fontFamily: "Roboto Mono",
    fontSize: 10,
    color: "#8D99AE",
    marginTop: 4,
  },
  continueButton: {
    width: "100%",
    marginTop: 12,
  },
});
