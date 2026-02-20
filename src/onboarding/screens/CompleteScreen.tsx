// Step 5 – Completion screen with submit + "Enter Guild Hall"
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOnboarding } from "../OnboardingContext";
import { ScreenShell, ScreenHeader, PrimaryButton, GhostButton, ErrorCallout, BackButton } from "../ui";
import type { OnboardingDraft } from "../types";

// ── Checklist item ────────────────────────────────────────────────────────────
function CheckItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${
          done ? "bg-primary border-primary" : "border-border/50"
        }`}
      >
        {done && (
          <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`text-sm ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}

// ── Summary row ───────────────────────────────────────────────────────────────
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/20 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold text-foreground truncate max-w-[60%] text-right">{value}</span>
    </div>
  );
}

// ── Actual submit logic (calls Supabase directly, mirrors phase2-onboarding-service) ─
async function runOnboarding(draft: OnboardingDraft): Promise<{ userId: string }> {
  const email = draft.auth.email.trim().toLowerCase();
  const password = draft.auth.password;

  // Auth
  if (draft.auth.mode === "signup") {
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError && !signUpError.message.toLowerCase().includes("already registered")) {
      throw new Error(signUpError.message);
    }
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(signInError.message);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");

  const userId = user.id;

  // Profile
  const p = draft.profile;
  const username = p.username.trim().slice(0, 24) || email.split("@")[0].slice(0, 24);
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      username,
      display_name: p.displayName.trim() || username,
      avatar_url: p.avatarUrl ?? null,
      bio: p.bio ?? null,
      locale: p.locale ?? null,
      preferred_units: p.preferredUnits,
    }, { onConflict: "id" });

  if (profileError) throw new Error(profileError.message);

  // Gym membership
  const gym = draft.gym;
  if (gym.mode === "join") {
    await supabase.from("gym_memberships").upsert({
      gym_id: gym.gymId,
      user_id: userId,
      role: "member",
      membership_status: "pending",
    }, { onConflict: "gym_id,user_id" });

    // Set home gym
    await supabase.from("profiles").update({ home_gym_id: gym.gymId }).eq("id", userId);
  }

  if (gym.mode === "create") {
    const slugBase = gym.slug || gym.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64);
    const { data: gymData, error: gymError } = await supabase
      .from("gyms")
      .insert({
        slug: slugBase,
        name: gym.name,
        city: gym.city ?? null,
        timezone: "Europe/Rome",
        is_public: gym.isPublic,
        owner_user_id: userId,
      })
      .select("id")
      .single();

    if (!gymError && gymData) {
      await supabase.from("gym_memberships").upsert({
        gym_id: gymData.id,
        user_id: userId,
        role: "leader",
        membership_status: "active",
        started_at: new Date().toISOString(),
      }, { onConflict: "gym_id,user_id" });

      await supabase.from("profiles").update({ home_gym_id: gymData.id }).eq("id", userId);
    }
  }

  return { userId };
}

// ── Screen ────────────────────────────────────────────────────────────────────
export function CompleteScreen({ onComplete }: { onComplete: () => void }) {
  const {
    draft,
    back,
    isSubmitting,
    setIsSubmitting,
    submitError,
    setSubmitError,
  } = useOnboarding();

  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const hasSubmitted = useRef(false);

  const checklist = [
    { key: "auth", label: "Account created" },
    { key: "profile", label: "Profile saved" },
    { key: "consents", label: "Consents recorded" },
    { key: "gym", label: "Guild linked" },
  ];

  const gymLabel =
    draft.gym.mode === "create"
      ? `Create "${draft.gym.name}"`
      : draft.gym.mode === "join"
      ? `Request to join "${draft.gym.gymName}"`
      : "No gym selected";

  async function handleSubmit() {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    setProgress([]);

    try {
      // Simulate progressive checklist feedback
      for (const item of checklist) {
        await new Promise((r) => setTimeout(r, 400));
        setProgress((prev) => [...prev, item.key]);
      }

      await runOnboarding(draft);
      setDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please retry.";
      setSubmitError(msg);
      hasSubmitted.current = false;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenShell>
      {!done && (
        <div className="flex items-center gap-2 px-4 pt-4">
          <BackButton onClick={back} />
        </div>
      )}

      {done ? (
        // ── Success state ──────────────────────────────────────────────────
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-6 py-16">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-gold animate-pulse-gold">
            <svg className="w-10 h-10 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div className="space-y-2 max-w-xs">
            <h1 className="text-3xl font-display font-black text-foreground">
              You're in the guild.
            </h1>
            <p className="text-primary font-display font-semibold">Proof counts.</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your profile is live. Start logging to protect your chain and climb the ranks.
            </p>
          </div>

          <div className="w-full max-w-xs pt-4 space-y-3">
            <PrimaryButton onClick={onComplete}>
              Enter Guild Hall →
            </PrimaryButton>
            <p className="text-xs text-muted-foreground">Rank is earned weekly. Log to claim.</p>
          </div>
        </div>
      ) : (
        // ── Pre-submit / submitting state ──────────────────────────────────
        <div className="flex-1 px-6 pt-4 pb-10 space-y-6">
          <ScreenHeader
            badge="Final step"
            title="Finish onboarding"
            subtitle="Post the proof."
          />

          {submitError && <ErrorCallout message={submitError} />}

          {/* Summary */}
          <div className="rounded-xl border border-border/30 bg-secondary/20 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border/20 bg-secondary/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your setup</p>
            </div>
            <div className="px-4">
              <SummaryRow label="Email" value={draft.auth.email} />
              <SummaryRow label="Display name" value={draft.profile.displayName || "—"} />
              <SummaryRow label="Username" value={`@${draft.profile.username}` || "—"} />
              <SummaryRow label="Units" value={draft.profile.preferredUnits} />
              <SummaryRow label="Guild" value={
                draft.gym.mode === "join"
                  ? draft.gym.gymName
                  : draft.gym.mode === "create"
                  ? draft.gym.name
                  : "Skip for now"
              } />
              <SummaryRow label="Consents" value={
                draft.consents.acceptTerms && draft.consents.acceptPrivacy && draft.consents.acceptHealthData
                  ? "Terms · Privacy · Health data ✓"
                  : "Incomplete — go back"
              } />
            </div>
          </div>

          {/* Checklist progress */}
          {isSubmitting && (
            <div className="rounded-xl border border-border/30 bg-secondary/10 px-4 divide-y divide-border/20">
              {checklist.map((item) => (
                <CheckItem
                  key={item.key}
                  label={item.label}
                  done={progress.includes(item.key)}
                />
              ))}
            </div>
          )}

          <PrimaryButton onClick={handleSubmit} loading={isSubmitting}>
            {isSubmitting ? "Setting up your guild…" : "Enter Guild Hall →"}
          </PrimaryButton>

          <p className="text-center text-xs text-muted-foreground">
            Rank is earned weekly. Proof counts.
          </p>
        </div>
      )}
    </ScreenShell>
  );
}
