"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge, statusToVariant } from "@/components/status-badge";
import { ErrorBanner } from "@/components/error-banner";
import { PageSkeleton } from "@/components/loading-skeleton";
import { Modal } from "@/components/modal";
import { useGym } from "@/contexts/gym-context";
import { useServices } from "@/hooks/use-services";
import { useAsync } from "@/hooks/use-async";
import type { ManualBillingSettings, MemberSubscriptionDirectoryItem } from "@/services";
import type { GymMembershipPlan, Invoice, PaymentTransaction } from "@kruxt/types";

const INPUT =
  "w-full rounded-lg border border-border bg-kruxt-panel px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-kruxt-accent focus:outline-none focus:ring-1 focus:ring-kruxt-accent/40";

const emptyManualBillingDraft: ManualBillingSettings = {
  instructions: "",
  bankAccountLabel: "",
  accountHolder: "",
  iban: "",
  paymentReferenceFormat: "",
  cashDeskNote: "",
  externalPaymentUrl: ""
};

interface PlanDraft {
  name: string;
  billingCycle: GymMembershipPlan["billingCycle"];
  price: string;
  currency: string;
  classCreditsPerCycle: string;
  trialDays: string;
  cancelPolicy: string;
  isActive: boolean;
}

const emptyPlanDraft: PlanDraft = {
  name: "",
  billingCycle: "monthly",
  price: "",
  currency: "EUR",
  classCreditsPerCycle: "",
  trialDays: "",
  cancelPolicy: "",
  isActive: true
};

function formatMoney(cents: number | null | undefined, currency = "EUR"): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format((cents ?? 0) / 100);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function planToDraft(plan: GymMembershipPlan): PlanDraft {
  return {
    name: plan.name,
    billingCycle: plan.billingCycle,
    price: (plan.priceCents / 100).toFixed(2),
    currency: plan.currency || "EUR",
    classCreditsPerCycle: plan.classCreditsPerCycle == null ? "" : String(plan.classCreditsPerCycle),
    trialDays: plan.trialDays == null ? "" : String(plan.trialDays),
    cancelPolicy: plan.cancelPolicy ?? "",
    isActive: plan.isActive
  };
}

function parsePriceCents(value: string): number {
  const amount = Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Enter a valid plan price.");
  }
  return Math.round(amount * 100);
}

