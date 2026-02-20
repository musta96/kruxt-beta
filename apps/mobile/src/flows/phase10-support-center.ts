import type {
  CreateSupportTicketMessageInput,
  SubmitSupportTicketInput,
  SupportAutomationRun,
  SupportTicket,
  SupportTicketMessage,
  SupportTicketStatus
} from "@kruxt/types";

import { createMobileSupabaseClient, KruxtAppError, SupportService, type SupportTicketListOptions } from "../services";

export type Phase10SupportCenterStep = "ticket_queue" | "ticket_create" | "conversation" | "automation_approval";

export interface Phase10SupportCenterError {
  code: string;
  step: Phase10SupportCenterStep;
  message: string;
  recoverable: boolean;
}

export interface Phase10SupportCenterLoadOptions {
  selectedTicketId?: string;
  statuses?: SupportTicketStatus[];
  includeClosed?: boolean;
  gymId?: string;
  search?: string;
}

export interface Phase10SupportCenterSnapshot {
  tickets: SupportTicket[];
  selectedTicketId?: string;
  selectedTicket: SupportTicket | null;
  selectedTicketMessages: SupportTicketMessage[];
  selectedTicketAutomationRuns: SupportAutomationRun[];
}

export interface Phase10SupportCenterLoadSuccess {
  ok: true;
  snapshot: Phase10SupportCenterSnapshot;
}

export interface Phase10SupportCenterLoadFailure {
  ok: false;
  error: Phase10SupportCenterError;
}

export type Phase10SupportCenterLoadResult = Phase10SupportCenterLoadSuccess | Phase10SupportCenterLoadFailure;

export interface Phase10SupportCenterMutationSuccess {
  ok: true;
  action: "submit_ticket" | "create_message" | "approve_automation_run";
  snapshot: Phase10SupportCenterSnapshot;
  ticket?: SupportTicket;
  message?: SupportTicketMessage;
  automationRun?: SupportAutomationRun;
}

export interface Phase10SupportCenterMutationFailure {
  ok: false;
  error: Phase10SupportCenterError;
}

export type Phase10SupportCenterMutationResult =
  | Phase10SupportCenterMutationSuccess
  | Phase10SupportCenterMutationFailure;

export const phase10SupportCenterChecklist = [
  "Load current user support tickets and queue state",
  "Submit support tickets through controlled RPC",
  "Render ticket conversations and automation approval state",
  "Allow in-thread replies and approval actions with refresh-safe snapshots"
] as const;

function mapErrorStep(code: string): Phase10SupportCenterStep {
  if (code.includes("AUTH")) {
    return "ticket_queue";
  }

  if (code.includes("SUBMIT")) {
    return "ticket_create";
  }

  if (code.includes("MESSAGE")) {
    return "conversation";
  }

  if (code.includes("AUTOMATION")) {
    return "automation_approval";
  }

  return "ticket_queue";
}

function mapErrorMessage(code: string, fallback: string): string {
  if (code === "SUPPORT_AUTH_REQUIRED") {
    return "Sign in is required before opening support tickets.";
  }

  if (code === "SUPPORT_TICKET_SUBMIT_EMPTY") {
    return "Ticket submission succeeded without ticket data. Retry submission.";
  }

  if (code === "SUPPORT_AUTOMATION_RUN_APPROVAL_EMPTY") {
    return "Approval update completed without refreshed run state. Refresh and retry.";
  }

  return fallback;
}

function mapUiError(error: unknown): Phase10SupportCenterError {
  const appError =
    error instanceof KruxtAppError
      ? error
      : new KruxtAppError("SUPPORT_CENTER_ACTION_FAILED", "Unable to complete support action.", error);

  return {
    code: appError.code,
    step: mapErrorStep(appError.code),
    message: mapErrorMessage(appError.code, appError.message),
    recoverable: appError.code !== "SUPPORT_AUTH_REQUIRED"
  };
}

function resolveSelectedTicketId(
  options: Phase10SupportCenterLoadOptions,
  tickets: SupportTicket[]
): string | undefined {
  if (options.selectedTicketId && tickets.some((ticket) => ticket.id === options.selectedTicketId)) {
    return options.selectedTicketId;
  }

  return tickets[0]?.id;
}

export function createPhase10SupportCenterFlow() {
  const supabase = createMobileSupabaseClient();
  const support = new SupportService(supabase);

  const loadSnapshot = async (
    options: Phase10SupportCenterLoadOptions = {}
  ): Promise<Phase10SupportCenterSnapshot> => {
    const listOptions: SupportTicketListOptions = {
      statuses: options.statuses,
      includeClosed: options.includeClosed,
      gymId: options.gymId,
      search: options.search
    };

    const tickets = await support.listMyTickets(listOptions);
    const selectedTicketId = resolveSelectedTicketId(options, tickets);

    const [selectedTicketMessages, selectedTicketAutomationRuns] = selectedTicketId
      ? await Promise.all([
          support.listTicketMessages(selectedTicketId),
          support.listTicketAutomationRuns(selectedTicketId)
        ])
      : [[], []];

    return {
      tickets,
      selectedTicketId,
      selectedTicket: selectedTicketId ? tickets.find((ticket) => ticket.id === selectedTicketId) ?? null : null,
      selectedTicketMessages,
      selectedTicketAutomationRuns
    };
  };

  const runMutation = async (
    action: Phase10SupportCenterMutationSuccess["action"],
    mutate: () => Promise<Partial<Phase10SupportCenterMutationSuccess>>,
    options: Phase10SupportCenterLoadOptions = {}
  ): Promise<Phase10SupportCenterMutationResult> => {
    try {
      const payload = await mutate();
      const nextSelectedTicketId = payload.ticket?.id ?? options.selectedTicketId;
      const snapshot = await loadSnapshot({
        ...options,
        selectedTicketId: nextSelectedTicketId
      });

      return {
        ok: true,
        action,
        snapshot,
        ...payload
      };
    } catch (error) {
      return {
        ok: false,
        error: mapUiError(error)
      };
    }
  };

  return {
    checklist: [...phase10SupportCenterChecklist],
    load: async (options: Phase10SupportCenterLoadOptions = {}): Promise<Phase10SupportCenterLoadResult> => {
      try {
        return {
          ok: true,
          snapshot: await loadSnapshot(options)
        };
      } catch (error) {
        return {
          ok: false,
          error: mapUiError(error)
        };
      }
    },
    submitTicket: async (
      input: SubmitSupportTicketInput,
      options: Phase10SupportCenterLoadOptions = {}
    ): Promise<Phase10SupportCenterMutationResult> =>
      runMutation("submit_ticket", async () => {
        const ticket = await support.submitTicket(input);
        return { ticket };
      }, options),
    createMessage: async (
      ticketId: string,
      input: CreateSupportTicketMessageInput,
      options: Phase10SupportCenterLoadOptions = {}
    ): Promise<Phase10SupportCenterMutationResult> =>
      runMutation("create_message", async () => {
        const message = await support.createTicketMessage(ticketId, input);
        return { message };
      }, { ...options, selectedTicketId: ticketId }),
    approveAutomationRun: async (
      runId: string,
      approve: boolean,
      note?: string,
      selectedTicketId?: string,
      options: Phase10SupportCenterLoadOptions = {}
    ): Promise<Phase10SupportCenterMutationResult> =>
      runMutation("approve_automation_run", async () => {
        const automationRun = await support.approveAutomationRun(runId, approve, note);
        return { automationRun };
      }, { ...options, selectedTicketId })
  };
}
