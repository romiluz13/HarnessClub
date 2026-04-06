/**
 * Dashboard home page — server component with REAL data from MongoDB.
 *
 * Fetches stats directly from DB (no API call — server component has direct DB access).
 * Shows: asset count, member count, team count, pending approvals, recent activity.
 */

import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Puzzle, Users, FolderTree, AlertCircle, Plus } from "lucide-react";
import Link from "next/link";
import type { UserDocument } from "@/types/user";
import { ActivityFeed } from "@/components/activity-feed";
import { MetricsGrid } from "@/components/metrics-grid";

interface StatCardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
}

function StatCard({ title, value, description, icon: Icon, href }: StatCardProps) {
  const content = (
    <div className="rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <Icon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}



export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const db = await getDb();
  const userId = new ObjectId(session.user.id);
  const user = await db.collection<UserDocument>("users").findOne({ _id: userId });

  const orgMembership = user?.orgMemberships?.[0];
  const teamMembership = user?.teamMemberships?.[0];

  // If somehow they got here without an org (edge case), show empty state
  if (!orgMembership || !teamMembership) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">No organization found.</p>
          <Link href="/onboarding" className="mt-2 text-blue-600 hover:underline">Complete setup</Link>
        </div>
      </div>
    );
  }

  const orgId = orgMembership.orgId;
  const teamId = teamMembership.teamId;

  // Parallel DB queries — all independent
  const [assetCount, team, teamCount, pendingApprovals] = await Promise.all([
    db.collection("assets").countDocuments({ teamId }),
    db.collection("teams").findOne({ _id: teamId }),
    db.collection("teams").countDocuments({ orgId }),
    db.collection("approval_requests").countDocuments({ teamId, status: "pending" }),
  ]);

  const memberCount = team?.memberIds?.length ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Overview of {team?.name ?? "your team"}
          </p>
        </div>
        <Link href="/dashboard/assets/new"
          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> New Asset
        </Link>
      </div>

      {/* Stats grid — REAL numbers from DB */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Assets" value={assetCount} description="In your team" icon={Puzzle} href="/dashboard/assets" />
        <StatCard title="Team Members" value={memberCount} description={`In ${team?.name ?? "team"}`} icon={Users} href="/dashboard/teams" />
        <StatCard title="Teams" value={teamCount} description="In your organization" icon={FolderTree} href="/dashboard/teams" />
        <StatCard title="Pending Approvals" value={pendingApprovals} description="Awaiting review" icon={AlertCircle} href="/dashboard/approvals" />
      </div>

      {/* Team KPI Metrics */}
      <MetricsGrid teamId={teamId.toHexString()} />

      {/* Recent Activity — Slack-like feed (client component with SWR auto-refresh) */}
      <ActivityFeed teamId={teamId.toHexString()} />

      {/* Empty state — only shown when there are truly no assets */}
      {assetCount === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
          <Puzzle className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No assets yet</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Get started by creating your first skill, rule, or agent config.
          </p>
          <Link href="/dashboard/assets/new"
            className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Create your first asset
          </Link>
        </div>
      )}
    </div>
  );
}
