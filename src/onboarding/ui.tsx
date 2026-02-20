// Shared primitives for onboarding screens
import React from "react";
import { cn } from "@/lib/utils";

// ── Step progress bar ─────────────────────────────────────────────────────────
interface StepBarProps {
  current: number; // 0-indexed among trackable steps (1–5)
  total: number;
}

export function StepBar({ current, total }: StepBarProps) {
  return (
    <div className="flex gap-1.5 px-6 pt-4 pb-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-0.5 flex-1 rounded-full transition-all duration-400",
            i < current
              ? "bg-primary"
              : i === current
              ? "bg-primary/60"
              : "bg-border/40"
          )}
        />
      ))}
    </div>
  );
}

// ── Screen shell ──────────────────────────────────────────────────────────────
interface ScreenShellProps {
  children: React.ReactNode;
  className?: string;
}

export function ScreenShell({ children, className }: ScreenShellProps) {
  return (
    <div
      className={cn(
        "min-h-screen bg-background flex flex-col overflow-y-auto",
        className
      )}
    >
      {children}
    </div>
  );
}

// ── Screen header ─────────────────────────────────────────────────────────────
interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
}

export function ScreenHeader({ title, subtitle, badge }: ScreenHeaderProps) {
  return (
    <div className="px-6 pt-6 pb-4 space-y-1">
      {badge && (
        <span className="inline-block text-[10px] font-semibold tracking-widest uppercase text-primary/80 mb-2">
          {badge}
        </span>
      )}
      <h1 className="text-2xl font-display font-bold text-foreground leading-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm text-muted-foreground leading-snug">{subtitle}</p>
      )}
    </div>
  );
}

// ── Primary CTA button ────────────────────────────────────────────────────────
interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: React.ReactNode;
}

export function PrimaryButton({ loading, children, className, disabled, ...props }: PrimaryButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "w-full h-12 rounded-xl font-display font-semibold text-sm tracking-wide",
        "bg-primary text-primary-foreground",
        "transition-all duration-200 active:scale-[0.98]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "flex items-center justify-center gap-2",
        loading && "animate-pulse",
        className
      )}
    >
      {loading ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Working…
        </>
      ) : (
        children
      )}
    </button>
  );
}

// ── Ghost / secondary button ─────────────────────────────────────────────────
interface GhostButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function GhostButton({ children, className, ...props }: GhostButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "w-full h-11 rounded-xl font-medium text-sm text-muted-foreground",
        "border border-border/50 bg-transparent",
        "hover:bg-secondary/30 transition-colors duration-200",
        className
      )}
    >
      {children}
    </button>
  );
}

// ── Labelled input field ──────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  error?: string | null;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

export function Field({ label, error, required, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold tracking-wide text-foreground/70 uppercase">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ── Text input ────────────────────────────────────────────────────────────────
interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function TextInput({ error, className, ...props }: TextInputProps) {
  return (
    <input
      {...props}
      className={cn(
        "w-full h-11 px-4 rounded-xl text-sm bg-secondary/40 text-foreground",
        "border transition-colors duration-200 outline-none",
        "placeholder:text-muted-foreground/50",
        "focus:border-primary/60 focus:ring-1 focus:ring-primary/20",
        error
          ? "border-destructive/60 focus:border-destructive"
          : "border-border/40",
        className
      )}
    />
  );
}

// ── Error callout ─────────────────────────────────────────────────────────────
export function ErrorCallout({ message }: { message: string }) {
  return (
    <div className="mx-6 mt-1 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive leading-snug">
      {message}
    </div>
  );
}

// ── Consent toggle row ────────────────────────────────────────────────────────
interface ConsentRowProps {
  label: string;
  description?: string;
  checked: boolean;
  required?: boolean;
  error?: string | null;
  onChange: (v: boolean) => void;
}

export function ConsentRow({ label, description, checked, required, error, onChange }: ConsentRowProps) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "w-full flex items-start gap-3 p-3.5 rounded-xl text-left",
          "border transition-all duration-200",
          checked
            ? "border-primary/40 bg-primary/5"
            : error
            ? "border-destructive/40 bg-destructive/5"
            : "border-border/30 bg-secondary/20 hover:bg-secondary/40"
        )}
      >
        {/* Checkbox */}
        <div
          className={cn(
            "mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all",
            checked ? "bg-primary border-primary" : "border-border/60"
          )}
        >
          {checked && (
            <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-foreground">
            {label}
            {required && <span className="text-primary ml-1 text-xs">Required</span>}
          </span>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
          )}
        </div>
      </button>
      {error && (
        <p className="text-xs text-destructive px-1 flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

// ── Divider with label ────────────────────────────────────────────────────────
export function Divider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-border/30" />
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <div className="flex-1 h-px bg-border/30" />
    </div>
  );
}

// ── Back chevron button ───────────────────────────────────────────────────────
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-2 -ml-1 text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Go back"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
