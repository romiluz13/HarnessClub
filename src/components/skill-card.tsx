/**
 * Skill card — displays an asset summary in grid or list layout.
 * Server-compatible (no 'use client'). Receives data as props.
 * Per AGENTS.md: cursor-pointer, 44px targets, Lucide icons.
 */

import Link from "next/link";
import { Download, Eye, Tag } from "lucide-react";
import type { AssetType } from "@/types/asset";
import { AssetTypeBadge } from "@/components/asset-type-badge";

interface SkillCardProps {
  id: string;
  type?: string;
  name: string;
  description: string;
  author?: string;
  version?: string;
  tags: string[];
  installCount: number;
  viewCount: number;
  isPublished: boolean;
  updatedAt: string;
  layout?: "grid" | "list";
}

export function SkillCard({
  id,
  type,
  name,
  description,
  author,
  version,
  tags,
  installCount,
  viewCount,
  isPublished,
  updatedAt,
  layout = "grid",
}: SkillCardProps) {
  const timeAgo = formatTimeAgo(updatedAt);

  if (layout === "list") {
    return (
      <Link
        href={`/dashboard/assets/${id}`}
        className="flex cursor-pointer items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 hover:shadow-sm transition-all min-h-[44px]"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {type && <AssetTypeBadge type={type as AssetType} size="sm" />}
            <h3 className="text-sm font-semibold text-gray-900 truncate">{name}</h3>
            {version && <span className="text-xs text-gray-400">v{version}</span>}
            {!isPublished && (
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Draft</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-gray-500 truncate">{description}</p>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Download className="h-3 w-3" />{installCount}</span>
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{viewCount}</span>
          <span>{timeAgo}</span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/dashboard/assets/${id}`}
      className="flex cursor-pointer flex-col rounded-xl border border-gray-200 bg-white p-5 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {type && <AssetTypeBadge type={type as AssetType} size="sm" />}
          <h3 className="font-semibold text-gray-900 truncate mt-1">{name}</h3>
          {author && <p className="text-xs text-gray-400 mt-0.5">by {author}</p>}
        </div>
        <div className="flex items-center gap-1">
          {version && <span className="text-xs text-gray-400">v{version}</span>}
          {!isPublished && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Draft</span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="mt-2 text-sm text-gray-500 line-clamp-2 flex-1">{description}</p>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              <Tag className="h-2.5 w-2.5" />
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="text-xs text-gray-400">+{tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Download className="h-3 w-3" />{installCount}</span>
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{viewCount}</span>
        </div>
        <span>{timeAgo}</span>
      </div>
    </Link>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}
