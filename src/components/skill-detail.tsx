"use client";

/**
 * Skill detail view with metadata display and content preview.
 * SWR for data fetching, inline editing for metadata.
 * Per AGENTS.md: State order Error → Loading → Empty → Success.
 */

import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  Download,
  Eye,
  Tag,
  ExternalLink,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { VersionTimeline } from "@/components/version-timeline";
import { AssetPreview } from "@/components/asset-preview";
import { ExportPreview } from "@/components/export-preview";
import type { AssetVersion } from "@/services/version-service";

interface SkillData {
  id: string;
  type?: string;
  teamId: string;
  name: string;
  description: string;
  author?: string;
  version?: string;
  tags: string[];
  content: string;
  installCount: number;
  viewCount: number;
  isPublished: boolean;
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
  currentVersionNumber?: number;
}

interface VersionsResponse {
  versions: AssetVersion[];
  total: number;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(r.status === 404 ? "Asset not found" : "Failed to load asset");
    return r.json() as Promise<SkillData>;
  });

interface SkillDetailProps {
  skillId: string;
}

export function SkillDetail({ skillId }: SkillDetailProps) {
  const router = useRouter();
  const { data: skill, error, isLoading, mutate: mutateSkill } = useSWR(`/api/assets/${skillId}`, fetcher);
  const { data: versionsData, mutate: mutateVersions } = useSWR<VersionsResponse>(
    skill ? `/api/assets/${skillId}/versions?limit=20&includeDiffs=true` : null,
    (url: string) => fetch(url).then((r) => r.json())
  );

  const handleRollback = async (versionNumber: number) => {
    await fetch(`/api/assets/${skillId}/versions/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetVersion: versionNumber }),
    });
    mutateSkill();
    mutateVersions();
  };

  // Error
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
        <h3 className="mt-3 text-sm font-medium text-red-800">{error.message}</h3>
        <button
          onClick={() => router.push("/dashboard/assets")}
          className="mt-4 cursor-pointer text-sm text-red-600 hover:text-red-800 underline"
        >
          Back to assets
        </button>
      </div>
    );
  }

  // Loading
  if (isLoading || !skill) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <>
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/assets"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          aria-label="Back to assets"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-900 truncate">{skill.name}</h2>
            {skill.version && <span className="text-sm text-gray-400">v{skill.version}</span>}
            {!skill.isPublished && (
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Draft</span>
            )}
          </div>
          {skill.author && <p className="text-sm text-gray-500">by {skill.author}</p>}
        </div>
      </div>

      {/* Metadata + Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Content (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Description</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{skill.description}</p>
          </div>

          {skill.content && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Content</h3>
              <pre className="overflow-x-auto rounded-lg bg-gray-50 p-4 text-xs text-gray-700 font-mono whitespace-pre-wrap">
                {skill.content}
              </pre>
            </div>
          )}
        </div>

        {/* Sidebar metadata (1/3 width) */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Download className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">{skill.installCount} installs</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Eye className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">{skill.viewCount} views</span>
            </div>
            {skill.sourceUrl && (
              <a
                href={skill.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex cursor-pointer items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="h-4 w-4" />
                Source
              </a>
            )}
          </div>

          {skill.tags.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Tags</h4>
              <div className="flex flex-wrap gap-1">
                {skill.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600">
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Preview */}
      <AssetPreview
        content={skill.content}
        type={(skill.type ?? "skill") as import("@/types/asset").AssetType}
        name={skill.name}
      />

      {/* Export Preview */}
      <ExportPreview assetId={skillId} />

      {/* Version Timeline */}
      {versionsData && versionsData.versions.length > 0 && (
        <VersionTimeline
          assetId={skillId}
          versions={versionsData.versions}
          currentVersionNumber={skill.currentVersionNumber ?? versionsData.versions[0]?.versionNumber ?? 1}
          onRollback={handleRollback}
        />
      )}
    </>
  );
}
