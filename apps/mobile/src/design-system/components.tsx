import React from "react";

// ─── Badge / Sigil ─────────────────────────────────────────────────────────
type BadgeVariant = "ion" | "steel" | "success" | "warning" | "danger";

export function Badge({
  children,
  variant = "ion",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
}) {
  const cls: Record<BadgeVariant, string> = {
    ion: "badge-ion",
    steel: "badge-steel",
    success: "badge-success",
    warning: "badge-warning",
    danger: "badge-danger",
  };
  return <span className={cls[variant]}>{children}</span>;
}

// ─── Stat Card ─────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div className="panel p-4 flex flex-col gap-1">
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
      </span>
    </div>
  );
}

// ─── List Row ──────────────────────────────────────────────────────────────
export function ListRow({
  children,
  onClick,
  leading,
  trailing,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="list-row w-full text-left"
      disabled={!onClick}
    >
      {leading && <div className="flex-shrink-0">{leading}</div>}
      <div className="flex-1 min-w-0">{children}</div>
      {trailing && <div className="flex-shrink-0 text-muted-foreground">{trailing}</div>}
    </button>
  );
}

// ─── Data Table ────────────────────────────────────────────────────────────
interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField = "id",
}: {
  columns: Column<T>[];
  data: T[];
  keyField?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.align === "right" ? "text-right" : ""}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={String(row[keyField])}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`${col.align === "right" ? "text-right" : ""} ${col.mono ? "font-mono tabular-nums" : ""}`}
                >
                  {col.render ? col.render(row) : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Icon Button ───────────────────────────────────────────────────────────
export function IconButton({
  children,
  onClick,
  label,
  size = "md",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  label: string;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`${sizeClass} rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-95 transition-all`}
    >
      {children}
    </button>
  );
}

// ─── Avatar ────────────────────────────────────────────────────────────────
export function Avatar({
  src,
  alt,
  fallback,
  size = "md",
}: {
  src?: string | null;
  alt: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" }[size];
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${sizeClass} rounded-full object-cover border border-border`}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-full bg-secondary flex items-center justify-center font-display font-bold text-secondary-foreground border border-border`}>
      {fallback || alt.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Divider ───────────────────────────────────────────────────────────────
export function Divider({ label }: { label?: string }) {
  if (!label) return <div className="h-px bg-border" />;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground font-display uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ─── Status Dot ────────────────────────────────────────────────────────────
type StatusColor = "success" | "warning" | "danger" | "info" | "muted";
export function StatusDot({ status, label }: { status: StatusColor; label?: string }) {
  const colors: Record<StatusColor, string> = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-destructive",
    info: "bg-primary",
    muted: "bg-muted-foreground",
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </span>
  );
}
