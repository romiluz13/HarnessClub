"use client";

/**
 * Team Detail Page — shows members, settings, activity.
 * Fetches team by slug, then loads members from /api/teams/[teamId]/members.
 */

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import { Users, UserPlus, Loader2, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ActivityFeed } from "@/components/activity-feed";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string | null;
}

const MANAGER_ROLE_OPTIONS = ["viewer", "member"] as const;
const OWNER_ROLE_OPTIONS = ["viewer", "member", "admin"] as const;

export default function TeamDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  // Fetch team by slug (we need teamId from the teams list)
  const { data: teamsData, isLoading: teamsLoading } = useSWR("/api/teams", fetcher);
  const team = (teamsData?.teams ?? []).find((t: { slug: string }) => t.slug === slug);
  const teamId = team?.id;

  // Fetch members once we have teamId
  const membersKey = teamId ? `/api/teams/${teamId}/members` : null;
  const { data: membersData, isLoading: membersLoading } = useSWR(membersKey, fetcher);
  const members: Member[] = membersData?.members ?? [];
  const currentUserId = membersData?.currentUserId ?? null;
  const currentUserRole = membersData?.currentUserRole ?? null;
  const canManageMembers = Boolean(membersData?.canManageMembers);
  const assignableRoles = currentUserRole === "owner" ? OWNER_ROLE_OPTIONS : MANAGER_ROLE_OPTIONS;

  // Invite modal state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [memberActionError, setMemberActionError] = useState("");

  const handleInvite = useCallback(async () => {
    if (!teamId || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError("");
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    });
    if (!res.ok) {
      const data = await res.json();
      setInviteError(data.error ?? "Failed to invite");
      setInviting(false);
      return;
    }
    setInviteEmail("");
    setInviteRole("member");
    setShowInvite(false);
    setInviting(false);
    mutate(membersKey);
  }, [teamId, inviteEmail, inviteRole, membersKey]);

  const handleRemove = useCallback(async (userId: string) => {
    if (!teamId || !confirm("Remove this member from the team?")) return;
    setMemberActionError("");
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", userId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setMemberActionError(data?.error ?? "Failed to remove member");
      return;
    }
    mutate(membersKey);
  }, [teamId, membersKey]);

  const handleRoleChange = useCallback(async (userId: string, newRole: string) => {
    if (!teamId) return;
    setMemberActionError("");
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setMemberActionError(data?.error ?? "Failed to update role");
      return;
    }
    mutate(membersKey);
  }, [teamId, membersKey]);

  if (teamsLoading || membersLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }
  if (!team) {
    return <div className="py-12 text-center text-gray-500">Team not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/teams" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{team.name}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{members.length} member{members.length !== 1 ? "s" : ""}</p>
        </div>
        {canManageMembers ? (
          <button type="button" onClick={() => setShowInvite(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <UserPlus className="h-4 w-4" /> Invite Member
          </button>
        ) : null}
      </div>

      {/* Invite modal */}
      {showInvite && canManageMembers && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-950">
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Invite a team member</h3>
          <div className="flex gap-2">
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@example.com" autoFocus
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
              {assignableRoles.map((role) => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
              className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite"}
            </button>
            <button type="button" onClick={() => setShowInvite(false)}
              className="cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600">Cancel</button>
          </div>
          {inviteError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{inviteError}</p>}
        </div>
      )}

      {memberActionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {memberActionError}
        </div>
      ) : null}

      {/* Members table */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white"><Users className="h-4 w-4" /> Members</h3>
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-4 px-6 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                {m.name[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white">{m.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.email}</p>
              </div>
              {(() => {
                const canEditMember = canManageMembers
                  && currentUserId !== m.id
                  && m.role !== "owner"
                  && !(currentUserRole !== "owner" && m.role === "admin");

                if (!canEditMember) {
                  return (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {m.role}
                    </span>
                  );
                }

                return (
                  <>
                    <select value={m.role} onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      className="cursor-pointer rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                      {assignableRoles.map((role) => (
                        <option key={role} value={role}>
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => handleRemove(m.id)}
                      className="cursor-pointer rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                );
              })()}
            </li>
          ))}
        </ul>
      </div>

      {/* Activity Feed */}
      {teamId && <ActivityFeed teamId={teamId} />}
    </div>
  );
}
