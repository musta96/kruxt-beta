// Step 2 – Create Profile (username, display name, avatar, units)
import React, { useState } from "react";
import { useOnboarding, useFieldError } from "../OnboardingContext";
import {
  ScreenShell,
  StepBar,
  ScreenHeader,
  Field,
  TextInput,
  PrimaryButton,
  BackButton,
  ErrorCallout,
} from "../ui";

export function ProfileScreen() {
  const { draft, updateDraft, advance, back, submitError, isSubmitting } = useOnboarding();
  const displayNameError = useFieldError("profile.displayName");
  const usernameError = useFieldError("profile.username");

  const p = draft.profile;

  function set(patch: Partial<typeof p>) {
    updateDraft({ profile: { ...p, ...patch } });
  }

  // Derive username suggestion from display name
  function handleDisplayNameChange(val: string) {
    const newDisplayName = val;
    const autoSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 24);
    set({
      displayName: newDisplayName,
      username: p.username || autoSlug,
    });
  }

  return (
    <ScreenShell>
      <StepBar current={1} total={4} />

      <div className="flex items-center gap-2 px-4 pt-2">
        <BackButton onClick={back} />
      </div>

      <ScreenHeader
        badge="Step 2 of 4"
        title="Set your identity"
        subtitle="Choose how your guild sees your progress."
      />

      {submitError && <ErrorCallout message={submitError} />}

      <div className="px-6 pt-2 pb-10 space-y-5 flex-1">
        {/* Avatar placeholder */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-secondary/60 border-2 border-border/40 flex items-center justify-center">
              {p.avatarUrl ? (
                <img
                  src={p.avatarUrl}
                  alt="Avatar preview"
                  className="w-full h-full rounded-2xl object-cover"
                />
              ) : (
                <svg className="w-8 h-8 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
            <button
              type="button"
              className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-md"
              onClick={() => {/* avatar upload placeholder */}}
              aria-label="Upload avatar"
            >
              <svg className="w-3.5 h-3.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Avatar URL field */}
        <Field label="Avatar URL" hint="Paste a direct image URL, or upload later.">
          <TextInput
            type="url"
            placeholder="https://…"
            value={p.avatarUrl ?? ""}
            onChange={(e) => set({ avatarUrl: e.target.value || undefined })}
          />
        </Field>

        {/* Display name */}
        <Field label="Display Name" required error={displayNameError}>
          <TextInput
            type="text"
            autoComplete="name"
            placeholder="Your name in the guild"
            value={p.displayName}
            error={!!displayNameError}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
          />
        </Field>

        {/* Username */}
        <Field
          label="Username"
          required
          error={usernameError}
          hint="3–24 chars · lowercase, numbers, underscores"
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">
              @
            </span>
            <TextInput
              type="text"
              autoComplete="username"
              placeholder="your_handle"
              value={p.username}
              error={!!usernameError}
              onChange={(e) => set({ username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24) })}
              className="pl-8"
            />
          </div>
        </Field>

        {/* Bio */}
        <Field label="Bio" hint="Optional — shown on your guild profile.">
          <textarea
            placeholder="What drives you?"
            value={p.bio ?? ""}
            onChange={(e) => set({ bio: e.target.value || undefined })}
            rows={2}
            maxLength={160}
            className="w-full px-4 py-3 rounded-xl text-sm bg-secondary/40 text-foreground border border-border/40 transition-colors duration-200 outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50 resize-none"
          />
        </Field>

        {/* Units toggle */}
        <Field label="Preferred Units">
          <div className="flex rounded-xl bg-secondary/30 border border-border/30 p-1 gap-1">
            {(["metric", "imperial"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => set({ preferredUnits: u })}
                className={`flex-1 h-8 rounded-lg text-xs font-semibold capitalize transition-all duration-200 ${
                  p.preferredUnits === u
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {u === "metric" ? "Metric (kg / km)" : "Imperial (lbs / mi)"}
              </button>
            ))}
          </div>
        </Field>

        <div className="pt-2">
          <PrimaryButton onClick={advance} loading={isSubmitting}>
            Save profile →
          </PrimaryButton>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Guild access starts when profile is complete.
        </p>
      </div>
    </ScreenShell>
  );
}
