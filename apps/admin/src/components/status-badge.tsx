import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-kruxt-accent/15 text-kruxt-accent",
  success: "bg-kruxt-success/15 text-kruxt-success",
  warning: "bg-kruxt-warning/15 text-kruxt-warning",
  danger: "bg-kruxt-danger/15 text-kruxt-danger",
  info: "bg-blue-500/15 text-blue-400",
  muted: "bg-muted text-muted-foreground",
};

const dotStyles: Record<BadgeVariant, string> = {
  default: "bg-kruxt-accent",
  success: "bg-kruxt-success",
  warning: "bg-kruxt-warning",
  danger: "bg-kruxt-danger",
  info: "bg-blue-400",
  muted: "bg-muted-foreground",
};

export function StatusBadge({
  label,
  variant = "default",
  dot = false,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-badge px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", dotStyles[variant])}
        />
      )}
      {label}
    </span>
  );
}

/** Map common status strings to badge variants */
export function statusToVariant(
  status: string
): BadgeVariant {
  switch (status.toLowerCase()) {
    case "active":
    case "completed":
    case "fulfilled":
    case "succeeded":
    case "connected":
    case "approved":
      return "success";
    case "pending":
    case "triaged":
    case "waiting_user":
    case "waiting_approval":
    case "queued":
    case "retry_scheduled":
      return "warning";
    case "cancelled":
    case "expired":
    case "revoked":
    case "failed":
    case "rejected":
    case "overdue":
    case "error":
    case "critical":
      return "danger";
    case "trial":
    case "in_progress":
    case "running":
    case "scheduled":
      return "info";
    case "inactive":
    case "suspended":
    case "closed":
    case "resolved":
      return "muted";
    default:
      return "default";
  }
}
