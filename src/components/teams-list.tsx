"use client";

/**
 * Teams list with create team modal.
 * SWR data fetching. Error → Loading → Empty → Success state order.
 * Per AGENTS.md: cursor-pointer, 44px targets, Lucide icons.
 */

import { useState } from "react";
import useSWR, { mutate } from "swr";
import Link from "next/link";
import { Users, Puzzle, Crown, Shield, User, Eye, AlertCircle, Loader2, Plus, X } from "lucide-react";

interface TeamData {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  memberCount: number;
  skillCount: number;
  userRole: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("Failed to fetch teams");
  return r.json() as Promise<{ teams: TeamData[] }>;
});

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  member: User,
  viewer: Eye,
};

export function TeamsList() {
  const { data, error, isLoading } = useSWR("/api/teams", fetcher);
  const [showCreate, setShowCreate] = useState(false);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
        <h3 className="mt-3 text-sm font-medium text-red-800">Failed to load teams</h3>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data?.teams.length) {
    return (
      <>
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No teams yet</h3>
          <p className="mt-2 text-sm text-gray-500">Create a team to start managing skills.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 cursor-pointer rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors min-h-[44px]"
          >
            Create your first team
          </button>
        </div>
        {showCreate && <CreateTeamModal onClose={() => setShowCreate(false)} />}
      </>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.teams.map((team) => {
          const RoleIcon = ROLE_ICONS[team.userRole] || User;
          return (
            <Link
              key={team.id}
              href={`/dashboard/teams/${team.slug}`}
              className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 truncate min-w-0">{team.name}</h3>
                <span className="flex items-center gap-1 text-xs text-gray-400 capitalize">
                  <RoleIcon className="h-3 w-3" />{team.userRole}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{team.memberCount}</span>
                <span className="flex items-center gap-1"><Puzzle className="h-3.5 w-3.5" />{team.skillCount} skills</span>
              </div>
            </Link>
          );
        })}
      </div>
      {showCreate && <CreateTeamModal onClose={() => setShowCreate(false)} />}
    </>
  );
}

function CreateTeamModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { setError("Name must be at least 2 characters"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create team");
      }
      await mutate("/api/teams");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Create Team</h3>
          <button onClick={onClose} className="cursor-pointer text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Team name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g. Acme Engineering"
            autoFocus
            maxLength={100}
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="cursor-pointer rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors min-h-[44px] flex items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
