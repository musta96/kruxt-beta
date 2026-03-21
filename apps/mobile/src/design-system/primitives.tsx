import React from "react";

// ─── Progress bar ──────────────────────────────────────────────────────────
export function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="progress-track w-full"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Step ${Math.round(value / 20)} of 5`}
    >
      <div className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  );
}

// ─── Screen wrapper ────────────────────────────────────────────────────────
export function Screen({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`screen ${className}`}>{children}</div>;
}

// ─── Heading pair ──────────────────────────────────────────────────────────
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-3xl font-display font-black text-foreground leading-tight">
      {children}
    </h1>
  );
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
  );
}

// ─── Primary CTA button ────────────────────────────────────────────────────
export function PrimaryBtn({
  children,
  onClick,
  disabled,
  loading,
  loadingLabel = "Claiming...",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="btn-primary"
      aria-busy={loading}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Spinner size={16} />
          {loadingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

// ─── Ghost button ──────────────────────────────────────────────────────────
export function GhostBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="btn-ghost">
      {children}
    </button>
  );
}

// ─── Input field ───────────────────────────────────────────────────────────
export function InputField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`input-field ${error ? "border-destructive focus:ring-destructive" : ""}`}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={!!error}
      />
      {error && (
        <span id={`${id}-error`} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

// ─── Error banner ──────────────────────────────────────────────────────────
export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="panel border-destructive/40 bg-destructive/10 p-4 flex flex-col gap-2"
      role="alert"
      aria-live="assertive"
    >
      <p className="text-destructive text-sm font-semibold">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-destructive underline self-start">
          Try again
        </button>
      )}
    </div>
  );
}

// ─── Consent toggle block ──────────────────────────────────────────────────
export function ConsentBlock({
  id,
  label,
  description,
  checked,
  onChange,
  required,
  error,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className={`panel p-4 flex gap-4 items-start cursor-pointer transition-colors ${
          checked ? "border-primary/50 bg-primary/5" : ""
        } ${error ? "border-destructive/50" : ""}`}
      >
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 w-5 h-5 accent-primary flex-shrink-0"
          aria-required={required}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">
            {label}
            {required && (
              <span className="text-destructive ml-1" aria-label="required">
                *
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
      </label>
      {error && (
        <span id={`${id}-error`} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

// ─── Spinner ───────────────────────────────────────────────────────────────
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Skeleton card ─────────────────────────────────────────────────────────
export function SkeletonCard() {
  return (
    <div className="panel p-4 flex flex-col gap-3" aria-hidden="true" aria-label="Loading...">
      <div className="skeleton h-4 w-2/3" />
      <div className="skeleton h-3 w-full" />
      <div className="skeleton h-3 w-1/2" />
    </div>
  );
}

// ─── Back button ───────────────────────────────────────────────────────────
export function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium -ml-1 py-1 px-2 rounded-md active:bg-muted transition-colors"
      aria-label="Go back to previous step"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M19 12H5M12 5l-7 7 7 7" />
      </svg>
      Back
    </button>
  );
}

// ─── Mode tab strip ────────────────────────────────────────────────────────
export function TabStrip<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex panel p-1 gap-1" role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-colors ${
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
