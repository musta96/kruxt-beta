"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MemberShell } from "@/components/public/MemberShell";
import {
  broadcastPublicSessionRefresh,
  resolvePostAuthPath,
  usePublicSession
} from "@/components/public/usePublicSession";
import {
  loadMemberProfile,
  removeMemberAvatar,
  updateMemberProfile,
  uploadMemberAvatar,
  type MemberProfileDetails
} from "@/lib/public/profile";

export function ProfileScreen() {
  const { state, displayLabel, supabase } = usePublicSession();
  const [profile, setProfile] = useState<MemberProfileDetails | null>(null);
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    bio: "",
    isPublic: true,
    homeGymId: null as string | null
  });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const backofficePath = state.access ? resolvePostAuthPath(state.access) : null;
  const showBackofficeLink = backofficePath === "/admin" || backofficePath === "/org";
  const avatarInitial = useMemo(() => displayLabel.trim().charAt(0).toUpperCase() || "K", [displayLabel]);

  useEffect(() => {
    const currentUser = state.user;
    if (state.status !== "ready" || currentUser == null) return;
    const userId = currentUser.id;
    const userEmail = currentUser.email;

    let active = true;

    async function loadProfile() {
      setLoadingProfile(true);
      setError(null);
      try {
        const nextProfile = await loadMemberProfile(supabase, userId, userEmail);
        if (!active) return;
        setProfile(nextProfile);
        setForm({
          displayName: nextProfile.displayName,
          username: nextProfile.username,
          bio: nextProfile.bio,
          isPublic: nextProfile.isPublic,
          homeGymId: nextProfile.homeGymId
        });
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load profile.");
      } finally {
        if (!active) return;
        setLoadingProfile(false);
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [state.status, state.user, supabase]);

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state.user) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateMemberProfile(supabase, state.user.id, {
        ...form,
        avatarValue: profile?.avatarValue ?? null
      });
      const nextProfile = await loadMemberProfile(supabase, state.user.id, state.user.email);
      setProfile(nextProfile);
      broadcastPublicSessionRefresh();
      setSuccess("Profile updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !state.user) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const uploadResult = await uploadMemberAvatar(supabase, state.user.id, file, profile?.avatarValue);
      await updateMemberProfile(supabase, state.user.id, {
        ...form,
        avatarValue: uploadResult.avatarValue
      });
      const nextProfile = await loadMemberProfile(supabase, state.user.id, state.user.email);
      setProfile(nextProfile);
      broadcastPublicSessionRefresh();
      setSuccess("Avatar updated.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload avatar.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleRemoveAvatar() {
    if (!state.user || !profile?.avatarValue) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      await removeMemberAvatar(supabase, profile.avatarValue);
      await updateMemberProfile(supabase, state.user.id, {
        ...form,
        avatarValue: null
      });
      const nextProfile = await loadMemberProfile(supabase, state.user.id, state.user.email);
      setProfile(nextProfile);
      broadcastPublicSessionRefresh();
      setSuccess("Avatar removed.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove avatar.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <MemberShell
      title="Profile"
      subtitle="Account identity, linked gym access, and the member settings area that now lives in the rebuilt app."
    >
      <section className="split-card">
        <article className="glass-panel">
          <p className="eyebrow">ACCOUNT</p>
          <h2 className="section-title">{displayLabel}</h2>
          <dl className="data-list">
            <div>
              <dt>Email</dt>
              <dd>{state.user?.email ?? "—"}</dd>
            </div>
            <div>
              <dt>Username</dt>
              <dd>{profile?.username ? `@${profile.username}` : "Not set"}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>
                {state.access?.platformRole === "founder"
                  ? "Founder"
                  : state.access?.staffGymIds.length
                  ? "Gym staff"
                  : "Member"}
              </dd>
            </div>
          </dl>
        </article>

        <article className="glass-panel">
          <p className="eyebrow">GYM ACCESS</p>
          <h2 className="section-title">Linked memberships</h2>
          <ul className="membership-list">
            {(profile?.memberships ?? []).map((membership) => (
              <li key={`${membership.gymId}_${membership.role}`} className="membership-item">
                <div>
                  <strong>{membership.gymName}</strong>
                  <p className="feed-body" style={{ margin: "0.25rem 0 0" }}>
                    {membership.role} · {membership.membershipStatus}
                  </p>
                </div>
                <span className="ghost-chip">
                  {membership.startedAt ? new Date(membership.startedAt).toLocaleDateString() : "No start date"}
                </span>
              </li>
            ))}
            {(profile?.memberships.length ?? 0) === 0 && (
              <li className="membership-item">
                <div>
                  <strong>No linked gyms yet</strong>
                  <p className="feed-body" style={{ margin: "0.25rem 0 0" }}>
                    Accept an invite or get added by a gym admin to unlock organization access.
                  </p>
                </div>
              </li>
            )}
          </ul>
        </article>
      </section>

      <section className="glass-panel">
        <div className="profile-avatar-row">
          <div className="avatar-preview">
            {profile?.avatarDisplayUrl ? (
              <img src={profile.avatarDisplayUrl} alt={displayLabel} className="avatar-preview-image" />
            ) : (
              <span className="avatar-fallback">{avatarInitial}</span>
            )}
          </div>
          <div className="profile-avatar-actions">
            <div>
              <p className="field-label">Avatar</p>
              <p className="feed-body" style={{ margin: 0 }}>
                Stored in Supabase storage. This is the live profile surface for the rebuilt app.
              </p>
            </div>
            <div className="stack-actions">
              <label className="secondary-cta" style={{ cursor: "pointer" }}>
                {uploading ? "Uploading..." : "Upload avatar"}
                <input type="file" accept="image/*" hidden onChange={handleAvatarSelected} disabled={uploading} />
              </label>
              {profile?.avatarValue && (
                <button type="button" className="ghost-chip" onClick={() => void handleRemoveAvatar()} disabled={uploading}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <form className="glass-panel profile-form-grid" onSubmit={handleSaveProfile}>
        <div className="profile-form-header">
          <div>
            <p className="eyebrow">SETTINGS</p>
            <h2 className="section-title">Member profile</h2>
          </div>
          {showBackofficeLink && (
            <Link href={backofficePath} className="secondary-cta">
              Open {backofficePath === "/admin" ? "founder console" : "organization workspace"}
            </Link>
          )}
        </div>

        {loadingProfile && <div className="status-banner">Loading profile…</div>}
        {error && <div className="status-banner status-danger">{error}</div>}
        {success && <div className="status-banner status-success">{success}</div>}

        <div className="split-card">
          <div>
            <label className="label" htmlFor="profile-display-name">Display name</label>
            <input
              id="profile-display-name"
              className="input"
              value={form.displayName}
              onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
              placeholder="Edoardo Mustarelli"
            />
          </div>

          <div>
            <label className="label" htmlFor="profile-username">Username</label>
            <input
              id="profile-username"
              className="input"
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value.replace(/\s+/g, "") }))}
              placeholder="musta96"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="profile-bio">Bio</label>
          <textarea
            id="profile-bio"
            className="input profile-bio"
            value={form.bio}
            onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
            placeholder="Training focus, goals, and what people should know about you."
          />
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.isPublic}
            onChange={(event) => setForm((current) => ({ ...current, isPublic: event.target.checked }))}
          />
          <span>
            Keep my member profile public inside KRUXT
            <small className="supporting-copy">You can turn this off if you want a lower-visibility member profile.</small>
          </span>
        </label>

        <div className="stack-actions">
          <button type="submit" className="primary-cta" disabled={saving || uploading || loadingProfile}>
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </form>
    </MemberShell>
  );
}
