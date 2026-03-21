import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: { value: string; positive: boolean };
  accent?: "default" | "success" | "warning" | "danger";
}

const accentColors = {
  default: "text-kruxt-accent",
  success: "text-kruxt-success",
  warning: "text-kruxt-warning",
  danger: "text-kruxt-danger",
};

export function StatCard({
  label,
  value,
  subtext,
  trend,
  accent = "default",
}: StatCardProps) {
  return (
    <div className="rounded-card border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-3xl font-bold tabular-nums font-kruxt-mono",
          accentColors[accent]
        )}
      >
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {trend && (
          <span
            className={cn(
              "inline-flex items-center text-xs font-medium",
              trend.positive ? "text-kruxt-success" : "text-kruxt-danger"
            )}
          >
            {trend.positive ? (
              <svg className="mr-0.5 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
              </svg>
            ) : (
              <svg className="mr-0.5 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
              </svg>
            )}
            {trend.value}
          </span>
        )}
        {subtext && (
          <span className="text-xs text-muted-foreground">{subtext}</span>
        )}
      </div>
    </div>
  );
}
