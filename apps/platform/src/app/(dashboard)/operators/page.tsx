"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PlatformOperatorRole } from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { usePlatformAuth } from "@/contexts/platform-auth-context";
import { OperatorMfa } from "@/components/operator-mfa";
import Link from "next/link";
import {
  loadOperatorPermissionSnapshot,
  saveOperatorPermissionChanges,
  type OperatorAccount,
  type OperatorPermissionSnapshot,
  type PermissionChange,
} from "@/services/operator-permissions";

const ROLES: PlatformOperatorRole[] = [
  "founder", "ops_admin", "support_admin", "compliance_admin", "analyst", "read_only",
];
const control = "min-h-10 rounded-md border border-border bg-kruxt-panel px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const button = control + " hover:bg-muted";
const primary = button + " border-kruxt-platform bg-kruxt-platform text-white hover:bg-kruxt-platform/80";
const overrideLabel = (value: boolean | null) => value === null ? "Inherit" : value ? "Allow" : "Deny";
const defaultLabel = (value: boolean | undefined) => value === undefined ? "Not configured" : value ? "Allow" : "Deny";

function safeError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// Native dialog follows the navigation shell's focus restoration and scroll lock pattern.
function PermissionDialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  return (
    <dialog ref={dialog} aria-labelledby="operator-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-0 m-auto max-h-[100dvh] w-full max-w-3xl overflow-y-auto border border-border bg-kruxt-surface p-0 text-foreground backdrop:bg-black/60 sm:max-h-[90dvh] sm:rounded-lg">
      {children}
    </dialog>
  );
}

export default function OperatorsPage() {
  const { supabase, user, session, platformRole, loading } = usePlatformAuth();
  const identity = useRef({ token: session?.access_token, revision: 0 });
  if (identity.current.token !== session?.access_token) {
    identity.current = { token: session?.access_token, revision: identity.current.revision + 1 };
  }
  if (loading || !user || !platformRole) return <p role="status">Checking operator access...</p>;
  // A changed viewer, credential or role gets a fresh cache and invalidates in-flight UI work.
  return <OperatorWorkspace key={JSON.stringify([user.id, identity.current.revision, platformRole])}
    client={supabase} viewerId={user.id} viewerRole={platformRole} />;
}

