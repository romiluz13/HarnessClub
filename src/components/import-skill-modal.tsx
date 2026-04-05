"use client";

/**
 * Import skill from GitHub modal.
 * Accepts GitHub URL, selects target team, imports SKILL.md/AGENTS.md/CLAUDE.md.
 * Per AGENTS.md: cursor-pointer, 44px targets, proper error states.
 */

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { X, Loader2, CheckCircle, AlertCircle } from "lucide-react";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

interface TeamOption {
  id: string;
  name: string;
  slug: string;
  userRole: string;
}

const teamsFetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<{ teams: TeamOption[] }>);

interface ImportSkillModalProps {
  onClose: () => void;
}

export function ImportSkillModal({ onClose }: ImportSkillModalProps) {
  const { data: teamsData } = useSWR("/api/teams", teamsFetcher);
  const [repoUrl, setRepoUrl] = useState("");
  const [ref, setRef] = useState("main");
  const [teamId, setTeamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Auto-select first team
  useEffect(() => {
    if (teamsData?.teams.length && !teamId) {
      const editableTeam = teamsData.teams.find(
        (t) => t.userRole === "owner" || t.userRole === "admin"
      );
      if (editableTeam) setTeamId(editableTeam.id);
    }
  }, [teamsData, teamId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) { setError("Repository URL is required"); return; }
    if (!teamId) { setError("Select a team"); return; }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/skills/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: repoUrl.trim(), teamId, ref: ref.trim() || "main" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      const typeLabel = data.type ? ` (${data.type})` : "";
      setSuccess(`Imported "${data.name}"${typeLabel} successfully!`);
      await mutate("/api/skills");

      // Auto-close after success
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const editableTeams = (teamsData?.teams || []).filter(
    (t) => t.userRole === "owner" || t.userRole === "admin"
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <GitHubIcon className="h-5 w-5" />
            Import from GitHub
          </h3>
          <button onClick={onClose} className="cursor-pointer text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Repository URL</label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo or owner/repo"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-400">
              Auto-detects type from SKILL.md, AGENTS.md, CLAUDE.md, or MCP config
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch/Tag</label>
            <input
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="main"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Team</label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select team...</option>
              {editableTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {editableTeams.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">You need admin/owner role on a team to import skills.</p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />{success}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="cursor-pointer rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !!success}
              className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors min-h-[44px] flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Importing..." : "Import"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
