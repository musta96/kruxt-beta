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

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2
  }).format(cents / 100);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusTone(status: string): string {
  if (["active", "trialing", "paid"].includes(status)) return "status-success";
  if (["open", "pending", "incomplete", "past_due"].includes(status)) return "status-warning";
  if (["failed", "unpaid", "canceled", "cancelled"].includes(status)) return "status-danger";
  return "";
}

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
  const openInvoices = (profile?.invoices ?? []).filter((invoice) => invoice.status !== "paid");
  const amountDue = openInvoices.reduce((sum, invoice) => sum + invoice.amountDueCents, 0);
  const billingCurrency = openInvoices[0]?.currency ?? profile?.invoices[0]?.currency ?? "USD";

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
                    Request access from a public gym, accept an invite, or get added by a gym admin.
                  </p>
                </div>
                <Link href="/gyms" className="secondary-cta">
                  Find gyms
                </Link>
              </li>
            )}
          </ul>
        </article>
      </section>

      <section className="glass-panel">
        <div className="profile-form-header">
          <div>
            <p className="eyebrow">BILLING</p>
            <h2 className="section-title">Subscriptions and invoices</h2>
          </div>
          <span className={`ghost-chip ${amountDue > 0 ? "is-selected" : ""}`}>
            {amountDue > 0 ? `${formatMoney(amountDue, billingCurrency)} due` : "No balance due"}
          </span>
        </div>

        <div className="split-card" style={{ marginTop: 16 }}>
          <article>
            <p className="field-label">Subscriptions</p>
            <ul className="membership-list">
              {(profile?.subscriptions ?? []).map((subscription) => (
                <li key={subscription.id} className="membership-item">
                  <div>
                    <strong>{subscription.membershipPlanName ?? "Manual subscription"}</strong>
                    <p className="feed-body" style={{ margin: "0.25rem 0 0" }}>
                      {subscription.gymName} · {subscription.provider}
                    </p>
                    <p className="feed-body" style={{ margin: "0.25rem 0 0" }}>
                      {formatDate(subscription.currentPeriodStart)} → {formatDate(subscription.currentPeriodEnd)}
                    </p>
                  </div>
                  <span className={`billing-status ${statusTone(subscription.status)}`}>{subscription.status}</span>
                </li>
              ))}
              {(profile?.subscriptions.length ?? 0) === 0 && (
                <li className="membership-item">
                  <div>
                    <strong>No subscriptions yet</strong>
                    <p className="feed-body" style={{ margin: "0.25rem 0 0" }}>
                      Approved paid gym access will appear here.
                    </p>
                  </div>
                </li>
              )}
            </ul>
          </article>

          <article>
            <p className="field-label">Invoices</p>
            <ul className="membership-list">
              {(profile?.invoices ?? []).slice(0, 5).map((invoice) => {
                const billingInstructions =
                  invoice.status !== "paid" ? profile?.manualBillingByGymId[invoice.gymId] : undefined;

                return (
                  <li key={invoice.id} className="membership-item invoice-item">
                    <div>
                      <strong>{formatMoney(invoice.totalCents, invoice.currency)}</strong>
                      <p className="feed-body" style={{ margin: "0.25rem 0 0" }}>
                        {invoice.gymName} · due {formatDate(invoice.dueAt)}
                      </p>
                      {invoice.invoicePdfUrl ? (
                        <a href={invoice.invoicePdfUrl} className="search-meta" target="_blank" rel="noreferrer">
                          View invoice PDF
                        </a>
                      ) : null}

                      {billingInstructions ? (
                        <div className="billing-instructions">
                          {billingInstructions.instructions ? (
                            <p className="feed-body" style={{ margin: 0 }}>
                              {billingInstructions.instructions}
                            </p>
                          ) : null}
                          <dl className="billing-instruction-grid">
                            {billingInstructions.accountHolder ? (
                              <div>
                                <dt>Holder</dt>
                                <dd>{billingInstructions.accountHolder}</dd>
                              </div>
                            ) : null}
                            {billingInstructions.iban ? (
                              <div>
                                <dt>IBAN</dt>
                                <dd>{billingInstructions.iban}</dd>
                              </div>
                            ) : null}
                            {billingInstructions.paymentReferenceFormat ? (
                              <div>
                                <dt>Reference</dt>
                                <dd>{billingInstructions.paymentReferenceFormat}</dd>
                              </div>
                            ) : null}
                            <div>
                              <dt>Invoice code</dt>
                              <dd>{invoice.id.slice(0, 8)}</dd>
                            </div>
                          </dl>
                          {billingInstructions.bankAccountLabel ? (
                            <span className="search-meta">{billingInstructions.bankAccountLabel}</span>
                          ) : null}
                          {billingInstructions.cashDeskNote ? (
                            <span className="search-meta">{billingInstructions.cashDeskNote}</span>
                          ) : null}
                          {billingInstructions.externalPaymentUrl ? (
                            <a
                              href={billingInstructions.externalPaymentUrl}
                              className="secondary-cta billing-payment-link"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open payment link
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <span className={`billing-status ${statusTone(invoice.status)}`}>{invoice.status}</span>
                  </li>
                );
              })}
              {(profile?.invoices.length ?? 0) === 0 && (
                <li className="membership-item">
                  <div>
                    <strong>No invoices yet</strong>
                    <p className="feed-body" style={{ margin: "0.25rem 0 0" }}>
                      Staff-created invoices for gym plans will show up here.
                    </p>
                  </div>
                </li>
              )}
            </ul>
          </article>
        </div>

        <article style={{ marginTop: 16 }}>
          <p className="field-label">Payment history</p>
          <ul className="membership-list">
            {(profile?.payments ?? []).slice(0, 6).map((payment) => (
              <li key={payment.id} className="membership-item">
                <div>
                  <strong>{formatMoney(payment.amountCents, payment.currency)}</strong>
                  <p className="feed-body" style={{ margin: "0.25rem 0 0" }}>
                    {payment.gymName} · {payment.paymentMethodType ?? payment.provider} · {formatDate(payment.capturedAt ?? payment.createdAt)}
                  </p>
                  {payment.reference ? <span className="search-meta">Reference: {payment.reference}</span> : null}
                  {payment.note ? <span className="search-meta">{payment.note}</span> : null}
                </div>
                <span className={`billing-status ${statusTone(payment.status)}`}>{payment.status}</span>
              </li>
            ))}
            {(profile?.payments.length ?? 0) === 0 && (
              <li className="membership-item">
                <div>
                  <strong>No payments recorded yet</strong>
                  <p className="feed-body" style={{ margin: "0.25rem 0 0" }}>
                    Cash, POS, bank transfer, and future online payments will appear here once recorded.
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