function OperatorWorkspace({ client, viewerId, viewerRole }: {
  client: SupabaseClient; viewerId: string; viewerRole: PlatformOperatorRole;
}) {
  const [snapshot, setSnapshot] = useState<OperatorPermissionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [catalogRole, setCatalogRole] = useState<PlatformOperatorRole>("founder");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, PermissionChange>>({});
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"edit" | "review" | "discard">("edit");
  const [confirmed, setConfirmed] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [permissionQuery, setPermissionQuery] = useState("");
  const mounted = useRef(false);
  const busy = useRef(false);
  const revision = useRef(0);
  const editorFocus = useRef<HTMLButtonElement>(null);
  const changes = Object.values(draft);
  const dirty = changes.length > 0 || reason.trim().length > 0;
  const selected = snapshot?.operators.find((operator) => operator.userId === selectedId);
  const viewer = snapshot?.operators.find((operator) => operator.userId === viewerId);
  const canEdit = viewerRole === "founder" && viewer?.role === "founder" && viewer.isActive && selected?.role !== "founder";
  const catalog = useMemo(() => (snapshot?.catalog ?? []).filter((row) => row.is_active), [snapshot]);
  const roleDefaults = useMemo(() => new Map((snapshot?.rolePermissions ?? []).map((row) =>
    [JSON.stringify([row.role, row.permission_key]), row.is_allowed])), [snapshot]);
  const overrides = useMemo(() => new Map((snapshot?.overrides ?? []).map((row) =>
    [JSON.stringify([row.user_id, row.permission_key]), row.is_allowed])), [snapshot]);
  const baseline = (role: PlatformOperatorRole, key: string) => roleDefaults.get(JSON.stringify([role, key]));
  const persisted = (userId: string, key: string) => overrides.get(JSON.stringify([userId, key])) ?? null;
  const visibleOperators = (snapshot?.operators ?? []).filter((operator) =>
    (roleFilter === "all" || operator.role === roleFilter) &&
    [operator.displayName, operator.email, operator.username, operator.userId].some((value) =>
      value?.toLowerCase().includes(query.trim().toLowerCase())));
  const visiblePermissions = catalog.filter((row) =>
    [row.label, row.permission_key, row.category].some((value) => value.toLowerCase().includes(permissionQuery.trim().toLowerCase())));

  async function reload() {
    const request = ++revision.current;
    setLoading(true);
    setError(null);
    setSnapshot(null);
    try {
      const next = await loadOperatorPermissionSnapshot(client, viewerId);
      if (!mounted.current || request !== revision.current) return;
      setSnapshot(next);
      return true;
    } catch (loadError) {
      if (mounted.current && request === revision.current) {
        setError(safeError(loadError, "Operator permissions could not be loaded. Retry."));
      }
    } finally {
      if (mounted.current && request === revision.current) setLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => { mounted.current = false; revision.current += 1; };
    // The parent remounts this workspace whenever viewer identity or credentials change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, viewerId]);

  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);

  useEffect(() => {
    if (selected && !loading) editorFocus.current?.focus();
  }, [mode, selectedId, loading, selected]);

  function resetEditor(target: string | null) {
    setDraft({});
    setReason("");
    setMode("edit");
    setConfirmed(false);
    setPermissionQuery("");
    setSelectedId(target);
    setError(null);
  }

  function requestTarget(target: string | null) {
    if (busy.current) return;
    if (dirty) {
      setPendingTarget(target);
      setMode("discard");
      return;
    }
    resetEditor(target);
  }

  function changeOverride(operator: OperatorAccount, key: string, value: boolean | null) {
    if (busy.current || !canEdit || mode !== "edit") return;
    const previousValue = persisted(operator.userId, key);
    setDraft((current) => {
      const next = { ...current };
      if (previousValue === value) delete next[key];
      else next[key] = { permissionKey: key, value, previousValue };
      return next;
    });
    setNotice(null);
    setConfirmed(false);
  }

  async function save() {
    if (busy.current || !canEdit || !selected || mode !== "review" || !confirmed || !reason.trim() || !changes.length) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    const request = revision.current;
    let result;
    try {
      result = await saveOperatorPermissionChanges(client, {
        viewerId, targetUserId: selected.userId, reason: reason.trim(),
        changes: changes.map((change) => ({ ...change })),
      });
    } catch (saveError) {
      if (mounted.current && request === revision.current) {
        setError(safeError(saveError, "Changes could not be submitted. Verify your founder session and required MFA, then reload and review."));
        setMode("edit");
        setConfirmed(false);
      }
      if (mounted.current) setSaving(false);
      busy.current = false;
      return;
    }
    if (!mounted.current || request !== revision.current) { busy.current = false; return; }
    // RPCs commit independently. A returned outcome always consumes this draft.
    setDraft({});
    setReason("");
    setConfirmed(false);
    setMode("edit");
    setNotice(`${result.confirmedKeys.length} confirmed; ${result.unconfirmedKeys.length} unconfirmed. ` +
      (result.outcome === "complete"
        ? "Reloading authoritative permissions."
        : "Unconfirmed changes may or may not have applied. Verify your founder session and required MFA, then reload and review before retrying."));
    // Reload owns its error: a failed read must not be reported as a failed mutation.
    const reloaded = await reload();
    if (mounted.current) {
      setSaving(false);
      setNotice((current) => {
        if (!current) return null;
        return reloaded
          ? current.replace("Reloading authoritative permissions.", "Authoritative permissions reloaded.")
          : current.replace("Reloading authoritative permissions.", "") + " Authoritative reload failed. Current access is unavailable; reload before continuing.";
      });
    }
    busy.current = false;
  }

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Operators</h1>
        <button type="button" className={button} disabled={loading || saving || dirty} onClick={() => { setNotice(null); void reload(); }}>
          {loading ? "Loading..." : "Reload permissions"}
        </button>
      </header>
      <p className="max-w-prose text-sm text-muted-foreground">
        Some access controls still depend on built-in roles. Catalog changes apply only to controls that check the matching permission key.
      </p>
      {notice && <p role="status" className="border-y border-border py-3 text-sm">{notice}</p>}
      {error && <p role="alert" className="border-y border-kruxt-danger/40 py-3 text-sm text-kruxt-danger">{error} Reload permissions to retry.</p>}
      {viewerRole === "founder" && viewer?.role === "founder" && viewer.isActive && (
        <section aria-labelledby="founder-verification-heading" className="space-y-3 border-t border-border pt-4">
          <h2 id="founder-verification-heading" className="text-sm font-semibold">Founder verification</h2>
          <p className="text-sm text-muted-foreground">Verify MFA before editing. Verification refreshes your session and clears unsaved drafts.</p>
          <OperatorMfa client={client} viewerId={viewerId} />
        </section>
      )}
      <section aria-labelledby="operators-heading" className="border-y border-border">
        <div className="flex flex-wrap items-end gap-3 py-4">
          <h2 id="operators-heading" className="sr-only">Operator accounts</h2>
          <label className="min-w-0 flex-1 text-sm">Find operator
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, email or account ID" className={control + " mt-1 w-full"} />
          </label>
          <label className="text-sm">Built-in role
            <select aria-label="Built-in role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className={control + " mt-1 block w-full"}>
              <option value="all">All roles</option>
              {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
        </div>
        {loading ? <p role="status" className="py-8 text-sm text-muted-foreground">Loading operator accounts and permission catalog...</p>
          : !snapshot ? <p className="py-6 text-sm">No verified snapshot available. Reload permissions to continue.</p>
          : !visibleOperators.length ? <p className="py-6 text-sm">No operators match the current filters.</p>
          : <ul className="divide-y divide-border">
            {visibleOperators.map((operator) => (
              <li key={operator.userId}>
                <button type="button" onClick={() => requestTarget(operator.userId)}
                  className="grid min-h-20 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-left hover:bg-kruxt-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-semibold">{operator.displayName}</span>
                    <span className="block break-all text-xs text-muted-foreground">{operator.email ?? operator.username ?? operator.userId}</span>
                    <span className="mt-1 block break-all text-xs text-muted-foreground">{operator.role}</span>
                  </span>
                  <span className="text-right text-xs">
                    <span className={operator.isActive ? "text-kruxt-success" : "text-kruxt-danger"}>{operator.isActive ? "Active" : "Inactive"}</span>
                    <span className="mt-1 block text-muted-foreground">{operator.overrideCount} overrides</span>
                    <span className="mt-1 block text-kruxt-platform">View permissions</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>}
      </section>
      <section aria-labelledby="availability-heading" className="space-y-2 text-sm">
        <h2 id="availability-heading" className="font-semibold">Availability</h2>
        <p className="text-muted-foreground">Operator invitations are unavailable here: no invitation RPC is connected.</p>
        <Link href="/operator-role-profiles" className="inline-block underline underline-offset-4">Custom role profiles and resolved access</Link>
      </section>
      {snapshot && <details className="border-y border-border py-4">
        <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Built-in role defaults</summary>
        <label className="mt-4 block text-sm">Inspect built-in role
          <select aria-label="Inspect built-in role" value={catalogRole} onChange={(event) => setCatalogRole(event.target.value as PlatformOperatorRole)} className={control + " ml-0 mt-1 block sm:ml-3 sm:inline-block"}>
            {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>
        <p className="mt-3 text-xs text-muted-foreground">Read-only catalog defaults. Not configured is distinct from an explicit deny.</p>
        {!catalog.length && <p className="py-4 text-sm">No active permissions are configured.</p>}
        <ul className="mt-3 divide-y divide-border">
          {catalog.map((row) => <li key={row.permission_key} className="flex items-start justify-between gap-3 py-3 text-sm">
            <span className="min-w-0"><span className="block font-medium">{row.label}</span>
              <span className="block text-xs text-muted-foreground">{row.category}</span>
              <code className="block break-all text-xs text-muted-foreground">{row.permission_key}</code></span>
            <span className="shrink-0">{defaultLabel(baseline(catalogRole, row.permission_key))}</span>
          </li>)}
        </ul>
      </details>}

      {selectedId && selected && <PermissionDialog onClose={() => requestTarget(null)}>
        <header className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-6">
          <div className="min-w-0">
            <h2 id="operator-title" className="break-words text-lg font-semibold">{selected.displayName}</h2>
            <p className="break-all text-sm text-muted-foreground">{selected.email ?? selected.userId}</p>
            <p className="mt-1 text-xs text-muted-foreground">{selected.role} / {selected.isActive ? "Active" : "Inactive"}</p>
          </div>
          <button ref={editorFocus} type="button" className={button} disabled={saving} onClick={() => requestTarget(null)}>Close</button>
        </header>
        <div className="space-y-4 p-4 sm:p-6">
          {error && <p role="alert" className="text-sm text-kruxt-danger">{error}</p>}
          {notice && <p role="status" className="text-sm">{notice}</p>}
          {mode === "discard" ? (
            <section aria-labelledby="discard-title" className="space-y-4">
              <h3 id="discard-title" className="font-semibold">Discard unsaved changes?</h3>
              <p className="text-sm text-muted-foreground">Your permission draft and reason have not been submitted.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={primary} onClick={() => setMode("edit")}>Keep editing</button>
                <button type="button" className={button} onClick={() => resetEditor(pendingTarget)}>Discard changes</button>
              </div>
            </section>
          ) : mode === "review" ? (
            <section aria-labelledby="review-title" className="space-y-4">
              <h3 id="review-title" className="font-semibold">Review permission changes</h3>
              <p className="break-words text-sm"><strong>Reason:</strong> {reason}</p>
              <ul className="divide-y divide-border">
                {changes.map((change) => <li key={change.permissionKey} className="py-3 text-sm">
                  <span className="block font-medium">{catalog.find((row) => row.permission_key === change.permissionKey)?.label ?? change.permissionKey}</span>
                  <code className="block break-all text-xs text-muted-foreground">{change.permissionKey}</code>
                  <span className="mt-1 block">{overrideLabel(change.previousValue)} to {overrideLabel(change.value)}</span>
                </li>)}
              </ul>
              <p className="text-sm text-muted-foreground">Changes are submitted independently and can be partially confirmed. Required MFA must be verified by the server.</p>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={confirmed} disabled={saving} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-kruxt-platform" />
                <span>I confirm these {changes.length} changes for {selected.displayName}.</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={button} disabled={saving} onClick={() => { setMode("edit"); setConfirmed(false); }}>Back to editing</button>
                <button type="button" className={primary} disabled={saving || !confirmed || !canEdit} onClick={() => void save()}>
                  {saving ? "Submitting and reloading..." : "Confirm permission changes"}
                </button>
              </div>
            </section>
          ) : (
            <>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">MFA policy</dt><dd>{selected.mfaRequired ? "Required" : "Not required"} (not enrollment status)</dd></div>
                <div><dt className="text-muted-foreground">Last login</dt><dd>{selected.lastLoginAt ? new Date(selected.lastLoginAt).toLocaleString() : "No login recorded"}</dd></div>
              </dl>
              {selected.role === "founder" ? <p className="text-sm text-muted-foreground">Founder overrides are immutable here. Catalog defaults are shown without assuming full access.</p>
                : !canEdit && <p className="text-sm text-muted-foreground">Only an active founder can edit operator overrides.</p>}
              {!selected.isActive && <p className="text-sm text-kruxt-warning">Inactive account: effective access is denied, including draft allows.</p>}
              <label className="block text-sm">Find permission
                <input type="search" value={permissionQuery} onChange={(event) => setPermissionQuery(event.target.value)}
                  className={control + " mt-1 w-full"} placeholder="Label, category or permission key" />
              </label>
              {!visiblePermissions.length && <p className="text-sm text-muted-foreground">No active permissions match.</p>}
              <ul className="divide-y divide-border">
                {visiblePermissions.map((row) => {
                  const value = draft[row.permission_key]?.value !== undefined ? draft[row.permission_key].value : persisted(selected.userId, row.permission_key);
                  const roleValue = baseline(selected.role, row.permission_key);
                  const effective = selected.isActive && (value ?? roleValue ?? false);
                  return <li key={row.permission_key} className="grid min-w-0 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">{row.category}{row.is_sensitive ? " / Sensitive" : ""}</div>
                      <h3 className="break-words text-sm font-semibold">{row.label}</h3>
                      <code className="block break-all text-xs text-muted-foreground">{row.permission_key}</code>
                      {row.description && <p className="mt-1 break-words text-xs text-muted-foreground">{row.description}</p>}
                      <p className="mt-2 text-xs">Role default: {defaultLabel(roleValue)}</p>
                      <p className="mt-1 text-xs">{["platform.tenants.view", "platform.flags.view", "platform.audit.view", "platform.system_health.view"].includes(row.permission_key) ? "Built-in + override" : "Effective"}{draft[row.permission_key] ? " preview" : ""}: <strong className={effective ? "text-kruxt-success" : "text-kruxt-danger"}>{effective ? "Allow" : "Deny"}</strong>
                        {!selected.isActive ? " (inactive)" : value === null ? " (inherited)" : " (override)"}</p>
                      {["platform.tenants.view", "platform.flags.view", "platform.audit.view", "platform.system_health.view"].includes(row.permission_key) && <p className="mt-1 text-xs text-muted-foreground">Profile contributions are listed under resolved access.</p>}
                    </div>
                    <label className="text-xs">Override for {row.label}
                      <select aria-label={`Override for ${row.label}`} value={value === null ? "inherit" : value ? "allow" : "deny"}
                        disabled={!canEdit || saving} className={control + " mt-1 w-full"}
                        onChange={(event) => changeOverride(selected, row.permission_key, event.target.value === "inherit" ? null : event.target.value === "allow")}>
                        <option value="inherit">Inherit</option><option value="allow">Allow</option><option value="deny">Deny</option>
                      </select>
                      {draft[row.permission_key] && <span className="mt-1 block text-kruxt-warning">Unsaved change</span>}
                    </label>
                  </li>;
                })}
              </ul>
              {canEdit && <div className="space-y-3 border-t border-border pt-4">
                <label className="block text-sm">Reason for changes
                  <textarea value={reason} maxLength={2000} disabled={saving} onChange={(event) => setReason(event.target.value)}
                    className={control + " mt-1 min-h-24 w-full resize-y"} />
                </label>
                <button type="button" className={primary} disabled={saving || !changes.length || changes.length > 100 || !reason.trim()}
                  onClick={() => { setMode("review"); setConfirmed(false); }}>Review {changes.length} changes</button>
                {changes.length > 100 && <p role="alert" className="text-sm text-kruxt-warning">Review at most 100 changes per submission.</p>}
              </div>}
            </>
          )}
        </div>
      </PermissionDialog>}
    </div>
  );
}
