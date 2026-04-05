"use client";

/**
 * ActivityFeed — Slack-like team activity feed with filters, @mentions, and auto-refresh.
 *
 * Per frontend-patterns: accessible, responsive, all states (error/loading/empty/success).
 * Per vercel-react-best-practices: SWR for data fetching, optimistic updates.
 */

import { useState, useCallback } from "react";
import useSWR from "swr";
import {
  Activity,
  FileText,
  Users,
  CheckCircle,
  Shield,
  Building,
  Loader2,
  AtSign,
  ChevronDown,
  ChevronUp,
  Bell,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type FeedCategory = "asset" | "team" | "approval" | "security" | "org";

interface FeedEntry {
  id: string;
  action: string;
  category: FeedCategory;
  actorId: string;
  actorName: string;
  actorInitial: string;
  targetName?: string;
  message: string;
  timestamp: string;
}

interface ActivityFeedProps {
  teamId: string;
  className?: string;
}

const CATEGORY_CONFIG: { value: FeedCategory | ""; label: string; icon: typeof Activity }[] = [
  { value: "", label: "All", icon: Activity },
  { value: "asset", label: "Assets", icon: FileText },
  { value: "team", label: "Team", icon: Users },
  { value: "approval", label: "Approvals", icon: CheckCircle },
  { value: "security", label: "Security", icon: Shield },
  { value: "org", label: "Org", icon: Building },
];

const ACTOR_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
];

function actorColor(actorId: string): string {
  let hash = 0;
  for (let i = 0; i < actorId.length; i++) hash = (hash * 31 + actorId.charCodeAt(i)) | 0;
  return ACTOR_COLORS[Math.abs(hash) % ACTOR_COLORS.length];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ActivityFeed({ teamId, className = "" }: ActivityFeedProps) {
  const [category, setCategory] = useState<FeedCategory | "">("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(true);

  const query = category ? `&category=${category}` : "";
  const { data, isLoading, error } = useSWR(
    `/api/teams/${teamId}/feed?page=${page}&limit=30${query}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const entries: FeedEntry[] = data?.entries ?? [];
  const total: number = data?.total ?? 0;
  const unreadCount: number = data?.unreadCount ?? 0;

  const markRead = useCallback(async () => {
    await fetch(`/api/teams/${teamId}/feed`, { method: "POST" });
  }, [teamId]);

  return (
    <div className={`rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full cursor-pointer items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Activity Feed</h3>
          {unreadCount > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {expanded && (
        <>
          {/* Category filters */}
          <div className="flex items-center gap-1 border-t border-gray-100 px-4 py-2 dark:border-gray-800">
            {CATEGORY_CONFIG.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => { setCategory(c.value as FeedCategory | ""); setPage(1); }}
                  className={`flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    category === c.value
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {c.label}
                </button>
              );
            })}

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markRead}
                className="ml-auto flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs text-gray-400 hover:text-blue-600"
                title="Mark all as read"
              >
                <Bell className="h-3 w-3" /> Mark read
              </button>
            )}
          </div>

          {/* Feed entries */}
          <div className="max-h-[400px] overflow-y-auto border-t border-gray-100 dark:border-gray-800">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="p-6 text-center text-sm text-red-500">Failed to load activity feed</div>
            ) : entries.length === 0 ? (
              <div className="p-6 text-center">
                <Activity className="mx-auto mb-2 h-6 w-6 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-400">No activity yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    {/* Actor avatar */}
                    <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${actorColor(entry.actorId)}`}>
                      {entry.actorInitial}
                    </div>
                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-medium text-gray-900 dark:text-white">{entry.actorName}</span>{" "}
                        {entry.message.replace(entry.actorName + " ", "")}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">{relativeTime(entry.timestamp)}</p>
                    </div>
                    {/* Category icon */}
                    <CategoryIcon category={entry.category} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {total > 30 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="cursor-pointer rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
              >
                ← Newer
              </button>
              <span className="text-xs text-gray-400">Page {page}</span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 30 >= total}
                className="cursor-pointer rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
              >
                Older →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CategoryIcon({ category }: { category: FeedCategory }) {
  const cls = "h-3.5 w-3.5 text-gray-400";
  switch (category) {
    case "asset": return <FileText className={cls} />;
    case "team": return <Users className={cls} />;
    case "approval": return <CheckCircle className={cls} />;
    case "security": return <Shield className={cls} />;
    case "org": return <Building className={cls} />;
    default: return <Activity className={cls} />;
  }
}
