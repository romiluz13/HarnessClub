"use client";

/**
 * Approval Queue — pending/approved/rejected approval requests.
 * Reviewers can approve/reject with comments. Shows version diff for review.
 */

import { useState, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { CheckCircle, XCircle, Clock, Loader2, MessageSquare, GitCompareArrows } from "lucide-react";
import { DiffViewer } from "@/components/diff-viewer";
import type { VersionDiff } from "@/services/version-service";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ApprovalItem {
  id: string;
  assetId: string;
  assetName: string;
  assetType: string;
  requesterName: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewComment?: string;
}

export default function ApprovalsPage() {
  const [filter, setFilter] = useState<"" | "pending" | "approved" | "rejected">("");
  const query = filter ? `?status=${filter}` : "";
  const { data, isLoading } = useSWR(`/api/approvals${query}`, fetcher);
  const approvals: ApprovalItem[] = data?.approvals ?? [];

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [processing, setProcessing] = useState(false);
  const [diffData, setDiffData] = useState<Record<string, VersionDiff | null>>({});
  const [diffLoading, setDiffLoading] = useState<string | null>(null);

  const startReview = useCallback(async (approval: ApprovalItem) => {
    setReviewingId(approval.id);
    if (diffData[approval.assetId] !== undefined) {
      return;
    }

    setDiffLoading(approval.assetId);
    try {
      const response = await fetch(`/api/assets/${approval.assetId}/versions?limit=1&includeDiffs=true`);
      const payload = await response.json();
      const latestDiff = payload.versions?.[0]?.diff ?? null;
      setDiffData((prev) => ({ ...prev, [approval.assetId]: latestDiff }));
    } catch {
      setDiffData((prev) => ({ ...prev, [approval.assetId]: null }));
    } finally {
      setDiffLoading(null);
    }
  }, [diffData]);

  const handleAction = useCallback(async (approvalId: string, action: "approve" | "reject") => {
    setProcessing(true);
    await fetch(`/api/approvals/${approvalId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: action, comment: comment.trim() || undefined }),
    });
    setReviewingId(null);
    setComment("");
    setProcessing(false);
    mutate(`/api/approvals${query}`);
  }, [comment, query]);

  const statusIcon = (s: string) => {
    if (s === "approved") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (s === "rejected") return <XCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-yellow-500" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Approvals</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Review and manage asset approval requests</p>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5">
        {[
          { value: "" as const, label: "All" },
          { value: "pending" as const, label: "Pending" },
          { value: "approved" as const, label: "Approved" },
          { value: "rejected" as const, label: "Rejected" },
        ].map((f) => (
          <button key={f.value} type="button" onClick={() => setFilter(f.value)}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === f.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : approvals.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center dark:border-gray-700">
          <CheckCircle className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-gray-500 dark:text-gray-400">No approval requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => (
            <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                {statusIcon(a.status)}
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{a.assetName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {a.assetType} · by {a.requesterName} · {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {a.status === "pending" && (
                  <div className="flex gap-2">
                    {reviewingId === a.id ? (
                      <>
                        <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)"
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                        <button type="button" onClick={() => handleAction(a.id, "approve")} disabled={processing}
                          className="cursor-pointer rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50">Approve</button>
                        <button type="button" onClick={() => handleAction(a.id, "reject")} disabled={processing}
                          className="cursor-pointer rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50">Reject</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => void startReview(a)}
                        className="flex cursor-pointer items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">
                        <MessageSquare className="h-3.5 w-3.5" /> Review
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Version diff panel — shown when reviewing */}
              {reviewingId === a.id && (
                <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                    <GitCompareArrows className="h-3.5 w-3.5" /> Changes in this version
                  </div>
                  {diffLoading === a.assetId ? (
                    <div className="flex items-center gap-2 py-4 text-xs text-gray-400">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading diff…
                    </div>
                  ) : diffData[a.assetId] != null ? (
                    <DiffViewer diff={diffData[a.assetId]!} fromLabel="Previous" toLabel="Proposed" />
                  ) : (
                    <p className="py-2 text-xs text-gray-400">No version diff available for this asset.</p>
                  )}
                </div>
              )}

              {a.reviewComment && (
                <p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  {a.reviewComment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
