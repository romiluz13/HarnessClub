"use client";

/**
 * Audit Log Viewer — paginated table of audit events with filters.
 * All data from real audit_logs collection via /api/settings/audit.
 */

import { useState } from "react";
import useSWR from "swr";
import { FileText, Loader2, Download, ArrowLeft } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ACTION_FILTERS = [
  { value: "", label: "All Actions" },
  { value: "asset:", label: "Asset Actions" },
  { value: "auth:", label: "Auth Actions" },
  { value: "team:", label: "Team Actions" },
  { value: "org:", label: "Org Actions" },
  { value: "approval:", label: "Approval Actions" },
] as const;

interface AuditEntry {
  id: string;
  action: string;
  actorName: string;
  targetId: string;
  targetType: string | null;
  details: Record<string, unknown> | null;
  timestamp: string;
}

export default function AuditPage() {
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const query = `?page=${page}&limit=25${actionFilter ? `&action=${actionFilter}` : ""}`;
  const { data, isLoading } = useSWR(`/api/settings/audit${query}`, fetcher);
  const entries: AuditEntry[] = data?.entries ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  const handleExport = async () => {
    const res = await fetch("/api/settings/audit?export=siem");
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Logs</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{total} total event{total !== 1 ? "s" : ""}</p>
        </div>
        <button type="button" onClick={handleExport}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          <Download className="h-4 w-4" /> Export SIEM
        </button>
      </div>

      {/* Action filter */}
      <div className="flex flex-wrap gap-1.5">
        {ACTION_FILTERS.map((f) => (
          <button key={f.value} type="button" onClick={() => { setActionFilter(f.value); setPage(1); }}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              actionFilter === f.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center dark:border-gray-700">
          <FileText className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-gray-500 dark:text-gray-400">No audit entries found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{e.actorName}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{e.targetType ?? "—"}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-gray-500 dark:text-gray-400">
                    {e.details ? JSON.stringify(e.details) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-700">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-700">Next</button>
        </div>
      )}
    </div>
  );
}
