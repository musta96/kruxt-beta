"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ErrorBanner } from "@/components/error-banner";
import { PageSkeleton } from "@/components/loading-skeleton";
import { Modal } from "@/components/modal";
import { useGym } from "@/contexts/gym-context";
import { useServices } from "@/hooks/use-services";
import { useAsync } from "@/hooks/use-async";
import type { GymJoinRequestDirectoryItem, GymMemberDirectoryItem, StaffProfileOption } from "@/services";
import type { GymInviteCode } from "@kruxt/types";
import type { GymRole, MembershipStatus } from "@kruxt/types";

const INPUT =
  "w-full rounded-lg border border-border bg-kruxt-panel px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none focus:ring-1 focus:ring-kruxt-accent/40";

type StatusFilter = "all" | MembershipStatus;

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "trial", label: "Trial" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
];

interface AddMemberForm {
  userId: string;
  profileQuery: string;
  role: GymRole;
  membershipStatus: MembershipStatus;
  membershipPlanId: string;
  coachUserId: string;
}

const defaultAddForm: AddMemberForm = {
  userId: "",
  profileQuery: "",
  role: "member",
  membershipStatus: "active",
  membershipPlanId: "",
  coachUserId: "",
};

function memberLabel(member: GymMemberDirectoryItem): string {
  return member.profile?.label ?? `${member.userId.slice(0, 8)}...`;
}

