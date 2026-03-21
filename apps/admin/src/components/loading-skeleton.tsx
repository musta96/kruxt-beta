import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-md bg-gradient-to-r from-kruxt-panel via-kruxt-surface to-kruxt-panel bg-[length:400%_100%]",
        className
      )}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-card border border-border bg-card p-5">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-8 w-24" />
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28 rounded-button" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-card border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-8 w-64" />
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRowSkeleton key={i} columns={5} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
