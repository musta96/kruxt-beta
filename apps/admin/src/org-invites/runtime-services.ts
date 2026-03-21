import type { GymRole } from "@kruxt/types";
import { createAdminSupabaseClient } from "../services";

export type OrgInviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface OrgInviteRecord {
  id: string;
  gymId: string;
  email: string;
  role: GymRole;
  status: OrgInviteStatus;
  invitedBy: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface OrgInviteMutationResult {
  ok: boolean;
  invite?: OrgInviteRecord;
  inviteUrl?: string;
  error?: { message: string };
}

export interface OrgInvitesLoadResult {
  ok: boolean;
  invites?: OrgInviteRecord[];
  error?: { message: string };
}

export interface OrgInvitesServices {
  load(gymId: string): Promise<OrgInvitesLoadResult>;
  sendInvite(
    gymId: string,
    input: { email: string; role: GymRole; expiresInDays?: number }
  ): Promise<OrgInviteMutationResult>;
  resendInvite(gymId: string, inviteId: string): Promise<OrgInviteMutationResult>;
  revokeInvite(gymId: string, inviteId: string): Promise<OrgInviteMutationResult>;
}

type InviteRow = {
  id: string;
  gym_id: string;
  email: string;
  role: GymRole;
  status: OrgInviteStatus;
  invited_by: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

function normalizeStatus(status: OrgInviteStatus, expiresAt: string): OrgInviteStatus {
  if (status !== "pending") return status;
  const expiryTime = new Date(expiresAt).getTime();
  if (Number.isNaN(expiryTime)) return status;
  return expiryTime < Date.now() ? "expired" : status;
}

function mapInvite(row: InviteRow): OrgInviteRecord {
  return {
    id: row.id,
    gymId: row.gym_id,
    email: row.email,
    role: row.role,
    status: normalizeStatus(row.status, row.expires_at),
    invitedBy: row.invited_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at
  };
}

function asErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

export function createOrgInvitesRuntimeServices(): OrgInvitesServices {
  let supabase: ReturnType<typeof createAdminSupabaseClient> | null = null;
  let unavailable = false;
  let previewInvites: OrgInviteRecord[] = [];

  const getClient = () => {
    if (supabase) return supabase;
    if (unavailable) return null;
    try {
      supabase = createAdminSupabaseClient();
      return supabase;
    } catch (error) {
      unavailable = true;
      console.warn("[org-invites-runtime] Falling back to preview services:", error);
      return null;
    }
  };

  const loadPreview = async (gymId: string): Promise<OrgInvitesLoadResult> => ({
    ok: true,
    invites: previewInvites.filter((invite) => invite.gymId === gymId)
  });

  return {
    load: async (gymId) => {
      const client = getClient();
      if (!client) return loadPreview(gymId);

      try {
        const { data, error } = await client
          .from("gym_staff_invites")
          .select("id,gym_id,email,role,status,invited_by,created_at,updated_at,expires_at,accepted_at,revoked_at")
          .eq("gym_id", gymId)
          .order("created_at", { ascending: false })
          .limit(250);

        if (error) throw error;

        return {
          ok: true,
          invites: ((data as InviteRow[]) ?? []).map(mapInvite)
        };
      } catch (error) {
        console.warn("[org-invites-runtime] load failed:", error);
        return {
          ok: false,
          error: { message: asErrorMessage(error, "Unable to load invites.") }
        };
      }
    },
    sendInvite: async (gymId, input) => {
      const client = getClient();
      if (!client) {
        const nowIso = new Date().toISOString();
        const invite: OrgInviteRecord = {
          id: `preview-invite-${Math.random().toString(36).slice(2, 10)}`,
          gymId,
          email: input.email.trim().toLowerCase(),
          role: input.role,
          status: "pending",
          invitedBy: "preview-owner",
          createdAt: nowIso,
          updatedAt: nowIso,
          expiresAt: new Date(Date.now() + (input.expiresInDays ?? 7) * 86400000).toISOString(),
          acceptedAt: null,
          revokedAt: null
        };
        previewInvites = [invite, ...previewInvites];
        return { ok: true, invite, inviteUrl: "https://preview.local/accept-invite?token=preview-token" };
      }

      try {
        const { data, error } = await client.functions.invoke("send-invite", {
          body: {
            action: "send",
            gymId,
            email: input.email,
            role: input.role,
            expiresInDays: input.expiresInDays
          }
        });

        if (error) throw error;
        if (!data?.ok || !data?.invite) {
          return { ok: false, error: { message: data?.error ?? "Unable to send invite." } };
        }

        return {
          ok: true,
          invite: mapInvite(data.invite as InviteRow),
          inviteUrl: typeof data.inviteUrl === "string" ? data.inviteUrl : undefined
        };
      } catch (error) {
        console.warn("[org-invites-runtime] send failed:", error);
        return { ok: false, error: { message: asErrorMessage(error, "Unable to send invite.") } };
      }
    },
    resendInvite: async (gymId, inviteId) => {
      const client = getClient();
      if (!client) {
        const existing = previewInvites.find((invite) => invite.id === inviteId && invite.gymId === gymId);
        if (!existing) return { ok: false, error: { message: "Invite not found." } };
        const updated: OrgInviteRecord = {
          ...existing,
          status: "pending",
          revokedAt: null,
          acceptedAt: null,
          updatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString()
        };
        previewInvites = previewInvites.map((invite) => (invite.id === inviteId ? updated : invite));
        return { ok: true, invite: updated, inviteUrl: "https://preview.local/accept-invite?token=preview-token" };
      }

      try {
        const { data, error } = await client.functions.invoke("send-invite", {
          body: {
            action: "resend",
            gymId,
            inviteId
          }
        });

        if (error) throw error;
        if (!data?.ok || !data?.invite) {
          return { ok: false, error: { message: data?.error ?? "Unable to resend invite." } };
        }

        return {
          ok: true,
          invite: mapInvite(data.invite as InviteRow),
          inviteUrl: typeof data.inviteUrl === "string" ? data.inviteUrl : undefined
        };
      } catch (error) {
        console.warn("[org-invites-runtime] resend failed:", error);
        return { ok: false, error: { message: asErrorMessage(error, "Unable to resend invite.") } };
      }
    },
    revokeInvite: async (gymId, inviteId) => {
      const client = getClient();
      if (!client) {
        const existing = previewInvites.find((invite) => invite.id === inviteId && invite.gymId === gymId);
        if (!existing) return { ok: false, error: { message: "Invite not found." } };
        const updated: OrgInviteRecord = {
          ...existing,
          status: "revoked",
          revokedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        previewInvites = previewInvites.map((invite) => (invite.id === inviteId ? updated : invite));
        return { ok: true, invite: updated };
      }

      try {
        const { data, error } = await client.functions.invoke("send-invite", {
          body: {
            action: "revoke",
            gymId,
            inviteId
          }
        });

        if (error) throw error;
        if (!data?.ok || !data?.invite) {
          return { ok: false, error: { message: data?.error ?? "Unable to revoke invite." } };
        }

        return {
          ok: true,
          invite: mapInvite(data.invite as InviteRow)
        };
      } catch (error) {
        console.warn("[org-invites-runtime] revoke failed:", error);
        return { ok: false, error: { message: asErrorMessage(error, "Unable to revoke invite.") } };
      }
    }
  };
}
