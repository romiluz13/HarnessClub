"use client";

/**
 * Webhook Management — list, create, delete webhooks.
 * All data from real webhook-service via /api/settings/webhooks.
 */

import { useState, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { Globe, Plus, Trash2, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const EVENT_OPTIONS = [
  "asset.created", "asset.updated", "asset.deleted", "asset.published",
  "approval.requested", "approval.approved", "approval.rejected",
  "team.member_added", "team.member_removed",
] as const;

interface WebhookItem { id: string; url: string; events: string[]; active: boolean; createdAt: string; }

export default function WebhooksPage() {
  const { data, isLoading } = useSWR("/api/settings/webhooks", fetcher);
  const webhooks: WebhookItem[] = data?.webhooks ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["asset.created"]);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  const toggleEvent = (e: string) => setEvents((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    const res = await fetch("/api/settings/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, events }),
    });
    if (res.ok) {
      const data = await res.json();
      setSecret(data.secret);
      setUrl("");
      mutate("/api/settings/webhooks");
    }
    setCreating(false);
  }, [url, events]);

  const handleDelete = useCallback(async (webhookId: string) => {
    if (!confirm("Delete this webhook?")) return;
    await fetch("/api/settings/webhooks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookId, action: "delete" }),
    });
    mutate("/api/settings/webhooks");
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Webhooks</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Receive event notifications via HTTP</p>
        </div>
        <button type="button" onClick={() => { setShowCreate(true); setSecret(null); }}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> New Webhook
        </button>
      </div>

      {secret && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-950">
          <p className="mb-2 text-sm font-medium text-green-800 dark:text-green-200">Webhook secret (save it now):</p>
          <code className="block rounded-lg bg-white px-3 py-2 font-mono text-sm dark:bg-gray-900 dark:text-white">{secret}</code>
        </div>
      )}

      {showCreate && !secret && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-950">
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Create webhook</h3>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhook"
            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Events:</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {EVENT_OPTIONS.map((e) => (
              <button key={e} type="button" onClick={() => toggleEvent(e)}
                className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium ${events.includes(e) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                {e}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleCreate} disabled={creating || !url.trim() || events.length === 0}
              className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : webhooks.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center dark:border-gray-700">
          <Globe className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-gray-500 dark:text-gray-400">No webhooks configured.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {webhooks.map((w) => (
              <li key={w.id} className="flex items-center gap-4 px-6 py-4">
                <Globe className="h-5 w-5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{w.url}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {w.events.join(", ")} · {w.active ? "Active" : "Inactive"}
                  </p>
                </div>
                <button type="button" onClick={() => handleDelete(w.id)}
                  className="cursor-pointer rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
