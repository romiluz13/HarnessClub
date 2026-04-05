/**
 * Skeleton Loaders — loading placeholders for known content shapes.
 *
 * Per frontend-patterns: use skeleton loaders instead of spinners.
 * Per web-design-guidelines: honor prefers-reduced-motion.
 * Per tailwind-design-system: consistent spacing and colors.
 */

/** Base skeleton block with pulse animation */
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    />
  );
}

/** Skeleton for a single asset card */
export function AssetCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

/** Skeleton for asset list (multiple cards) */
export function AssetListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading assets">
      {Array.from({ length: count }, (_, i) => (
        <AssetCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/** Skeleton for a team/department card */
export function TeamCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <div className="mt-4 flex justify-between">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}

/** Skeleton for stats/metrics row */
export function StatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Loading stats">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/** Skeleton for marketplace listing */
export function MarketplaceSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading marketplace">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <AssetCardSkeleton key={i} />
        ))}
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/** Skeleton for detail/content page */
export function DetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading content">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/** Empty state — shown when a query returns no results */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <svg className="mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
