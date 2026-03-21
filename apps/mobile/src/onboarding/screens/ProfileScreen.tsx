import React, { useRef, useState } from "react";
import { useOnboarding } from "../OnboardingContext";
import {
  Screen,
  SectionTitle,
  Subtitle,
  PrimaryBtn,
  InputField,
  ProgressBar,
  BackBtn,
  TabStrip,
} from "../../design-system/primitives";
import type { FieldErrors, UnitSystem } from "../types";

const usernamePattern = /^[a-z0-9_]{3,24}$/;

function validate(username: string, displayName: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!username) errors.username = "Username is required.";
  else if (!usernamePattern.test(username))
    errors.username = "3–24 chars: lowercase letters, numbers, underscores only.";
  if (!displayName.trim()) errors.displayName = "Display name is required.";
  else if (displayName.trim().length < 2)
    errors.displayName = "Display name must be at least 2 characters.";
  return errors;
}

export function ProfileScreen() {
  const { goTo, setProfile, state } = useOnboarding();
  const [username, setUsername] = useState(state.profile.username ?? "");
  const [displayName, setDisplayName] = useState(state.profile.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(state.profile.avatarUrl ?? "");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(
    state.profile.unitSystem ?? "metric"
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const avatarInputRef = useRef<HTMLInputElement>(null);

  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Unable to read image file."));
      reader.readAsDataURL(file);
    });
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarError("Select a PNG or JPG image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Image must be up to 5 MB.");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setAvatarUrl(dataUrl);
      setAvatarError(null);
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Unable to process image.");
    }
  }

  function handleNext() {
    const errs = validate(username, displayName);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setProfile({
      username: username.toLowerCase().trim(),
      displayName: displayName.trim(),
      avatarUrl: avatarUrl || undefined,
      unitSystem,
    });
    goTo("gym");
  }

  return (
    <Screen>
      <div className="mb-6">
        <ProgressBar value={40} />
      </div>

      <div className="flex flex-col gap-6 flex-1">
        <BackBtn onClick={() => goTo("auth")} />

        <div className="space-y-1">
          <SectionTitle>Your profile</SectionTitle>
          <Subtitle>Guild access starts when profile is complete.</Subtitle>
        </div>

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(event) => {
            void handleAvatarChange(event);
          }}
        />
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-2xl bg-muted border border-border flex items-center justify-center
                       cursor-pointer hover:border-primary/50 transition-colors"
            role="button"
            tabIndex={0}
            aria-label="Upload avatar photo (optional)"
            onClick={() => avatarInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                avatarInputRef.current?.click();
              }
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Selected avatar"
                className="w-full h-full rounded-2xl object-cover"
              />
            ) : (
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-muted-foreground"
                aria-hidden="true"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-foreground">Profile photo</p>
            <p className="text-xs text-muted-foreground">Optional. PNG or JPG, up to 5 MB.</p>
            {avatarUrl && (
              <button
                type="button"
                className="text-xs text-primary underline underline-offset-2 text-left"
                onClick={() => {
                  setAvatarUrl("");
                  setAvatarError(null);
                }}
              >
                Remove photo
              </button>
            )}
            {avatarError && <p className="text-xs text-destructive">{avatarError}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <InputField
            id="profile-username"
            label="Username"
            value={username}
            onChange={(v) => setUsername(v.toLowerCase())}
            placeholder="your_handle"
            error={fieldErrors.username}
            autoComplete="username"
          />
          <InputField
            id="profile-displayname"
            label="Display name"
            value={displayName}
            onChange={setDisplayName}
            placeholder="How you'll appear in Guild Hall"
            error={fieldErrors.displayName}
            autoComplete="name"
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Units
            </span>
            <TabStrip
              options={[
                { value: "metric" as UnitSystem, label: "Metric (kg / km)" },
                { value: "imperial" as UnitSystem, label: "Imperial (lb / mi)" },
              ]}
              value={unitSystem}
              onChange={(v) => setUnitSystem(v as UnitSystem)}
              ariaLabel="Unit system"
            />
          </div>
        </div>

        <div className="mt-auto pt-4">
          <PrimaryBtn onClick={handleNext}>Continue</PrimaryBtn>
        </div>
      </div>
    </Screen>
  );
}
