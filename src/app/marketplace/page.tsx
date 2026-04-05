"use client";

/**
 * Marketplace Browse — discover and install published assets.
 * Queries the search API for published assets across all teams.
 */

import { useState } from "react";
import useSWR from "swr";
import { Store, Search, Shield, Download, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface MarketplaceItem {
  id: string;
  type: string;
  name: string;
  description: string;
  tags: string[];
  trustScore?: { grade: string; overall: number } | null;
  installCount: number;
  author?: string;
}

export default function MarketplacePage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Search published assets (marketplace=true)
  const searchUrl = `/api/marketplace/browse?q=${encodeURIComponent(query)}&type=${typeFilter}`;
  const { data, isLoading } = useSWR(searchUrl, fetcher, { revalidateOnFocus: false });
  const items: MarketplaceItem[] = data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Marketplace</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">Discover and install agent configs shared by teams</p>
      </div>

      {/* Search */}
      <div className="mx-auto max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills, rules, agents..."
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
        </div>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {[
          { value: "", label: "All" }, { value: "skill", label: "Skills" }, { value: "rule", label: "Rules" },
          { value: "agent", label: "Agents" }, { value: "plugin", label: "Plugins" },
        ].map((t) => (
          <button key={t.value} type="button" onClick={() => setTypeFilter(t.value)}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium ${
              typeFilter === t.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-16 text-center dark:border-gray-700">
          <Store className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            {query ? "No results found. Try a different search." : "No published assets yet. Be the first to publish!"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="group rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-blue-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700">
              <div className="flex items-start justify-between">
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">{item.type}</span>
                {item.trustScore?.grade && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.trustScore.grade === "A" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  }`}>
                    <Shield className="h-3 w-3" /> {item.trustScore.grade}
                  </span>
                )}
              </div>
              <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">{item.name}</h3>
              {item.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{item.description}</p>}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {item.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800">{tag}</span>
                  ))}
                </div>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Download className="h-3 w-3" /> {item.installCount}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
          Back to Dashboard <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
