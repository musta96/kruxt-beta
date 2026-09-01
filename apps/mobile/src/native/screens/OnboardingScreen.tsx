import type { Gym, PolicyVersion } from "@kruxt/types";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";

import { GymService } from "../../services/gym-service";
import { homeGymIdForEligibleMembership } from "../../services/onboarding-semantics";
import { PolicyService, type BaselinePolicies } from "../../services/policy-service";
import { ProfileService } from "../../services/profile-service";
import { useNativeSession } from "../session";
import { palette, radius, spacing } from "../theme";
import { Banner, Button, Card, Field, Heading, InlineButton, Pill, ScreenScroll, SwitchRow } from "../ui";

type OnboardingStep = "profile" | "consents" | "gym";
type RequiredConsentKey = "terms" | "privacy" | "healthData";

const usernamePattern = /^[a-z0-9_]{3,24}$/;
const gymPageSize = 12;

function policyItems(policies: BaselinePolicies): Array<{
  key: RequiredConsentKey;
  policy: PolicyVersion;
  description: string;
}> {
  return [
    { key: "terms", policy: policies.terms, description: "Terms governing use of KRUXT." },
    { key: "privacy", policy: policies.privacy, description: "How KRUXT handles your personal data." },
    {
      key: "healthData",
      policy: policies.healthData,
      description: "Consent for workout and health-related data processing."
    }
  ];
}