function parseOptionalWholeNumber(value: string, label: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a whole number.`);
  }
  return parsed;
}

const subscriptionColumns: Column<MemberSubscriptionDirectoryItem>[] = [
  {
    key: "member",
    header: "Member",
    render: (row) => (
      <div>
        <p className="font-medium text-foreground">{row.profile?.label ?? row.userId.slice(0, 8)}</p>
        <p className="text-xs text-muted-foreground font-kruxt-mono">{row.userId.slice(0, 8)}</p>
      </div>
    )
  },
  {
    key: "plan",
    header: "Plan",
    render: (row) => (
      <div>
        <p className="font-medium text-foreground">{row.membershipPlan?.name ?? "No plan"}</p>
        <p className="text-xs text-muted-foreground">
          {row.membershipPlan
            ? `${formatMoney(row.membershipPlan.priceCents, row.membershipPlan.currency)} / ${row.membershipPlan.billingCycle}`
            : "Manual subscription"}
        </p>
      </div>
    )
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusBadge label={row.status} variant={statusToVariant(row.status)} dot />
  },
  {
    key: "period",
    header: "Period",
    render: (row) => (
      <div>
        <p className="text-sm tabular-nums text-foreground font-kruxt-mono">
          {formatDate(row.currentPeriodStart)} → {formatDate(row.currentPeriodEnd)}
        </p>
        {row.trialEndsAt ? <p className="text-xs text-muted-foreground">Trial until {formatDate(row.trialEndsAt)}</p> : null}
      </div>
    )
  },
  {
    key: "provider",
    header: "Provider",
    render: (row) => (
      <span className="text-sm text-muted-foreground">
        {row.provider}
        {row.paymentMethodBrand || row.paymentMethodLast4
          ? ` / ${[row.paymentMethodBrand, row.paymentMethodLast4].filter(Boolean).join(" ")}`
          : ""}
      </span>
    )
  }
];

const baseInvoiceColumns: Column<Invoice>[] = [
  {
    key: "id",
    header: "Invoice",
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-foreground font-kruxt-mono">
          {row.providerInvoiceId ?? row.id.slice(0, 8)}
        </p>
        <p className="text-xs text-muted-foreground">{row.userId ?? "—"}</p>
      </div>
    ),
  },
  {
    key: "totalCents",
    header: "Amount",
    sortable: true,
    render: (row) => (
      <span className="text-sm font-medium tabular-nums text-foreground font-kruxt-mono">
        {formatMoney(row.totalCents, row.currency)}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <StatusBadge label={row.status} variant={statusToVariant(row.status)} dot />
    ),
  },
  {
    key: "dueAt",
    header: "Due Date",
    sortable: true,
    render: (row) => (
      <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
        {row.dueAt
          ? new Date(row.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "—"}
      </span>
    ),
  },
  {
    key: "createdAt",
    header: "Created",
    render: (row) => (
      <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">
        {row.createdAt
          ? new Date(row.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "—"}
      </span>
    ),
  },
];

const paymentColumns: Column<PaymentTransaction>[] = [
  {
    key: "id",
    header: "Payment",
    render: (row) => (
      <div>
        <p className="font-medium text-foreground font-kruxt-mono">{row.id.slice(0, 8)}</p>
        <p className="text-xs text-muted-foreground">{String(row.metadata?.reference ?? row.provider)}</p>
      </div>
    )
  },
  {
    key: "amount",
    header: "Amount",
    render: (row) => (
      <span className="text-sm font-medium tabular-nums text-foreground font-kruxt-mono">
        {formatMoney(row.amountCents, row.currency)}
      </span>
    )
  },
  {
    key: "method",
    header: "Method",
    render: (row) => <span className="text-sm text-muted-foreground">{row.paymentMethodType ?? row.provider}</span>
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusBadge label={row.status} variant={statusToVariant(row.status)} dot />
  },
  {
    key: "capturedAt",
    header: "Captured",
    render: (row) => (
      <span className="text-sm tabular-nums text-muted-foreground font-kruxt-mono">{formatDate(row.capturedAt)}</span>
    )
  }
];

export default function BillingPage() {
  const { gymId } = useGym();
  const { ops } = useServices();
  const [invoiceActionId, setInvoiceActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [savingBillingSettings, setSavingBillingSettings] = useState(false);
  const [billingDraft, setBillingDraft] = useState<ManualBillingSettings>(emptyManualBillingDraft);
  const [planDraft, setPlanDraft] = useState<PlanDraft>(emptyPlanDraft);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planActionId, setPlanActionId] = useState<string | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethodType: "cash",
    reference: "",
    note: ""
  });

  const plans = useAsync(() => ops.listMembershipPlans(gymId, true), [gymId]);
  const invoices = useAsync(() => ops.listInvoices(gymId), [gymId]);
  const subscriptions = useAsync(() => ops.listMemberSubscriptionDirectory(gymId), [gymId]);
  const payments = useAsync(() => ops.listPaymentTransactions(gymId), [gymId]);
  const manualBilling = useAsync(() => ops.getManualBillingSettings(gymId), [gymId]);

  useEffect(() => {
    if (manualBilling.status === "success") {
      setBillingDraft(manualBilling.data ?? emptyManualBillingDraft);
    }
  }, [manualBilling.data, manualBilling.status]);

  function updateBillingDraft(key: keyof ManualBillingSettings, value: string) {
    setBillingDraft((current) => ({ ...current, [key]: value }));
    setSettingsMessage(null);
  }

  async function saveManualBillingSettings() {
    setSavingBillingSettings(true);
    setActionError(null);
    setSettingsMessage(null);

    try {
      const settings = await ops.upsertManualBillingSettings(gymId, billingDraft);
      setBillingDraft(settings);
      setSettingsMessage("Payment instructions saved.");
      manualBilling.refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to save payment instructions.");
    } finally {
      setSavingBillingSettings(false);
    }
  }

  function updatePlanDraft(key: keyof PlanDraft, value: string | boolean) {
    setPlanDraft((current) => ({ ...current, [key]: value }));
    setSettingsMessage(null);
  }

  function startEditingPlan(plan: GymMembershipPlan) {
    setEditingPlanId(plan.id);
    setPlanDraft(planToDraft(plan));
    setActionError(null);
    setSettingsMessage(null);
  }

  function resetPlanForm() {
    setEditingPlanId(null);
    setPlanDraft(emptyPlanDraft);
    setActionError(null);
  }

  async function savePlan() {
    const name = planDraft.name.trim();
    if (!name) {
      setActionError("Plan name is required.");
      return;
    }

    let priceCents: number;
    let classCreditsPerCycle: number | null;
    let trialDays: number | null;

    try {
      priceCents = parsePriceCents(planDraft.price);
      classCreditsPerCycle = parseOptionalWholeNumber(planDraft.classCreditsPerCycle, "Class credits");
      trialDays = parseOptionalWholeNumber(planDraft.trialDays, "Trial days");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to validate plan.");
      return;
    }

    setSavingPlan(true);
    setActionError(null);
    setSettingsMessage(null);

    try {
      const input = {
        name,
        billingCycle: planDraft.billingCycle,
        priceCents,
        currency: planDraft.currency.trim().toUpperCase() || "EUR",
        classCreditsPerCycle,
        trialDays,
        cancelPolicy: planDraft.cancelPolicy.trim() || undefined,
        isActive: planDraft.isActive
      };

      if (editingPlanId) {
        await ops.updateMembershipPlan(gymId, editingPlanId, input);
        setSettingsMessage("Membership plan updated.");
      } else {
        await ops.createMembershipPlan(gymId, input);
        setSettingsMessage("Membership plan created.");
      }

      resetPlanForm();
      plans.refetch();
      subscriptions.refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to save membership plan.");
    } finally {
      setSavingPlan(false);
    }
  }

  async function togglePlanActive(plan: GymMembershipPlan) {
    setPlanActionId(plan.id);
    setActionError(null);
    setSettingsMessage(null);

    try {
      await ops.updateMembershipPlan(gymId, plan.id, { isActive: !plan.isActive });
      setSettingsMessage(plan.isActive ? "Membership plan deactivated." : "Membership plan activated.");
      plans.refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update membership plan.");
    } finally {
      setPlanActionId(null);
    }
  }

  function openPaymentModal(invoice: Invoice) {
    setPaymentInvoice(invoice);
    setActionError(null);
    setPaymentForm({
      amount: ((invoice.amountDueCents || invoice.totalCents || 0) / 100).toFixed(2),
      paymentMethodType: "cash",
      reference: "",
      note: ""
    });
  }

  async function recordManualPayment() {
    if (!paymentInvoice) return;

    const normalizedAmount = Number(paymentForm.amount.replace(",", "."));
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setActionError("Enter a payment amount greater than zero.");
      return;
    }

    setInvoiceActionId(paymentInvoice.id);
    setActionError(null);

    try {
      await ops.recordManualInvoicePayment(gymId, {
        invoiceId: paymentInvoice.id,
        amountCents: Math.round(normalizedAmount * 100),
        paymentMethodType: paymentForm.paymentMethodType,
        reference: paymentForm.reference,
        note: paymentForm.note,
        capturedAt: new Date().toISOString()
      });
      invoices.refetch();
      payments.refetch();
      subscriptions.refetch();
      setPaymentInvoice(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to record payment.");
    } finally {
      setInvoiceActionId(null);
    }
  }

  if (
    plans.status === "loading" ||
    plans.status === "idle" ||
    invoices.status === "loading" ||
    invoices.status === "idle" ||
    subscriptions.status === "loading" ||
    subscriptions.status === "idle" ||
    payments.status === "loading" ||
    payments.status === "idle" ||
    manualBilling.status === "loading" ||
    manualBilling.status === "idle"
  ) {
    return <PageSkeleton />;
  }

  if (
    plans.status === "error" ||
    invoices.status === "error" ||
    subscriptions.status === "error" ||
    payments.status === "error" ||
    manualBilling.status === "error"
  ) {
    return (
      <div className="space-y-6">
        <PageHeader title="Billing" description="Invoices, subscriptions, and payment management." />
        <ErrorBanner
          message={plans.error ?? invoices.error ?? subscriptions.error ?? payments.error ?? manualBilling.error ?? "Unknown error"}
          onRetry={() => {
            plans.refetch();
            invoices.refetch();
            subscriptions.refetch();
            payments.refetch();
            manualBilling.refetch();
          }}
        />
      </div>
    );
  }

  const planList = plans.data ?? [];
  const invoiceList = invoices.data ?? [];
  const subList = subscriptions.data ?? [];
  const paymentList = payments.data ?? [];
  const gymCurrency =
    planList.find((plan) => plan.isActive)?.currency ??
    planList[0]?.currency ??
    invoiceList[0]?.currency ??
    paymentList[0]?.currency ??
    "EUR";
  const planColumns: Column<GymMembershipPlan>[] = [
    {
      key: "name",
      header: "Plan",
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            {row.cancelPolicy || "No public description yet."}
          </p>
        </div>
      )
    },
    {
      key: "price",
      header: "Price",
      render: (row) => (
        <div>
          <p className="text-sm font-medium tabular-nums text-foreground font-kruxt-mono">
            {formatMoney(row.priceCents, row.currency)}
          </p>
          <p className="text-xs text-muted-foreground">{row.billingCycle}</p>
        </div>
      )
    },
    {
      key: "access",
      header: "Access",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.classCreditsPerCycle == null ? "Unlimited / manual" : `${row.classCreditsPerCycle} class credits`}
          {row.trialDays ? ` · ${row.trialDays} trial days` : ""}
        </span>
      )
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge label={row.isActive ? "active" : "inactive"} variant={row.isActive ? "success" : "muted"} dot />
      )
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-kruxt-panel"
            onClick={() => startEditingPlan(row)}
          >
            Edit
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground disabled:opacity-50"
            onClick={() => void togglePlanActive(row)}
            disabled={planActionId === row.id}
          >
            {planActionId === row.id ? "Saving..." : row.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
      )
    }
  ];
  const invoiceColumns: Column<Invoice>[] = [
    ...baseInvoiceColumns,
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        row.status === "paid" ? (
          <span className="text-xs text-muted-foreground">Paid {formatDate(row.paidAt)}</span>
        ) : (
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-kruxt-panel disabled:opacity-50"
            onClick={() => openPaymentModal(row)}
            disabled={invoiceActionId === row.id}
          >
            {invoiceActionId === row.id ? "Saving..." : "Record payment"}
          </button>
        )
      )
    }
  ];

  const totalRevenue = invoiceList
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (i.totalCents ?? 0), 0);
  const collectedPayments = paymentList
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const overdueCount = invoiceList.filter((i) => i.status === "open" && i.dueAt && new Date(i.dueAt) < new Date()).length;
  const activeSubCount = subList.filter((s) => s.status === "active" || s.status === "trialing").length;
  const activePlanCount = planList.filter((plan) => plan.isActive).length;
  const openInvoiceCount = invoiceList.filter((i) => i.status === "open").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Invoices, subscriptions, and payment management." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Revenue (Paid)" value={formatMoney(totalRevenue, gymCurrency)} accent="success" />
        <StatCard label="Active Plans" value={activePlanCount} />
        <StatCard label="Active Subscriptions" value={activeSubCount} />
        <StatCard label="Manual Payments" value={formatMoney(collectedPayments, gymCurrency)} />
        <StatCard label="Open Invoices" value={openInvoiceCount} />
      </div>
      {overdueCount > 0 && <ErrorBanner message={`${overdueCount} open invoices are overdue.`} />}

      {actionError && <ErrorBanner message={actionError} onRetry={() => setActionError(null)} />}
      {settingsMessage && (
        <div className="rounded-card border border-kruxt-success/30 bg-kruxt-success/10 px-4 py-3 text-sm text-kruxt-success">
          {settingsMessage}
        </div>
      )}

      <section className="rounded-card border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground font-kruxt-headline">Member Payment Instructions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These instructions appear beside open member invoices for manual collection.
            </p>
          </div>
          <button
            type="button"
            className="rounded-button bg-kruxt-accent px-5 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            onClick={() => void saveManualBillingSettings()}
            disabled={savingBillingSettings}
          >
            {savingBillingSettings ? "Saving..." : "Save instructions"}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="billing-instructions">
              Instructions
            </label>
            <textarea
              id="billing-instructions"
              className={INPUT}
              rows={3}
              value={billingDraft.instructions}
              onChange={(event) => updateBillingDraft("instructions", event.target.value)}
              placeholder="Pay by bank transfer, POS at reception, or the payment link below. Your access is confirmed after staff records the payment."
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="billing-account-label">
              Account label
            </label>
            <input
              id="billing-account-label"
              className={INPUT}
              value={billingDraft.bankAccountLabel}
              onChange={(event) => updateBillingDraft("bankAccountLabel", event.target.value)}
              placeholder="BZone ASD membership account"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="billing-holder">
              Account holder
            </label>
            <input
              id="billing-holder"
              className={INPUT}
              value={billingDraft.accountHolder}
              onChange={(event) => updateBillingDraft("accountHolder", event.target.value)}
              placeholder="BZone ASD"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="billing-iban">
              IBAN
            </label>
            <input
              id="billing-iban"
              className={`${INPUT} font-kruxt-mono`}
              value={billingDraft.iban}
              onChange={(event) => updateBillingDraft("iban", event.target.value)}
              placeholder="IT00X0000000000000000000000"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="billing-reference">
              Reference format
            </label>
            <input
              id="billing-reference"
              className={INPUT}
              value={billingDraft.paymentReferenceFormat}
              onChange={(event) => updateBillingDraft("paymentReferenceFormat", event.target.value)}
              placeholder="KRUXT {member name} {invoice id}"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="billing-link">
              External payment URL
            </label>
            <input
              id="billing-link"
              className={INPUT}
              value={billingDraft.externalPaymentUrl}
              onChange={(event) => updateBillingDraft("externalPaymentUrl", event.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="billing-cash-note">
              Reception note
            </label>
            <input
              id="billing-cash-note"
              className={INPUT}
              value={billingDraft.cashDeskNote}
              onChange={(event) => updateBillingDraft("cashDeskNote", event.target.value)}
              placeholder="Cash and POS payments can be made at the front desk."
            />
          </div>
        </div>
      </section>

      <section className="rounded-card border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground font-kruxt-headline">Membership Plans</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Plans marked active are available for members to request from the public gym directory.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-kruxt-panel"
            onClick={resetPlanForm}
          >
            New plan
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="plan-name">
              Plan name
            </label>
            <input
              id="plan-name"
              className={INPUT}
              value={planDraft.name}
              onChange={(event) => updatePlanDraft("name", event.target.value)}
              placeholder="Action Medium"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="plan-cycle">
              Cycle
            </label>
            <select
              id="plan-cycle"
              className={INPUT}
              value={planDraft.billingCycle}
              onChange={(event) => updatePlanDraft("billingCycle", event.target.value as PlanDraft["billingCycle"])}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="dropin">Drop-in</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="plan-price">
              Price
            </label>
            <input
              id="plan-price"
              className={`${INPUT} font-kruxt-mono`}
              value={planDraft.price}
              onChange={(event) => updatePlanDraft("price", event.target.value)}
              inputMode="decimal"
              placeholder="60.00"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="plan-currency">
              Currency
            </label>
            <input
              id="plan-currency"
              className={`${INPUT} font-kruxt-mono uppercase`}
              value={planDraft.currency}
              onChange={(event) => updatePlanDraft("currency", event.target.value.toUpperCase().slice(0, 3))}
              placeholder="EUR"
            />
          </div>
          <label className="flex items-center gap-2 self-end rounded-lg border border-border bg-kruxt-panel px-3 py-2.5 text-sm text-foreground lg:col-span-2">
            <input
              type="checkbox"
              checked={planDraft.isActive}
              onChange={(event) => updatePlanDraft("isActive", event.target.checked)}
            />
            Active
          </label>
          <div className="lg:col-span-3">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="plan-credits">
              Class credits
            </label>
            <input
              id="plan-credits"
              className={INPUT}
              value={planDraft.classCreditsPerCycle}
              onChange={(event) => updatePlanDraft("classCreditsPerCycle", event.target.value)}
              inputMode="numeric"
              placeholder="Empty for unlimited/manual"
            />
          </div>
          <div className="lg:col-span-3">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="plan-trial">
              Trial days
            </label>
            <input
              id="plan-trial"
              className={INPUT}
              value={planDraft.trialDays}
              onChange={(event) => updatePlanDraft("trialDays", event.target.value)}
              inputMode="numeric"
              placeholder="0"
            />
          </div>
          <div className="lg:col-span-6">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="plan-policy">
              Public description
            </label>
            <input
              id="plan-policy"
              className={INPUT}
              value={planDraft.cancelPolicy}
              onChange={(event) => updatePlanDraft("cancelPolicy", event.target.value)}
              placeholder="Accesso illimitato Sala Pesi e Cardio."
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {editingPlanId ? "Editing an existing plan. Existing subscriptions keep their linked plan." : "Create a plan members can request without copying UUIDs."}
          </p>
          <div className="flex flex-wrap gap-2">
            {editingPlanId ? (
              <button
                type="button"
                className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground"
                onClick={resetPlanForm}
              >
                Cancel edit
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-button bg-kruxt-accent px-5 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-50"
              onClick={() => void savePlan()}
              disabled={savingPlan}
            >
              {savingPlan ? "Saving..." : editingPlanId ? "Save plan" : "Create plan"}
            </button>
          </div>
        </div>

        <div className="mt-5">
          <DataTable
            columns={planColumns}
            data={planList}
            keyExtractor={(row) => row.id}
            searchable
            searchPlaceholder="Search plans..."
            emptyMessage="No membership plans yet."
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground font-kruxt-headline">Member Subscriptions</h2>
          <p className="text-sm text-muted-foreground">
            Approved plan requests become manual subscriptions here until a payment provider is connected.
          </p>
        </div>
        <DataTable
          columns={subscriptionColumns}
          data={subList}
          keyExtractor={(row) => row.id}
          searchable
          searchPlaceholder="Search subscriptions..."
          emptyMessage="No member subscriptions yet."
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground font-kruxt-headline">Invoices</h2>
          <p className="text-sm text-muted-foreground">
            Staff can record cash, bank transfer, POS, or external payment references while Stripe is still being connected.
          </p>
        </div>
        {invoiceList.length === 0 ? (
          <div className="rounded-card border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          </div>
        ) : (
          <DataTable columns={invoiceColumns} data={invoiceList} keyExtractor={(row) => row.id} searchable searchPlaceholder="Search invoices..." />
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground font-kruxt-headline">Payments</h2>
          <p className="text-sm text-muted-foreground">
            Manual payment records are kept as transactions so invoice changes have an audit trail.
          </p>
        </div>
        <DataTable
          columns={paymentColumns}
          data={paymentList}
          keyExtractor={(row) => row.id}
          searchable
          searchPlaceholder="Search payments..."
          emptyMessage="No payments recorded yet."
        />
      </section>

      <Modal
        open={paymentInvoice !== null}
        onClose={() => setPaymentInvoice(null)}
        title="Record Manual Payment"
        footer={
          <>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-kruxt-panel hover:text-foreground"
              onClick={() => setPaymentInvoice(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-kruxt-accent px-4 py-2 text-sm font-semibold text-kruxt-bg transition-opacity hover:opacity-90 disabled:opacity-60"
              onClick={() => void recordManualPayment()}
              disabled={!paymentInvoice || invoiceActionId === paymentInvoice.id}
            >
              {invoiceActionId === paymentInvoice?.id ? "Recording..." : "Record payment"}
            </button>
          </>
        }
      >
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="payment-amount">
            Amount
          </label>
          <input
            id="payment-amount"
            className="w-full rounded-lg border border-border bg-kruxt-panel px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-kruxt-accent/50"
            value={paymentForm.amount}
            onChange={(event) => setPaymentForm((form) => ({ ...form, amount: event.target.value }))}
            inputMode="decimal"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="payment-method">
            Method
          </label>
          <select
            id="payment-method"
            className="w-full rounded-lg border border-border bg-kruxt-panel px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-kruxt-accent/50"
            value={paymentForm.paymentMethodType}
            onChange={(event) => setPaymentForm((form) => ({ ...form, paymentMethodType: event.target.value }))}
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="pos">POS</option>
            <option value="stripe">Stripe</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="payment-reference">
            Reference
          </label>
          <input
            id="payment-reference"
            className="w-full rounded-lg border border-border bg-kruxt-panel px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-kruxt-accent/50"
            value={paymentForm.reference}
            onChange={(event) => setPaymentForm((form) => ({ ...form, reference: event.target.value }))}
            placeholder="Receipt, bank CRO, POS id, or note"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="payment-note">
            Note
          </label>
          <textarea
            id="payment-note"
            className="min-h-24 w-full rounded-lg border border-border bg-kruxt-panel px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-kruxt-accent/50"
            value={paymentForm.note}
            onChange={(event) => setPaymentForm((form) => ({ ...form, note: event.target.value }))}
            placeholder="Optional internal note"
          />
        </div>
        {actionError && <p className="rounded-md bg-kruxt-danger/10 px-3 py-2 text-sm text-kruxt-danger">{actionError}</p>}
      </Modal>
    </div>
  );
}