function memberSecondaryLabel(member: GymMemberDirectoryItem): string {
  if (member.profile?.username) return `@${member.profile.username}`;
  return `Profile ${member.userId.slice(0, 8)}`;
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inviteUrl(code: string): string {
  if (typeof window === "undefined") return `/join?code=${encodeURIComponent(code)}`;
  const publicOrigin = process.env.NEXT_PUBLIC_KRUXT_WEB_URL || window.location.origin;
  return `${publicOrigin.replace(/\/$/, "")}/join?code=${encodeURIComponent(code)}`;
}

function ProfileSearchResults({
  options,
  loading,
  onSelect,
}: {
  options: StaffProfileOption[];
  loading: boolean;
  onSelect: (option: StaffProfileOption) => void;
}) {
  if (loading) {
    return <p className="mt-2 text-xs text-muted-foreground">Searching profiles...</p>;
  }

  if (options.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border bg-card">
      {options.map((option) => (
        <button
          key={option.userId}
          type="button"
          onClick={() => onSelect(option)}
          className="block w-full border-b border-border px-3 py-2 text-left text-sm text-foreground transition-colors last:border-b-0 hover:bg-kruxt-panel"
        >
          <span className="font-medium">{option.displayName}</span>
          {option.username && <span className="ml-2 text-xs text-muted-foreground">@{option.username}</span>}
        </button>
      ))}
    </div>
  );
}

export default function MembersPage() {
  const { gymId } = useGym();
  const { gym } = useServices();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddMemberForm>(defaultAddForm);
  const [profileOptions, setProfileOptions] = useState<StaffProfileOption[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | undefined>();
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | undefined>();
  const [managedMember, setManagedMember] = useState<GymMemberDirectoryItem | null>(null);
  const [managedCoachId, setManagedCoachId] = useState("");
  const [managedRole, setManagedRole] = useState<GymRole>("member");
  const [managedStatus, setManagedStatus] = useState<MembershipStatus>("active");
  const [managedPlanId, setManagedPlanId] = useState("");
  const [planTitle, setPlanTitle] = useState("");
  const [planGoal, setPlanGoal] = useState("");
  const [planNotes, setPlanNotes] = useState("");
  const [manageLoading, setManageLoading] = useState(false);
  const [manageError, setManageError] = useState<string | undefined>();
  const [inviteLabel, setInviteLabel] = useState("Front desk invite");
  const [inviteAccess, setInviteAccess] = useState<"active" | "pending">("active");
  const [invitePlanId, setInvitePlanId] = useState("");
  const [inviteLimit, setInviteLimit] = useState("25");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | undefined>();
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [requestActionId, setRequestActionId] = useState<string | null>(null);

  const { status, data, error, refetch } = useAsync(
    () => gym.listGymMemberDirectory(gymId),
    [gymId]
  );

  const staffOptionsState = useAsync(
    () => gym.listStaffProfileOptions(gymId),
    [gymId]
  );

  const inviteCodesState = useAsync(
    () => gym.listGymInviteCodes(gymId),
    [gymId]
  );

  const joinRequestsState = useAsync(
    () => gym.listGymJoinRequests(gymId, "pending"),
    [gymId]
  );

  const membershipPlansState = useAsync(
    () => gym.listMembershipPlanOptions(gymId),
    [gymId]
  );

  useEffect(() => {
    let active = true;
    const query = addForm.profileQuery.trim();

    if (!showAdd || query.length < 2) {
      setProfileOptions([]);
      setProfileLoading(false);
      return () => {
        active = false;
      };
    }

    const timeout = window.setTimeout(async () => {
      setProfileLoading(true);
      try {
        const profiles = await gym.searchProfiles(gymId, query);
        if (active) setProfileOptions(profiles);
      } catch (profileError) {
        if (active) setAddError(profileError instanceof Error ? profileError.message : "Profile search failed.");
      } finally {
        if (active) setProfileLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [addForm.profileQuery, gym, gymId, showAdd]);

  useEffect(() => {
    let active = true;
    const invites = (inviteCodesState.data ?? []).filter((invite) => invite.isActive).slice(0, 3);

    if (invites.length === 0) {
      setQrCodes({});
      return () => {
        active = false;
      };
    }

    Promise.all(
      invites.map(async (invite) => {
        const dataUrl = await QRCode.toDataURL(inviteUrl(invite.code), {
          margin: 1,
          width: 144,
          color: {
            dark: "#0E1116",
            light: "#FFFFFF",
          },
        });
        return [invite.id, dataUrl] as const;
      })
    )
      .then((entries) => {
        if (active) setQrCodes(Object.fromEntries(entries));
      })
      .catch(() => {
        if (active) setQrCodes({});
      });

    return () => {
      active = false;
    };
  }, [inviteCodesState.data]);

  const staffOptions = staffOptionsState.data ?? [];
  const membershipPlanOptions = membershipPlansState.data ?? [];

  const handleAddMember = async () => {
    if (!addForm.userId.trim()) {
      setAddError("Pick a profile from search results. For a brand-new person, invite them first so their profile exists.");
      return;
    }
    setAddLoading(true);
    setAddError(undefined);
    try {
      const membership = await gym.addOrUpdateMembership(gymId, {
        userId: addForm.userId.trim(),
        role: addForm.role,
        membershipStatus: addForm.membershipStatus,
        membershipPlanId: addForm.membershipPlanId || null,
      });
      if (addForm.coachUserId) {
        await gym.assignMembershipCoach(gymId, membership.id, addForm.coachUserId);
      }
      setShowAdd(false);
      setAddForm(defaultAddForm);
      setProfileOptions([]);
      refetch();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add member");
    } finally {
      setAddLoading(false);
    }
  };

  const handleStatusChange = useCallback(
    async (membershipId: string, newStatus: MembershipStatus) => {
      setActionId(membershipId);
      setActionError(undefined);
      try {
        await gym.updateMembershipStatus(gymId, membershipId, newStatus);
        refetch();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Action failed");
      } finally {
        setActionId(null);
      }
    },
    [gym, gymId, refetch]
  );

  const openManageModal = (member: GymMemberDirectoryItem) => {
    setManagedMember(member);
    setManagedCoachId(member.coachUserId ?? "");
    setManagedRole(member.role);
    setManagedStatus(member.membershipStatus);
    setManagedPlanId(member.membershipPlanId ?? "");
    setPlanTitle("");
    setPlanGoal("");
    setPlanNotes("");
    setManageError(undefined);
  };

  const handleSaveMemberDetails = async () => {
    if (!managedMember) return;
    setManageLoading(true);
    setManageError(undefined);
    try {
      await gym.updateMembershipDetails(gymId, managedMember.id, {
        role: managedRole,
        membershipStatus: managedStatus,
        membershipPlanId: managedPlanId || null,
      });
      const selectedPlan = membershipPlanOptions.find((plan) => plan.id === managedPlanId);
      setManagedMember((member) =>
        member
          ? {
              ...member,
              role: managedRole,
              membershipStatus: managedStatus,
              membershipPlanId: managedPlanId || null,
              membershipPlanName: selectedPlan?.name ?? null,
            }
          : member
      );
      refetch();
    } catch (e) {
      setManageError(e instanceof Error ? e.message : "Unable to update member details.");
    } finally {
      setManageLoading(false);
    }
  };

  const handleSaveCoach = async () => {
    if (!managedMember) return;
    setManageLoading(true);
    setManageError(undefined);
    try {
      await gym.assignMembershipCoach(gymId, managedMember.id, managedCoachId || null);
      const selectedCoach = staffOptions.find((staff) => staff.userId === managedCoachId);
      setManagedMember((member) =>
        member
          ? {
              ...member,
              coachUserId: managedCoachId || null,
              coachProfile: selectedCoach ?? null,
            }
          : member
      );
      refetch();
    } catch (e) {
      setManageError(e instanceof Error ? e.message : "Unable to update personal trainer.");
    } finally {
      setManageLoading(false);
    }
  };

  const handleCreateWorkoutPlan = async () => {
    if (!managedMember) return;
    if (!planTitle.trim()) {
      setManageError("Workout plan title is required.");
      return;
    }
    setManageLoading(true);
    setManageError(undefined);
    try {
      await gym.createMemberWorkoutPlan(gymId, {
        memberUserId: managedMember.userId,
        coachUserId: managedCoachId || managedMember.coachUserId || null,
        title: planTitle.trim(),
        goal: planGoal.trim() || null,
        status: "active",
        planJson: {
          notes: planNotes.trim(),
          source: "admin_members_page"
        },
      });
      setPlanTitle("");
      setPlanGoal("");
      setPlanNotes("");
      refetch();
    } catch (e) {
      setManageError(e instanceof Error ? e.message : "Unable to create workout plan.");
    } finally {
      setManageLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    setInviteLoading(true);
    setInviteError(undefined);
    try {
      await gym.createGymInviteCode(gymId, {
        label: inviteLabel.trim() || "Gym invite",
        membershipStatus: inviteAccess,
        membershipPlanId: invitePlanId || null,
        maxRedemptions: inviteLimit.trim() ? Number(inviteLimit) : null,
      });
      inviteCodesState.refetch();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Unable to create invite link.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleReviewJoinRequest = async (
    request: GymJoinRequestDirectoryItem,
    nextStatus: "approved" | "rejected"
  ) => {
    setRequestActionId(request.id);
    setActionError(undefined);
    try {
      await gym.reviewGymJoinRequest(gymId, {
        requestId: request.id,
        nextStatus,
      });
      joinRequestsState.refetch();
      refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unable to review access request.");
    } finally {
      setRequestActionId(null);
    }
  };

  const copyInvite = async (invite: GymInviteCode) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(invite.code));
      setInviteError(undefined);
    } catch {
      setInviteError("Copy failed. Select and copy the invite link manually.");
    }
  };

  if (status === "loading" || status === "idle") return <PageSkeleton />;

  if (status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Members" description="Manage gym members, roles, personal trainers, and workout plans." />
        <ErrorBanner message={error} onRetry={refetch} />
      </div>
    );
  }

  const members = data ?? [];

  const filtered = members.filter((member) => {
    if (statusFilter !== "all" && member.membershipStatus !== statusFilter) return false;
    if (search) {
      const query = search.toLowerCase();
      const haystack = [
        member.userId,
        member.role,
        member.membershipPlanName,
        member.profile?.displayName,
        member.profile?.username,
        member.coachProfile?.displayName,
        member.coachProfile?.username,
        member.latestWorkoutPlan?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const activeCount = members.filter((m) => m.membershipStatus === "active").length;
  const pendingCount = members.filter((m) => m.membershipStatus === "pending").length;
  const coachedCount = members.filter((m) => Boolean(m.coachUserId)).length;
  const pendingRequests = joinRequestsState.data ?? [];
  const activeInvites = (inviteCodesState.data ?? []).filter((invite) => invite.isActive);

  const columns: Column<GymMemberDirectoryItem>[] = [
    {
      key: "name",
      header: "Member",
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{memberLabel(row)}</p>
          <p className="text-xs text-muted-foreground">{memberSecondaryLabel(row)}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (row) => <span className="text-sm capitalize text-muted-foreground">{row.role}</span>,
    },
    {
      key: "membershipStatus",
      header: "Status",
      render: (row) => (
        <StatusBadge label={row.membershipStatus} variant={statusToVariant(row.membershipStatus)} dot />
      ),
    },
    {
      key: "membership",
      header: "Membership",
      render: (row) => (
        <div>
          <p className="text-sm text-foreground">{row.membershipPlanName ?? "No plan assigned"}</p>
          <p className="text-xs text-muted-foreground">{row.membershipPlanId ? "Plan linked" : "Manual access"}</p>
        </div>
      ),
    },
    {
      key: "coach",
      header: "PT",
      render: (row) =>
        row.coachProfile ? (
          <span className="text-sm text-foreground">{row.coachProfile.label}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        ),
    },
    {
      key: "plan",
      header: "Workout Plan",
      render: (row) =>
        row.latestWorkoutPlan ? (
          <div>
            <p className="text-sm font-medium text-foreground">{row.latestWorkoutPlan.title}</p>
            <p className="text-xs capitalize text-muted-foreground">{row.latestWorkoutPlan.status}</p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No plan</span>
        ),
    },
    {
      key: "startedAt",
      header: "Started",
      sortable: true,
      render: (row) => (
        <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
          {formatDate(row.startedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-44",
      render: (row) => {
        const loading = actionId === row.id;
        return (
          <div className="flex flex-wrap gap-2">
            {row.membershipStatus === "pending" && (
              <button
                onClick={() => handleStatusChange(row.id, "active")}
                disabled={loading}
                className="rounded-button bg-kruxt-success/15 px-2.5 py-1 text-xs font-medium text-kruxt-success transition-colors hover:bg-kruxt-success/25 disabled:opacity-50"
              >
                {loading ? "..." : "Approve"}
              </button>
            )}
            {(row.membershipStatus === "active" || row.membershipStatus === "trial") && (
              <button
                onClick={() => handleStatusChange(row.id, "paused")}
                disabled={loading}
                className="rounded-button border border-kruxt-warning/40 px-2.5 py-1 text-xs font-medium text-kruxt-warning transition-colors hover:bg-kruxt-warning/10 disabled:opacity-50"
              >
                {loading ? "..." : "Pause"}
              </button>
            )}
            {row.membershipStatus === "paused" && (
              <button
                onClick={() => handleStatusChange(row.id, "active")}
                disabled={loading}
                className="rounded-button bg-kruxt-accent/15 px-2.5 py-1 text-xs font-medium text-kruxt-accent transition-colors hover:bg-kruxt-accent/25 disabled:opacity-50"
              >
                {loading ? "..." : "Reactivate"}
              </button>
            )}
            <button
              onClick={() => openManageModal(row)}
              className="rounded-button border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-kruxt-panel"
            >
              Manage
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description="Manage real profiles, access, assigned PTs, and member workout plans."
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90"
          >
            + Add Member
          </button>
        }
      />

      {actionError && <ErrorBanner message={actionError} onRetry={() => setActionError(undefined)} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active Members" value={activeCount} accent="success" />
        <StatCard label="Pending Approval" value={pendingCount + pendingRequests.length} accent="warning" />
        <StatCard label="Assigned PT" value={coachedCount} accent="default" />
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-card border border-border bg-card p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground font-kruxt-headline">Pending Gym Access</h2>
              <p className="text-xs text-muted-foreground">
                Members create public profiles themselves, then request access to this gym's private area.
              </p>
            </div>
            <button
              onClick={joinRequestsState.refetch}
              className="rounded-button border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel"
            >
              Refresh
            </button>
          </div>
          {joinRequestsState.status === "error" && (
            <p className="mt-3 rounded-lg bg-kruxt-danger/10 px-3 py-2 text-xs text-kruxt-danger">
              {joinRequestsState.error}
            </p>
          )}
          {pendingRequests.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No pending access requests.</p>
          ) : (
            <div className="mt-4 divide-y divide-border rounded-lg border border-border">
              {pendingRequests.map((request) => {
                const loading = requestActionId === request.id;
                return (
                  <div key={request.id} className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {request.profile?.label ?? request.userId.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {request.source === "invite_code" ? `Invite: ${request.inviteLabel ?? "code"}` : "Public request"}
                        {request.membershipPlanName ? ` / ${request.membershipPlanName}` : ""}
                      </p>
                      {request.note && <p className="mt-1 text-xs text-muted-foreground">{request.note}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReviewJoinRequest(request, "approved")}
                        disabled={loading}
                        className="rounded-button bg-kruxt-success/15 px-3 py-1.5 text-xs font-semibold text-kruxt-success transition-colors hover:bg-kruxt-success/25 disabled:opacity-50"
                      >
                        {loading ? "..." : "Approve"}
                      </button>
                      <button
                        onClick={() => handleReviewJoinRequest(request, "rejected")}
                        disabled={loading}
                        className="rounded-button border border-kruxt-danger/40 px-3 py-1.5 text-xs font-semibold text-kruxt-danger transition-colors hover:bg-kruxt-danger/10 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-card border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground font-kruxt-headline">Invite Link / QR</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Use this for reception, posters, or DMs. The QR opens the join flow with the code prefilled.
          </p>
          {inviteError && (
            <p className="mt-3 rounded-lg bg-kruxt-danger/10 px-3 py-2 text-xs text-kruxt-danger">{inviteError}</p>
          )}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)_minmax(0,1fr)_110px]">
            <input
              value={inviteLabel}
              onChange={(event) => setInviteLabel(event.target.value)}
              className={INPUT}
              placeholder="Invite label"
            />
            <input
              value={inviteLimit}
              onChange={(event) => setInviteLimit(event.target.value.replace(/\D/g, ""))}
              className={INPUT}
              placeholder="Limit"
            />
            <select
              value={inviteAccess}
              onChange={(event) => setInviteAccess(event.target.value as "active" | "pending")}
              className={INPUT}
            >
              <option value="active">Instant private access</option>
              <option value="pending">Request approval after scan</option>
            </select>
            <select value={invitePlanId} onChange={(event) => setInvitePlanId(event.target.value)} className={INPUT}>
              <option value="">No default plan</option>
              {membershipPlanOptions.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleCreateInvite}
              disabled={inviteLoading}
              className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {inviteLoading ? "Creating..." : "Create"}
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {activeInvites.slice(0, 3).map((invite) => {
              const invitePlanName = invite.membershipPlanId
                ? membershipPlanOptions.find((plan) => plan.id === invite.membershipPlanId)?.name ?? "Plan linked"
                : "No default plan";

              return (
                <div key={invite.id} className="rounded-lg border border-border bg-kruxt-panel/35 p-3">
                  <div className="flex gap-3">
                    {qrCodes[invite.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrCodes[invite.id]} alt="" className="h-24 w-24 rounded-md bg-white p-1" />
                    ) : (
                      <div className="h-24 w-24 rounded-md bg-card" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{invite.label || invite.code}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {invite.membershipStatus === "active" ? "Instant access" : "Approval required"} / {invitePlanName} / {invite.redeemedCount}
                        {invite.maxRedemptions ? ` of ${invite.maxRedemptions}` : ""} used
                      </p>
                      <input
                        readOnly
                        value={inviteUrl(invite.code)}
                        className="mt-2 w-full rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground outline-none font-kruxt-mono"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => copyInvite(invite)}
                          className="rounded-button border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card"
                        >
                          Copy Link
                        </button>
                        <button
                          onClick={() => gym.updateGymInviteCode(gymId, invite.id, { isActive: false }).then(inviteCodesState.refetch)}
                          className="rounded-button border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-card"
                        >
                          Disable
                        </button>
                      </div>
                      <p className="mt-2 text-[10px] text-muted-foreground">Expires: {formatDateTime(invite.expiresAt)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {activeInvites.length === 0 && (
              <p className="text-sm text-muted-foreground">No active invite links yet.</p>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === filter.value
                  ? "bg-kruxt-accent/15 text-kruxt-accent"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search members, PTs, plans..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No members found"
          description={
            members.length === 0
              ? "Your gym does not have any members yet. Add an existing profile or send an invite."
              : "Try adjusting your filters or search terms."
          }
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          }
        />
      ) : (
        <DataTable columns={columns} data={filtered} keyExtractor={(row) => row.id} />
      )}

      <Modal
        open={showAdd}
        onClose={() => {
          setShowAdd(false);
          setAddForm(defaultAddForm);
          setProfileOptions([]);
          setAddError(undefined);
        }}
        title="Add Member"
        size="lg"
        footer={
          <>
            <button
              onClick={() => {
                setShowAdd(false);
                setAddForm(defaultAddForm);
                setProfileOptions([]);
                setAddError(undefined);
              }}
              className="rounded-button border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel"
            >
              Cancel
            </button>
            <button
              onClick={handleAddMember}
              disabled={addLoading}
              className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {addLoading ? "Adding..." : "Add Member"}
            </button>
          </>
        }
      >
        {addError && <p className="rounded-lg bg-kruxt-danger/10 px-3 py-2 text-xs text-kruxt-danger">{addError}</p>}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Search profile by name or username
          </label>
          <input
            type="text"
            placeholder="Mario Rossi, @mario..."
            value={addForm.profileQuery}
            onChange={(e) =>
              setAddForm((form) => ({ ...form, profileQuery: e.target.value, userId: "" }))
            }
            className={INPUT}
          />
          <ProfileSearchResults
            options={profileOptions}
            loading={profileLoading}
            onSelect={(option) => {
              setAddForm((form) => ({
                ...form,
                userId: option.userId,
                profileQuery: option.label,
              }));
              setProfileOptions([]);
            }}
          />
          {addForm.userId && (
            <p className="mt-2 text-xs text-kruxt-success">Selected profile: {addForm.profileQuery}</p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
            <select
              value={addForm.role}
              onChange={(e) => setAddForm((form) => ({ ...form, role: e.target.value as GymRole }))}
              className={INPUT}
            >
              <option value="member">Member</option>
              <option value="coach">Coach</option>
              <option value="officer">Officer</option>
              <option value="leader">Leader</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Initial Status</label>
            <select
              value={addForm.membershipStatus}
              onChange={(e) =>
                setAddForm((form) => ({ ...form, membershipStatus: e.target.value as MembershipStatus }))
              }
              className={INPUT}
            >
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Membership Plan</label>
            <select
              value={addForm.membershipPlanId}
              onChange={(e) => setAddForm((form) => ({ ...form, membershipPlanId: e.target.value }))}
              className={INPUT}
            >
              <option value="">No paid plan</option>
              {membershipPlanOptions.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Assigned PT</label>
          <select
            value={addForm.coachUserId}
            onChange={(e) => setAddForm((form) => ({ ...form, coachUserId: e.target.value }))}
            className={INPUT}
          >
            <option value="">No PT assigned</option>
            {staffOptions.map((staff) => (
              <option key={staff.userId} value={staff.userId}>
                {staff.label}
              </option>
            ))}
          </select>
        </div>
      </Modal>

      <Modal
        open={Boolean(managedMember)}
        onClose={() => setManagedMember(null)}
        title={managedMember ? `Manage ${memberLabel(managedMember)}` : "Manage Member"}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setManagedMember(null)}
              className="rounded-button border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel"
            >
              Close
            </button>
          </>
        }
      >
        {manageError && <p className="rounded-lg bg-kruxt-danger/10 px-3 py-2 text-xs text-kruxt-danger">{manageError}</p>}
        {managedMember && (
          <>
            <div className="rounded-lg border border-border bg-kruxt-panel/30 p-4">
              <p className="text-sm font-semibold text-foreground">{memberLabel(managedMember)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {managedMember.role} / {managedMember.membershipStatus}
                {managedMember.membershipPlanName ? ` / ${managedMember.membershipPlanName}` : ""}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Latest plan: {managedMember.latestWorkoutPlan?.title ?? "No workout plan logged yet."}
              </p>
            </div>
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Member access</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
                  <select
                    value={managedRole}
                    onChange={(e) => setManagedRole(e.target.value as GymRole)}
                    className={INPUT}
                  >
                    <option value="member">Member</option>
                    <option value="coach">Coach</option>
                    <option value="officer">Officer</option>
                    <option value="leader">Leader</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Status</label>
                  <select
                    value={managedStatus}
                    onChange={(e) => setManagedStatus(e.target.value as MembershipStatus)}
                    className={INPUT}
                  >
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="pending">Pending</option>
                    <option value="paused">Paused</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Plan</label>
                  <select value={managedPlanId} onChange={(e) => setManagedPlanId(e.target.value)} className={INPUT}>
                    <option value="">No paid plan</option>
                    {membershipPlanOptions.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleSaveMemberDetails}
                disabled={manageLoading}
                className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {manageLoading ? "Saving..." : "Save Access Details"}
              </button>
            </div>
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <label className="block text-sm font-semibold text-foreground">Assigned personal trainer</label>
              <div className="flex gap-2">
                <select
                  value={managedCoachId}
                  onChange={(e) => setManagedCoachId(e.target.value)}
                  className={INPUT}
                >
                  <option value="">No PT assigned</option>
                  {staffOptions.map((staff) => (
                    <option key={staff.userId} value={staff.userId}>
                      {staff.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleSaveCoach}
                  disabled={manageLoading}
                  className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Log workout plan</p>
              <input
                className={INPUT}
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                placeholder="4-week strength base"
              />
              <input
                className={INPUT}
                value={planGoal}
                onChange={(e) => setPlanGoal(e.target.value)}
                placeholder="Goal, e.g. rebuild squat pattern and improve consistency"
              />
              <textarea
                rows={4}
                className={INPUT}
                value={planNotes}
                onChange={(e) => setPlanNotes(e.target.value)}
                placeholder="Weekly structure, exercises, constraints, notes for the PT..."
              />
              <button
                onClick={handleCreateWorkoutPlan}
                disabled={manageLoading}
                className="rounded-button bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {manageLoading ? "Saving..." : "Save Workout Plan"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