export function OnboardingScreen() {
  const { supabase, state, completeOnboarding } = useNativeSession();
  const user = state.access.user;
  const [step, setStep] = useState<OnboardingStep>("profile");
  const [displayName, setDisplayName] = useState(state.profile?.displayName ?? "");
  const [username, setUsername] = useState(state.profile?.username ?? "");
  const [policies, setPolicies] = useState<BaselinePolicies | null>(null);
  const [reviewed, setReviewed] = useState<Record<RequiredConsentKey, boolean>>({
    terms: false,
    privacy: false,
    healthData: false
  });
  const [accepted, setAccepted] = useState<Record<RequiredConsentKey, boolean>>({
    terms: false,
    privacy: false,
    healthData: false
  });
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [pushOptIn, setPushOptIn] = useState(false);
  const [gymQuery, setGymQuery] = useState("");
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymPage, setGymPage] = useState(0);
  const [hasMoreGyms, setHasMoreGyms] = useState(false);
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [gymOutcome, setGymOutcome] = useState<string | null>(null);
  const [policyLoadAttempted, setPolicyLoadAttempted] = useState(false);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [loadingGyms, setLoadingGyms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const policyService = useMemo(() => new PolicyService(supabase), [supabase]);
  const profileService = useMemo(() => new ProfileService(supabase), [supabase]);
  const gymService = useMemo(() => new GymService(supabase), [supabase]);

  async function loadPolicies() {
    setPolicyLoadAttempted(true);
    setLoadingPolicies(true);
    setError(null);
    try {
      setPolicies(await policyService.getCurrentBaselinePolicies());
      setReviewed({ terms: false, privacy: false, healthData: false });
      setAccepted({ terms: false, privacy: false, healthData: false });
    } catch (loadError) {
      setPolicies(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to load required policies.");
    } finally {
      setLoadingPolicies(false);
    }
  }

  useEffect(() => {
    if (step === "consents" && !policies && !loadingPolicies && !policyLoadAttempted) {
      void loadPolicies();
    }
  }, [step, policies, loadingPolicies, policyLoadAttempted]);

  useEffect(() => {
    if (step !== "gym") return;

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoadingGyms(true);
      setError(null);
      void gymService
        .searchVisibleGyms({ query: gymQuery, page: 0, pageSize: gymPageSize })
        .then((result) => {
          if (cancelled) return;
          setGyms(result.gyms);
          setGymPage(0);
          setHasMoreGyms(result.hasMore);
          setSelectedGymId(null);
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setError(loadError instanceof Error ? loadError.message : "Unable to load gyms.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingGyms(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [gymQuery, gymService, step]);

  async function saveProfile() {
    if (!user || saving) return;
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedDisplayName = displayName.trim();
    if (normalizedDisplayName.length < 2) {
      setError("Display name must be at least 2 characters.");
      return;
    }
    if (!usernamePattern.test(normalizedUsername)) {
      setError("Username must be 3-24 lowercase letters, numbers, or underscores.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await profileService.updateProfile(user.id, {
        displayName: normalizedDisplayName,
        username: normalizedUsername
      });
      setDisplayName(normalizedDisplayName);
      setUsername(normalizedUsername);
      setStep("consents");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function reviewPolicy(key: RequiredConsentKey, policy: PolicyVersion) {
    setError(null);
    try {
      await Linking.openURL(policy.documentUrl);
      setReviewed((current) => ({ ...current, [key]: true }));
    } catch {
      setError(`Unable to open ${policy.label ?? policy.policyType}.`);
    }
  }

  async function saveConsents() {
    if (!user || !policies || saving) return;
    const allAccepted = Object.values(accepted).every(Boolean);
    const allReviewed = Object.values(reviewed).every(Boolean);
    if (!allAccepted || !allReviewed) {
      setError("Review and accept each required document before continuing.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await policyService.captureBaselineConsents(user.id, {
        termsPolicyId: policies.terms.id,
        privacyPolicyId: policies.privacy.id,
        healthDataPolicyId: policies.healthData.id,
        acceptTerms: accepted.terms,
        acceptPrivacy: accepted.privacy,
        acceptHealthData: accepted.healthData,
        marketingEmailOptIn: marketingOptIn,
        pushNotificationsOptIn: pushOptIn,
        source: "mobile"
      });
      setStep("gym");
    } catch (saveError) {
      const code = (saveError as { code?: string }).code;
      if (code === "POLICY_BASELINE_CHANGED") {
        await loadPolicies();
      }
      setError(saveError instanceof Error ? saveError.message : "Unable to save consent decisions.");
    } finally {
      setSaving(false);
    }
  }

  async function loadMoreGyms() {
    if (loadingGyms || !hasMoreGyms) return;
    setLoadingGyms(true);
    setError(null);
    try {
      const nextPage = gymPage + 1;
      const result = await gymService.searchVisibleGyms({
        query: gymQuery,
        page: nextPage,
        pageSize: gymPageSize
      });
      setGyms((current) => [...current, ...result.gyms]);
      setGymPage(nextPage);
      setHasMoreGyms(result.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load more gyms.");
    } finally {
      setLoadingGyms(false);
    }
  }

  async function joinSelectedGym() {
    if (!user || !selectedGymId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const membership = await gymService.joinGym(user.id, { gymId: selectedGymId });
      const eligibleHomeGymId = homeGymIdForEligibleMembership(membership);
      if (eligibleHomeGymId) {
        await profileService.setHomeGym(user.id, eligibleHomeGymId);
        setGymOutcome("Membership confirmed. This gym is now your home gym.");
      } else {
        setGymOutcome("Membership requested. It is pending approval and has not been set as your home gym.");
      }
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Unable to request gym membership.");
    } finally {
      setSaving(false);
    }
  }

  async function finishOnboarding() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await completeOnboarding();
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "Unable to complete onboarding.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll>
      <View style={styles.progressRow}>
        <Pill tone={step === "profile" ? "primary" : "default"}>1 Profile</Pill>
        <Pill tone={step === "consents" ? "primary" : "default"}>2 Consent</Pill>
        <Pill tone={step === "gym" ? "primary" : "default"}>3 Gym</Pill>
      </View>

      {step === "profile" ? (
        <>
          <Heading
            eyebrow="Account setup"
            title="Set your profile"
            subtitle="Choose the name and handle shown across KRUXT."
          />
          {error ? <Banner message={error} tone="danger" /> : null}
          <Card>
            <Field label="Display name" value={displayName} onChangeText={setDisplayName} />
            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </Card>
          <Button onPress={() => void saveProfile()} loading={saving}>Continue</Button>
        </>
      ) : null}

      {step === "consents" ? (
        <>
          <Heading
            eyebrow="Required review"
            title="Policies and consent"
            subtitle="Open the exact current documents below before accepting them."
          />
          {error ? <Banner message={error} tone="danger" /> : null}
          {!policies ? (
            <Button onPress={() => void loadPolicies()} loading={loadingPolicies}>Retry policy load</Button>
          ) : (
            <>
              {policyItems(policies).map(({ key, policy, description }) => (
                <Card key={key}>
                  <Text style={styles.policyTitle}>{policy.label}</Text>
                  <Text style={styles.policyVersion}>Version {policy.version}</Text>
                  <Text style={styles.bodyText}>{description}</Text>
                  <Text style={styles.documentUrl}>{policy.documentUrl}</Text>
                  <InlineButton onPress={() => void reviewPolicy(key, policy)}>
                    {reviewed[key] ? "Reviewed" : "Open document"}
                  </InlineButton>
                  {reviewed[key] ? (
                    <SwitchRow
                      label={`Accept ${policy.label}`}
                      value={accepted[key]}
                      onValueChange={(value) => setAccepted((current) => ({ ...current, [key]: value }))}
                    />
                  ) : null}
                </Card>
              ))}
              <Card>
                <SwitchRow
                  label="Marketing email"
                  description="Optional product and community email. Off by default."
                  value={marketingOptIn}
                  onValueChange={setMarketingOptIn}
                />
                <SwitchRow
                  label="Push notifications"
                  description="Optional mobile notifications. Off by default."
                  value={pushOptIn}
                  onValueChange={setPushOptIn}
                />
              </Card>
              <Button onPress={() => void saveConsents()} loading={saving}>Accept and continue</Button>
            </>
          )}
        </>
      ) : null}

      {step === "gym" ? (
        <>
          <Heading
            eyebrow="Optional"
            title="Find your gym"
            subtitle="Search all visible gyms or continue without joining one."
          />
          {error ? <Banner message={error} tone="danger" /> : null}
          {gymOutcome ? <Banner message={gymOutcome} tone="success" /> : null}
          {!gymOutcome ? (
            <>
              <Field
                label="Search gyms"
                value={gymQuery}
                onChangeText={setGymQuery}
                placeholder="Gym name"
              />
              <View style={styles.gymList}>
                {gyms.map((gym) => {
                  const selected = gym.id === selectedGymId;
                  return (
                    <Pressable
                      key={gym.id}
                      onPress={() => setSelectedGymId(gym.id)}
                      style={[styles.gymRow, selected ? styles.gymRowSelected : null]}
                    >
                      <View style={styles.gymCopy}>
                        <Text style={styles.gymName}>{gym.name}</Text>
                        <Text style={styles.bodyText}>{gym.city ?? "Location not listed"}</Text>
                      </View>
                      <Text style={selected ? styles.selectedMark : styles.unselectedMark}>
                        {selected ? "Selected" : "Select"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {hasMoreGyms ? (
                <Button tone="secondary" onPress={() => void loadMoreGyms()} loading={loadingGyms}>
                  Load more
                </Button>
              ) : null}
              <Button
                onPress={() => void joinSelectedGym()}
                disabled={!selectedGymId}
                loading={saving}
              >
                Request membership
              </Button>
            </>
          ) : null}
          <Button tone="secondary" onPress={() => void finishOnboarding()} loading={saving}>
            {gymOutcome ? "Continue to KRUXT" : "Skip for now"}
          </Button>
        </>
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  progressRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  policyTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: "700"
  },
  policyVersion: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  bodyText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  documentUrl: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18
  },
  gymList: {
    gap: spacing.sm
  },
  gymRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.sm,
    backgroundColor: palette.surface,
    padding: spacing.md
  },
  gymRowSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.surfaceRaised
  },
  gymCopy: {
    flex: 1,
    gap: 4
  },
  gymName: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700"
  },
  selectedMark: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  unselectedMark: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "700"
  }
});
