"use client";

/**
 * Assets list with type filter tabs, grid/list toggle, SWR data fetching.
 * Per AGENTS.md: State order Error → Loading → Empty → Success.
 */

import { useState, useMemo } from "react";
import useSWR from "swr";
import { Grid3X3, List, AlertCircle, Puzzle } from "lucide-react";
import { SkillCard } from "@/components/skill-card";
import { SkillCardSkeleton } from "@/components/skill-card-skeleton";
import type { AssetType } from "@/types/asset";
import { ASSET_TYPES } from "@/types/asset";
import { getAssetTypeLabel } from "@/components/asset-type-badge";

interface SkillData {
  id: string;
  type?: string;
  teamId: string;
  name: string;
  description: string;
  author?: string;
  version?: string;
  tags: string[];
  installCount: number;
  viewCount: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SkillsResponse {
  skills: SkillData[];
  total: number;
  page: number;
  limit: number;
}

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("Failed to fetch skills");
  return r.json() as Promise<SkillsResponse>;
});

export function SkillsList() {
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [typeFilter, setTypeFilter] = useState<AssetType | "all">("all");

  const apiUrl = typeFilter === "all" ? "/api/skills" : `/api/skills?type=${typeFilter}`;
  const { data, error, isLoading } = useSWR(apiUrl, fetcher, {
    revalidateOnFocus: false,
  });

  // Error state
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
        <h3 className="mt-3 text-sm font-medium text-red-800">Failed to load skills</h3>
        <p className="mt-1 text-sm text-red-600">{error.message}</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div>
        <LayoutToggle layout={layout} onLayoutChange={setLayout} />
        <SkillCardSkeleton layout={layout} count={6} />
      </div>
    );
  }

  // Empty state
  if (!data?.skills.length) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
        <Puzzle className="mx-auto h-12 w-12 text-gray-300" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">No skills found</h3>
        <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
          Skills will appear here once you import them from GitHub or the Claude Code marketplace.
        </p>
      </div>
    );
  }

  // Success state
  return (
    <div>
      <TypeFilterTabs selected={typeFilter} onSelect={setTypeFilter} />
      <LayoutToggle layout={layout} onLayoutChange={setLayout} total={data.total} />
      {layout === "list" ? (
        <div className="space-y-2">
          {data.skills.map((skill) => (
            <SkillCard key={skill.id} {...skill} layout="list" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.skills.map((skill) => (
            <SkillCard key={skill.id} {...skill} layout="grid" />
          ))}
        </div>
      )}
    </div>
  );
}

/** Grid/List toggle with skill count */
function LayoutToggle({
  layout,
  onLayoutChange,
  total,
}: {
  layout: "grid" | "list";
  onLayoutChange: (l: "grid" | "list") => void;
  total?: number;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      {total !== undefined && (
        <p className="text-sm text-gray-500">{total} skill{total !== 1 ? "s" : ""}</p>
      )}
      <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
        <button
          onClick={() => onLayoutChange("grid")}
          className={`flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors ${
            layout === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"
          }`}
          aria-label="Grid view"
          title="Grid view"
        >
          <Grid3X3 className="h-4 w-4" />
        </button>
        <button
          onClick={() => onLayoutChange("list")}
          className={`flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors ${
            layout === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"
          }`}
          aria-label="List view"
          title="List view"
        >
          <List className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}


/** Type filter tabs — "All" + one tab per asset type */
function TypeFilterTabs({
  selected,
  onSelect,
}: {
  selected: AssetType | "all";
  onSelect: (type: AssetType | "all") => void;
}) {
  const tabs: Array<{ value: AssetType | "all"; label: string }> = [
    { value: "all", label: "All" },
    ...ASSET_TYPES.map((t) => ({ value: t, label: getAssetTypeLabel(t) })),
  ];

  return (
    <div className="flex gap-1 overflow-x-auto pb-2 mb-4" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={selected === tab.value}
          onClick={() => onSelect(tab.value)}
          className={`
            whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium cursor-pointer
            transition-colors duration-150
            ${
              selected === tab.value
                ? "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
