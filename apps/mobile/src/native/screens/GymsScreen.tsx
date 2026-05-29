import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Banner, Button, Card, Field, Heading, Pill, SectionTitle } from "../ui";
import { palette, radius, spacing } from "../theme";
import { useNativeSession } from "../session";

type GymRow = {
  id: string;
  name: string;
  motto: string | null;
  description: string | null;
  city: string | null;
  country_code: string | null;
};

type PlanRow = {
  id: string;
  gym_id: string;
  name: string;
  billing_cycle: "monthly" | "quarterly" | "yearly" | "dropin";
  price_cents: number;
  currency: string;
  class_credits_per_cycle: number | null;
  trial_days: number | null;
  cancel_policy: string | null;
};

type BrandRow = {
  gym_id: string;
  metadata: Record<string, unknown> | null;
};

type MembershipRow = {
  id: string;
  gym_id: string;
  membership_status: "pending" | "trial" | "active" | "paused" | "cancelled";
  membership_plan_id: string | null;
};

type JoinRequestRow = {
  id: string;
  gym_id: string;
  requested_membership_plan_id: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  source: string;
  created_at: string;
};

interface GymDirectoryItem {
  gym: GymRow;
  plans: PlanRow[];
  membership: MembershipRow | null;
  latestRequest: JoinRequestRow | null;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: 2
  }).format(cents / 100);
}

function locationLabel(gym: GymRow): string {
  return [gym.city, gym.country_code].filter(Boolean).join(", ") || "Public gym";
}

function requestLabel(request: JoinRequestRow | null): string | null {
  if (!request) return null;
  if (request.status === "pending") return "Request pending";
  if (request.status === "approved") return "Approved";
  if (request.status === "rejected") return "Rejected";
  return "Cancelled";
}

function newestRequestByGym(requests: JoinRequestRow[]): Map<string, JoinRequestRow> {
  const map = new Map<string, JoinRequestRow>();
  for (const request of requests) {
    if (!map.has(request.gym_id)) {
      map.set(request.gym_id, request);
    }
  }
  return map;
}

function visiblePlanIdsFromMetadata(metadata: Record<string, unknown> | null): string[] | null {
  const publicPage = metadata?.publicPage;
  if (!publicPage || typeof publicPage !== "object" || Array.isArray(publicPage)) {
    return null;
  }

  const rawPlanIds = (publicPage as Record<string, unknown>).visibleMembershipPlanIds;
  return Array.isArray(rawPlanIds)
    ? rawPlanIds.filter((planId): planId is string => typeof planId === "string")
    : null;
}

