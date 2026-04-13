"use client";

interface ErrorBannerProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="rounded-card border border-kruxt-danger/30 bg-kruxt-danger/5 p-5">
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-kruxt-danger"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-kruxt-danger">
            Something went wrong
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{message ?? "An unexpected error occurred."}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-button border border-kruxt-danger/30 px-3 py-1.5 text-xs font-medium text-kruxt-danger transition-colors hover:bg-kruxt-danger/10"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
