/**
 * Dashboard loading state — shows skeleton UI while page data loads.
 * Per nextjs-app-router-patterns: loading.tsx provides instant feedback.
 */

import { StatsSkeleton, AssetListSkeleton } from "@/components/skeletons";

export default function DashboardLoading() {
  return (
    <div className="space-y-8 p-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-72 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <StatsSkeleton />
      <div className="space-y-4">
        <div className="h-6 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <AssetListSkeleton count={6} />
      </div>
    </div>
  );
}