export function GymsScreen() {
  const { supabase, state, refresh } = useNativeSession();
  const userId = state.access.user?.id;
  const [items, setItems] = useState<GymDirectoryItem[]>([]);
  const [selectedPlans, setSelectedPlans] = useState<Record<string, string | null>>({});
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestingGymId, setRequestingGymId] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeMembershipCount = useMemo(
    () => items.filter((item) => item.membership?.membership_status === "active" || item.membership?.membership_status === "trial").length,
    [items]
  );

  const loadGyms = useCallback(async () => {
    if (!userId) return;

    try {
      setError(null);
      const { data: gymsData, error: gymsError } = await supabase
        .from("gyms")
        .select("id,name,motto,description,city,country_code")
        .eq("is_public", true)
        .order("name", { ascending: true });

      if (gymsError) {
        throw new Error(gymsError.message || "Unable to load gyms.");
      }

      const gyms = (gymsData as GymRow[] | null) ?? [];
      const gymIds = gyms.map((gym) => gym.id);

      const [brandResponse, plansResponse, membershipsResponse, requestsResponse] = await Promise.all([
        gymIds.length > 0
          ? supabase
              .from("gym_brand_settings")
              .select("gym_id,metadata")
              .in("gym_id", gymIds)
          : Promise.resolve({ data: [] as BrandRow[] | null, error: null }),
        gymIds.length > 0
          ? supabase
              .from("gym_membership_plans")
              .select("id,gym_id,name,billing_cycle,price_cents,currency,class_credits_per_cycle,trial_days,cancel_policy")
              .in("gym_id", gymIds)
              .eq("is_active", true)
              .order("price_cents", { ascending: true })
          : Promise.resolve({ data: [] as PlanRow[] | null, error: null }),
        gymIds.length > 0
          ? supabase
              .from("gym_memberships")
              .select("id,gym_id,membership_status,membership_plan_id")
              .eq("user_id", userId)
              .in("gym_id", gymIds)
          : Promise.resolve({ data: [] as MembershipRow[] | null, error: null }),
        gymIds.length > 0
          ? supabase
              .from("gym_join_requests")
              .select("id,gym_id,requested_membership_plan_id,status,source,created_at")
              .eq("user_id", userId)
              .in("gym_id", gymIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as JoinRequestRow[] | null, error: null })
      ]);

      if (brandResponse.error) {
        throw new Error(brandResponse.error.message || "Unable to load gym branding.");
      }
      if (plansResponse.error) {
        throw new Error(plansResponse.error.message || "Unable to load membership plans.");
      }
      if (membershipsResponse.error) {
        throw new Error(membershipsResponse.error.message || "Unable to load memberships.");
      }
      if (requestsResponse.error) {
        throw new Error(requestsResponse.error.message || "Unable to load access requests.");
      }

      const plansByGym = new Map<string, PlanRow[]>();
      for (const plan of ((plansResponse.data as PlanRow[] | null) ?? [])) {
        const list = plansByGym.get(plan.gym_id) ?? [];
        list.push(plan);
        plansByGym.set(plan.gym_id, list);
      }

      const visiblePlanIdsByGym = new Map<string, string[] | null>();
      for (const brand of ((brandResponse.data as BrandRow[] | null) ?? [])) {
        visiblePlanIdsByGym.set(brand.gym_id, visiblePlanIdsFromMetadata(brand.metadata));
      }

      const membershipByGym = new Map<string, MembershipRow>();
      for (const membership of ((membershipsResponse.data as MembershipRow[] | null) ?? [])) {
        membershipByGym.set(membership.gym_id, membership);
      }

      const requestByGym = newestRequestByGym((requestsResponse.data as JoinRequestRow[] | null) ?? []);
      const nextItems = gyms.map((gym) => {
        const plans = plansByGym.get(gym.id) ?? [];
        const visiblePlanIds = visiblePlanIdsByGym.get(gym.id) ?? null;
        const visiblePlanSet = visiblePlanIds ? new Set(visiblePlanIds) : null;
        return {
          gym,
          plans: visiblePlanSet ? plans.filter((plan) => visiblePlanSet.has(plan.id)) : plans,
          membership: membershipByGym.get(gym.id) ?? null,
          latestRequest: requestByGym.get(gym.id) ?? null
        };
      });

      setItems(nextItems);
      setSelectedPlans((current) => {
        const next: Record<string, string | null> = {};
        for (const item of nextItems) {
          next[item.gym.id] =
            current[item.gym.id] ??
            item.membership?.membership_plan_id ??
            item.latestRequest?.requested_membership_plan_id ??
            item.plans[0]?.id ??
            null;
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load gyms.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    void loadGyms();
  }, [loadGyms]);

  async function requestAccess(item: GymDirectoryItem) {
    setRequestingGymId(item.gym.id);
    setError(null);
    setMessage(null);

    try {
      const { error: requestError } = await supabase.rpc("request_gym_membership", {
        p_gym_id: item.gym.id,
        p_membership_plan_id: selectedPlans[item.gym.id] ?? null,
        p_note: null
      });

      if (requestError) {
        throw new Error(requestError.message || "Unable to request gym access.");
      }

      setMessage(`${item.gym.name} received your access request.`);
      await Promise.all([loadGyms(), refresh()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to request gym access.");
    } finally {
      setRequestingGymId(null);
    }
  }

  async function redeemInviteCode() {
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setError("Enter an invite code first.");
      return;
    }

    setRedeeming(true);
    setError(null);
    setMessage(null);

    try {
      const { error: redeemError } = await supabase.rpc("redeem_gym_invite_code", {
        p_code: code,
        p_note: null
      });

      if (redeemError) {
        throw new Error(redeemError.message || "Unable to redeem invite code.");
      }

      setInviteCode("");
      setMessage("Invite redeemed. Your gym access has been updated.");
      await Promise.all([loadGyms(), refresh()]);
    } catch (redeemError) {
      setError(redeemError instanceof Error ? redeemError.message : "Unable to redeem invite code.");
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <ScrollView
      style={styles.shell}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
        setRefreshing(true);
        void loadGyms();
      }} tintColor={palette.primary} />}
    >
      <Heading
        eyebrow="Gyms"
        title="Find your gym"
        subtitle="Request private access from a public gym, choose a plan, or redeem an invite code from staff."
      />

      {message ? <Banner message={message} tone="success" /> : null}
      {error ? <Banner message={error} tone="danger" /> : null}

      <Card>
        <SectionTitle>Invite code</SectionTitle>
        <Text style={styles.note}>Use the short code from a gym invite link, QR poster, or reception desk.</Text>
        <Field
          label="Code"
          value={inviteCode}
          onChangeText={(value) => setInviteCode(value.toUpperCase())}
          autoCapitalize="characters"
          placeholder="BZONE-2026"
        />
        <Button onPress={redeemInviteCode} loading={redeeming}>Redeem invite</Button>
      </Card>

      <View style={styles.summaryRow}>
        <Pill tone="primary">{items.length} public gyms</Pill>
        <Pill tone="success">{activeMembershipCount} active</Pill>
      </View>

      {loading ? (
        <Card>
          <Text style={styles.note}>Loading gyms...</Text>
        </Card>
      ) : null}

      {!loading && items.length === 0 ? (
        <Card>
          <Text style={styles.note}>No public gyms are available yet.</Text>
        </Card>
      ) : null}

      {items.map((item) => {
        const membershipStatus = item.membership?.membership_status ?? null;
        const latestRequestLabel = requestLabel(item.latestRequest);
        const isLinked = membershipStatus === "active" || membershipStatus === "trial";
        const isPending = membershipStatus === "pending" || item.latestRequest?.status === "pending";

        return (
          <Card key={item.gym.id}>
            <View style={styles.gymHeader}>
              <View style={styles.gymCopy}>
                <Text style={styles.gymName}>{item.gym.name}</Text>
                <Text style={styles.location}>{locationLabel(item.gym)}</Text>
              </View>
              <Pill tone={isLinked ? "success" : isPending ? "primary" : "default"}>
                {membershipStatus ?? latestRequestLabel ?? "open"}
              </Pill>
            </View>

            {item.gym.motto ? <Text style={styles.motto}>{item.gym.motto}</Text> : null}
            {item.gym.description ? <Text style={styles.note}>{item.gym.description}</Text> : null}

            <View style={styles.planList}>
              {item.plans.length === 0 ? (
                <Text style={styles.note}>No active plans are published yet. You can still request general access.</Text>
              ) : (
                item.plans.map((plan) => {
                  const selected = selectedPlans[item.gym.id] === plan.id;
                  return (
                    <Pressable
                      key={plan.id}
                      onPress={() => setSelectedPlans((current) => ({ ...current, [item.gym.id]: plan.id }))}
                      style={[styles.planOption, selected ? styles.planOptionSelected : null]}
                    >
                      <View style={styles.planCopy}>
                        <Text style={styles.planName}>{plan.name}</Text>
                        <Text style={styles.planMeta}>
                          {plan.class_credits_per_cycle == null
                            ? "Unlimited/manual access"
                            : `${plan.class_credits_per_cycle} class credits`}
                          {plan.trial_days ? ` · ${plan.trial_days} trial days` : ""}
                        </Text>
                        {plan.cancel_policy ? <Text style={styles.planPolicy}>{plan.cancel_policy}</Text> : null}
                      </View>
                      <Text style={styles.planPrice}>{formatMoney(plan.price_cents, plan.currency)}</Text>
                    </Pressable>
                  );
                })
              )}
            </View>

            {latestRequestLabel && !isLinked ? <Text style={styles.note}>{latestRequestLabel}</Text> : null}

            <Button
              onPress={() => void requestAccess(item)}
              loading={requestingGymId === item.gym.id}
              disabled={isLinked || isPending}
              tone={isLinked ? "secondary" : "primary"}
            >
              {isLinked ? "Access active" : isPending ? "Request pending" : "Request access"}
            </Button>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: palette.background
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  gymHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  gymCopy: {
    flex: 1,
    gap: 4
  },
  gymName: {
    color: palette.text,
    fontSize: 20,
    fontWeight: "800"
  },
  location: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  motto: {
    color: palette.primary,
    fontSize: 15,
    fontWeight: "700"
  },
  note: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  planList: {
    gap: spacing.sm
  },
  planOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.sm,
    backgroundColor: palette.surfaceRaised,
    padding: spacing.md
  },
  planOptionSelected: {
    borderColor: palette.primary,
    backgroundColor: "rgba(65, 211, 255, 0.1)"
  },
  planCopy: {
    flex: 1,
    gap: 4
  },
  planName: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "800"
  },
  planMeta: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  planPolicy: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  planPrice: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: "800"
  }
});
