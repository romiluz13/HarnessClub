"use client";

/**
 * Assets list page — all 7 asset types, filterable, with real data from API.
 * Replaces the old "skills" page. Cards show trust score badge.
 */

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Plus, Loader2, Shield, AlertTriangle, Download } from "lucide-react";

const ASSET_TYPES = [
  { value: "", label: "All Types" },
  { value: "skill", label: "Skills" },
  { value: "rule", label: "Rules" },
  { value: "agent", label: "Agents" },
  { value: "plugin", label: "Plugins" },
  { value: "mcp_config", label: "MCP Configs" },
  { value: "hook", label: "Hooks" },
  { value: "settings_bundle", label: "Bundles" },
] as const;

function trustBadge(grade: string | undefined) {
  if (!grade) return null;
  const colors: Record<string, string> = {
    A: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    B: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    C: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    D: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colors[grade] ?? colors.C}`}>
      <Shield className="h-3 w-3" /> {grade}
    </span>
  );
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface AssetItem {
  id: string;
  type: string;
  name: string;
  description?: string;
  tags?: string[];
  trustScore?: { grade: string; overall: number };
  isPublished: boolean;
  updatedAt: string;
}

export default function AssetsPage() {
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const query = typeFilter ? `?type=${typeFilter}&page=${page}&limit=20` : `?page=${page}&limit=20`;
  const { data, isLoading, error } = useSWR(`/api/assets${query}`, fetcher);

  const assets: AssetItem[] = data?.assets ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Assets</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{total} total asset{total !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/dashboard/assets/new"
          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> New Asset
        </Link>
      </div>

      {/* Type filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {ASSET_TYPES.map((t) => (
          <button key={t.value} type="button" onClick={() => { setTypeFilter(t.value); setPage(1); }}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              typeFilter === t.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" /> Failed to load assets.
        </div>
      )}

      {/* Asset grid */}
      {!isLoading && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <Link key={asset.id} href={`/dashboard/skills/${asset.id}`}
              className="group rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-blue-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700">
              <div className="flex items-start justify-between">
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  {asset.type}
                </span>
                {trustBadge(asset.trustScore?.grade)}
              </div>
              <h3 className="mt-3 font-semibold text-gray-900 group-hover:text-blue-600 dark:text-white">{asset.name}</h3>
              {asset.description && (
                <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{asset.description}</p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {(asset.tags ?? []).slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">{tag}</span>
                  ))}
                </div>
                {asset.isPublished && (
                  <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <Download className="h-3 w-3" /> Published
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && assets.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">No assets found. Create your first one!</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-700">Prev</button>
          <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-700">Next</button>
        </div>
      )}
    </div>
  );
}
