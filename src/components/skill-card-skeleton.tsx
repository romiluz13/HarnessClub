/**
 * Skeleton loader for skill cards.
 * Matches SkillCard dimensions for smooth transitions.
 * Per AGENTS.md: skeleton loaders for known content shapes, honor prefers-reduced-motion.
 */

interface SkillCardSkeletonProps {
  layout?: "grid" | "list";
  count?: number;
}

function Shimmer({ className }: { className: string }) {
  return (
    <div
      className={`${className} animate-pulse rounded bg-gray-200 motion-reduce:animate-none`}
    />
  );
}

function GridSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <Shimmer className="h-5 w-32" />
        <Shimmer className="h-4 w-10" />
      </div>
      <Shimmer className="mt-1 h-3 w-20" />
      <Shimmer className="mt-3 h-4 w-full" />
      <Shimmer className="mt-1 h-4 w-3/4" />
      <div className="mt-3 flex gap-1">
        <Shimmer className="h-5 w-14" />
        <Shimmer className="h-5 w-16" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="flex gap-3">
          <Shimmer className="h-3 w-10" />
          <Shimmer className="h-3 w-10" />
        </div>
        <Shimmer className="h-3 w-12" />
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex-1">
        <Shimmer className="h-4 w-40" />
        <Shimmer className="mt-1 h-3 w-64" />
      </div>
      <div className="hidden sm:flex gap-4">
        <Shimmer className="h-3 w-10" />
        <Shimmer className="h-3 w-10" />
        <Shimmer className="h-3 w-14" />
      </div>
    </div>
  );
}

export function SkillCardSkeleton({ layout = "grid", count = 6 }: SkillCardSkeletonProps) {
  const Skeleton = layout === "list" ? ListSkeleton : GridSkeleton;

  if (layout === "list") {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }, (_, i) => (
          <Skeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} />
      ))}
    </div>
  );
}
