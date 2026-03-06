"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GymRole, MembershipStatus } from "@kruxt/types";

import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminAccess } from "@/components/admin/useAdminAccess";
import {
  addMembership,
  listGyms,
  listMemberships,
  searchProfiles,
  updateMembership,
  type GymRecord,
  type MembershipRecord,
  type ProfileSearchResult
} from "@/lib/admin/data";

const ROLE_OPTIONS: GymRole[] = ["leader", "officer", "coach", "member"];
const STATUS_OPTIONS: MembershipStatus[] = ["pending", "trial", "active", "paused", "cancelled"];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function UsersConsole({ scope }: { scope: "founder" | "org" }) {
  const { access, supabase, signOut, canManageGyms, allowedGymIds } = useAdminAccess();

  const [gyms, setGyms] = useState<GymRecord[]>([]);
  const [selectedGymId, setSelectedGymId] = useState("");

  const [memberships, setMemberships] = useState<MembershipRecord[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, GymRole>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, MembershipStatus>>({});

  const [loadingGyms, setLoadingGyms] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<GymRole>("member");
  const [newStatus, setNewStatus] = useState<MembershipStatus>("active");

  const [profileQuery, setProfileQuery] = useState("");
  const [profileResults, setProfileResults] = useState<ProfileSearchResult[]>([]);
  const [searchingProfiles, setSearchingProfiles] = useState(false);

  const canLoadGyms = access.status === "ready" && access.isAuthenticated;
  const canUseAllGyms = scope === "founder" && canManageGyms;

  const loadGyms = useCallback(async () => {
    if (!canLoadGyms) return;
    setLoadingGyms(true);
    setError(null);
    try {
      const visibleGyms = await listGyms(supabase, canUseAllGyms ? null : allowedGymIds);
      setGyms(visibleGyms);
      setSelectedGymId((current) => {
        if (visibleGyms.some((gym) => gym.id === current)) return current;
        return visibleGyms[0]?.id ?? "";
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load gyms.");
      setGyms([]);
      setSelectedGymId("");
    } finally {
      setLoadingGyms(false);
    }
  }, [allowedGymIds, canLoadGyms, canUseAllGyms, supabase]);

  const loadMemberships = useCallback(async () => {
    if (!selectedGymId) {
      setMemberships([]);
      return;
    }
    setLoadingMembers(true);
    setError(null);
    try {
      const rows = await listMemberships(supabase, selectedGymId);
      setMemberships(rows);
      setRoleDrafts(
        Object.fromEntries(rows.map((row) => [row.id, row.role])) as Record<string, GymRole>
      );
      setStatusDrafts(
        Object.fromEntries(rows.map((row) => [row.id, row.membershipStatus])) as Record<
          string,
          MembershipStatus
        >
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load memberships.");
      setMemberships([]);
    } finally {
      setLoadingMembers(false);
    }
  }, [selectedGymId, supabase]);

  useEffect(() => {
    void loadGyms();
  }, [loadGyms]);

  useEffect(() => {
    void loadMemberships();
  }, [loadMemberships]);

  useEffect(() => {
    const query = profileQuery.trim();
    if (query.length < 2) {
      setProfileResults([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setSearchingProfiles(true);
      try {
        const results = await searchProfiles(supabase, query);
        setProfileResults(results);
      } catch {
        setProfileResults([]);
      } finally {
        setSearchingProfiles(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [profileQuery, supabase]);

  const selectedGym = useMemo(
    () => gyms.find((gym) => gym.id === selectedGymId) ?? null,
    [gyms, selectedGymId]
  );

  async function handleUpdateMembership(membershipId: string) {
    const role = roleDrafts[membershipId];
    const membershipStatus = statusDrafts[membershipId];
    if (!role || !membershipStatus) return;

    setPendingKey(`update_${membershipId}`);
    setError(null);
    setSuccess(null);
    try {
      await updateMembership(supabase, { membershipId, role, membershipStatus });
      setSuccess("Membership updated.");
      await loadMemberships();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update membership.");
    } finally {
      setPendingKey(null);
    }
  }

  async function handleAddMembership() {
    if (!selectedGymId) {
      setError("Select a gym first.");
      return;
    }
    if (!newUserId.trim()) {
      setError("User UUID is required.");
      return;
    }
    if (!UUID_REGEX.test(newUserId.trim())) {
      setError("Invalid UUID. Pick a user from search results or paste a valid UUID.");
      return;
    }

    setPendingKey("create_membership");
    setError(null);
    setSuccess(null);
    try {
      await addMembership(supabase, {
        gymId: selectedGymId,
        userId: newUserId.trim(),
        role: newRole,
        membershipStatus: newStatus
      });
      setSuccess("Member added/updated.");
      setNewUserId("");
      setNewRole("member");
      setNewStatus("active");
      setProfileQuery("");
      setProfileResults([]);
      await loadMemberships();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to add membership.");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <AdminShell
      access={access}
      scope={scope}
      onSignOut={signOut}
      title="Users"
      subtitle={
        scope === "founder"
          ? "Founder-level user and role management across gyms"
          : "Organization users and role management"
      }
    >
      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="grid grid-2">
          <div>
            <label className="label" htmlFor={`users-gym-${scope}`}>Gym</label>
            <select
              id={`users-gym-${scope}`}
              className="input"
              value={selectedGymId}
              onChange={(event) => setSelectedGymId(event.target.value)}
              disabled={loadingGyms || gyms.length === 0}
            >
              {gyms.length === 0 && <option value="">No gyms available</option>}
              {gyms.map((gym) => (
                <option key={gym.id} value={gym.id}>
                  {gym.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button className="btn" onClick={() => void loadGyms()} disabled={loadingGyms}>
              {loadingGyms ? "Loading..." : "Refresh gyms"}
            </button>
            <button className="btn" onClick={() => void loadMemberships()} disabled={loadingMembers || !selectedGymId}>
              {loadingMembers ? "Loading..." : "Refresh users"}
            </button>
          </div>
        </div>
        {selectedGym && (
          <p className="subheading" style={{ marginTop: 10 }}>
            Managing users for {selectedGym.name}
          </p>
        )}
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Add user to gym</h3>
        <div className="grid grid-2">
          <div>
            <label className="label" htmlFor={`profile-search-${scope}`}>Find existing profile</label>
            <input
              id={`profile-search-${scope}`}
              className="input"
              placeholder="Search by display name or username"
              value={profileQuery}
              onChange={(event) => setProfileQuery(event.target.value)}
            />
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {searchingProfiles && <span className="subheading">Searching...</span>}
              {!searchingProfiles &&
                profileResults.map((profile) => (
                  <button
                    key={profile.userId}
                    type="button"
                    className="btn"
                    onClick={() => {
                      setNewUserId(profile.userId);
                      setProfileQuery(profile.label);
                    }}
                  >
                    {profile.label}
                  </button>
                ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor={`new-user-id-${scope}`}>User UUID</label>
            <input
              id={`new-user-id-${scope}`}
              className="input"
              placeholder="2249a6b7-67f4-489c-b484-e532d8801fcb"
              value={newUserId}
              onChange={(event) => setNewUserId(event.target.value)}
            />
            <p className="subheading" style={{ marginTop: 8 }}>
              If the user has not signed up yet, send an invite from{" "}
              <Link href={scope === "founder" ? "/admin/invites" : "/org/invites"} style={{ textDecoration: "underline" }}>
                Invites
              </Link>.
            </p>
          </div>
          <div>
            <label className="label" htmlFor={`new-user-role-${scope}`}>Role</label>
            <select
              id={`new-user-role-${scope}`}
              className="input"
              value={newRole}
              onChange={(event) => setNewRole(event.target.value as GymRole)}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`new-user-status-${scope}`}>Membership status</label>
            <select
              id={`new-user-status-${scope}`}
              className="input"
              value={newStatus}
              onChange={(event) => setNewStatus(event.target.value as MembershipStatus)}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              className="btn btn-primary"
              disabled={!selectedGymId || pendingKey === "create_membership"}
              onClick={() => void handleAddMembership()}
            >
              {pendingKey === "create_membership" ? "Saving..." : "Add / update user"}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="panel" style={{ marginBottom: 12, color: "#ff9baa" }}>{error}</div>}
      {success && <div className="panel" style={{ marginBottom: 12, color: "#7ef5df" }}>{success}</div>}

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Gym users</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "8px" }}>User</th>
                <th style={{ padding: "8px" }}>Role</th>
                <th style={{ padding: "8px" }}>Status</th>
                <th style={{ padding: "8px" }}>Started</th>
                <th style={{ padding: "8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((membership) => (
                <tr key={membership.id} style={{ borderBottom: "1px solid #10243d" }}>
                  <td style={{ padding: "8px" }}>
                    <div>{membership.profileLabel}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{membership.userId.slice(0, 8)}...</div>
                  </td>
                  <td style={{ padding: "8px", minWidth: 150 }}>
                    <select
                      className="input"
                      value={roleDrafts[membership.id] ?? membership.role}
                      onChange={(event) =>
                        setRoleDrafts((current) => ({ ...current, [membership.id]: event.target.value as GymRole }))
                      }
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "8px", minWidth: 170 }}>
                    <select
                      className="input"
                      value={statusDrafts[membership.id] ?? membership.membershipStatus}
                      onChange={(event) =>
                        setStatusDrafts((current) => ({
                          ...current,
                          [membership.id]: event.target.value as MembershipStatus
                        }))
                      }
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "8px", color: "var(--muted)", fontSize: 12 }}>
                    {new Date(membership.startedAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "8px" }}>
                    <button
                      className="btn"
                      disabled={pendingKey === `update_${membership.id}`}
                      onClick={() => void handleUpdateMembership(membership.id)}
                    >
                      {pendingKey === `update_${membership.id}` ? "Saving..." : "Save"}
                    </button>
                  </td>
                </tr>
              ))}
              {memberships.length === 0 && !loadingMembers && (
                <tr>
                  <td colSpan={5} style={{ padding: 12, color: "var(--muted)", textAlign: "center" }}>
                    No users found for this gym.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
