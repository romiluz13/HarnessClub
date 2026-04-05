"use client";

/**
 * Organization Settings — view/edit org info + departments.
 */

import useSWR from "swr";
import { Building2, Loader2, ArrowLeft, FolderTree } from "lucide-react";
import Link from "next/link";
import { DepartmentComparison } from "@/components/department-comparison";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function OrgSettingsPage() {
  const { data: orgData, isLoading: orgLoading } = useSWR("/api/orgs", fetcher);
  const org = orgData?.organizations?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Organization</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage your organization settings</p>
        </div>
      </div>

      {orgLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : !org ? (
        <p className="text-gray-500 dark:text-gray-400">No organization found.</p>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="h-6 w-6 text-gray-400" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{org.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Slug: {org.slug} · Plan: {org.plan ?? "Free"} · Created: {new Date(org.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300">Marketplace</p>
                <p className="text-gray-500 dark:text-gray-400">{org.settings?.marketplaceEnabled ? "Enabled" : "Disabled"}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300">SSO</p>
                <p className="text-gray-500 dark:text-gray-400">{org.settings?.ssoEnabled ? "Enabled" : "Disabled"}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300">Default Department Type</p>
                <p className="text-gray-500 dark:text-gray-400">{org.settings?.defaultDeptType ?? "engineering_fe"}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300">Cross-Dept Approval</p>
                <p className="text-gray-500 dark:text-gray-400">{org.settings?.crossDeptApprovalRequired ? "Required" : "Not required"}</p>
              </div>
            </div>
          </div>

          {/* Departments section */}
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
              <FolderTree className="h-4 w-4 text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Departments</h3>
            </div>
            <DepartmentsList orgId={org.id} />
          </div>

          {/* Department Metrics Comparison */}
          <DepartmentComparison orgId={org.id} />
        </>
      )}
    </div>
  );
}

function DepartmentsList({ orgId }: { orgId: string }) {
  const { data, isLoading } = useSWR(`/api/orgs/${orgId}/departments`, fetcher);
  const departments = data?.departments ?? [];

  if (isLoading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>;
  if (departments.length === 0) return <p className="p-6 text-sm text-gray-500">No departments.</p>;

  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
      {departments.map((d: { id: string; name: string; type: string; description: string }) => (
        <li key={d.id} className="px-6 py-4">
          <p className="font-medium text-gray-900 dark:text-white">{d.name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{d.type} — {d.description}</p>
        </li>
      ))}
    </ul>
  );
}
