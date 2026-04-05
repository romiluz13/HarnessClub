"use client";

/**
 * Asset Create Page — form for creating a new asset.
 * Type selector + metadata + content editor.
 * Posts to POST /api/assets, redirects to asset detail on success.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import { useActiveOrg } from "@/lib/hooks/use-active-org";

const ASSET_TYPE_OPTIONS = [
  { value: "skill", label: "Skill", desc: "Coding guidelines and best practices" },
  { value: "rule", label: "Rule", desc: "Enforcement rules for code quality" },
  { value: "agent", label: "Agent", desc: "AI agent configuration" },
  { value: "plugin", label: "Plugin", desc: "Tool plugin definition" },
  { value: "mcp_config", label: "MCP Config", desc: "Model Context Protocol config" },
  { value: "hook", label: "Hook", desc: "Event-driven automation hook" },
  { value: "settings_bundle", label: "Settings Bundle", desc: "Grouped configuration settings" },
] as const;

export default function CreateAssetPage() {
  const router = useRouter();
  const { teamId, loading: teamLoading } = useActiveOrg();
  const [type, setType] = useState("skill");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const addTag = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  }, [tagInput, tags]);

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!teamId) {
      setError("You need an active team before creating an asset");
      return;
    }

    setSubmitting(true);
    setError("");

    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, teamId, name: name.trim(), description: description.trim(), content, tags }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? data.errors?.join(", ") ?? "Failed to create asset");
      setSubmitting(false);
      return;
    }

    const data = await res.json();
    router.push(`/dashboard/skills/${data.id}`);
  }, [type, teamId, name, description, content, tags, router]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Asset</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Assets are created in your active team context.</p>
        </div>
      </div>

      {!teamLoading && !teamId ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
          Join or create a team before creating assets.
        </div>
      ) : null}

      {/* Type selector */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Asset Type</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {ASSET_TYPE_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setType(opt.value)}
              className={`cursor-pointer rounded-lg border p-3 text-left text-sm transition-all ${
                type === opt.value
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-950 dark:ring-blue-800"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
              }`}>
              <div className="font-medium text-gray-900 dark:text-white">{opt.label}</div>
              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. TypeScript Best Practices"
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this asset"
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
      </div>

      {/* Tags */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tags</label>
        <div className="flex gap-2">
          <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="Add tag and press Enter"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          <button type="button" onClick={addTag} className="cursor-pointer rounded-lg bg-gray-100 px-3 py-2 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="cursor-pointer text-blue-600 hover:text-blue-800 dark:text-blue-300"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Content</label>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={16}
          placeholder="# Your asset content here&#10;&#10;Write Markdown content for your skill, rule, or agent config..."
          className="w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
      </div>

      {/* Error */}
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

      {/* Submit */}
      <div className="flex justify-end">
        <button type="button" onClick={handleSubmit}
          disabled={!teamId || !name.trim() || !content.trim() || submitting}
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <><Plus className="h-4 w-4" /> Create Asset</>}
        </button>
      </div>
    </div>
  );
}
