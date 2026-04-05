"use client";

/**
 * API Token Management — create, view, revoke tokens.
 * All data from real API token service via /api/settings/tokens.
 */

import { useState, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { Key, Plus, Trash2, Loader2, Copy, Check, ArrowLeft } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface TokenItem {
  id: string;
  name: string;
  prefix: string;
  scope: string;
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
}

export default function TokensPage() {
  const { data, isLoading } = useSWR("/api/settings/tokens", fetcher);
  const tokens: TokenItem[] = data?.tokens ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [scope, setScope] = useState("read");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    const res = await fetch("/api/settings/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tokenName.trim(), scope }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewToken(data.rawToken);
      setTokenName("");
      mutate("/api/settings/tokens");
    }
    setCreating(false);
  }, [tokenName, scope]);

  const handleRevoke = useCallback(async (tokenId: string) => {
    if (!confirm("Revoke this token? This action cannot be undone.")) return;
    await fetch("/api/settings/tokens", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId, action: "revoke" }),
    });
    mutate("/api/settings/tokens");
  }, []);

  const copyToken = useCallback(async () => {
    if (newToken) {
      await navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [newToken]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">API Tokens</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage programmatic access tokens</p>
        </div>
        <button type="button" onClick={() => { setShowCreate(true); setNewToken(null); }}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> New Token
        </button>
      </div>

      {/* New token revealed */}
      {newToken && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-950">
          <p className="mb-2 text-sm font-medium text-green-800 dark:text-green-200">Token created — copy it now, you won&apos;t see it again:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:bg-gray-900 dark:text-white">{newToken}</code>
            <button type="button" onClick={copyToken}
              className="cursor-pointer rounded-lg bg-green-600 px-3 py-2 text-white hover:bg-green-700">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && !newToken && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-950">
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Create token</h3>
          <div className="flex gap-2">
            <input type="text" value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="Token name"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            <select value={scope} onChange={(e) => setScope(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
              <option value="read">Read</option><option value="write">Write</option><option value="admin">Admin</option>
            </select>
            <button type="button" onClick={handleCreate} disabled={creating || !tokenName.trim()}
              className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Token list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : tokens.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center dark:border-gray-700">
          <Key className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-gray-500 dark:text-gray-400">No tokens yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center gap-4 px-6 py-4">
                <Key className="h-5 w-5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">{t.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t.prefix}••• · {t.scope} · Created {new Date(t.createdAt).toLocaleDateString()}
                    {t.revoked && <span className="ml-2 text-red-500">Revoked</span>}
                  </p>
                </div>
                {!t.revoked && (
                  <button type="button" onClick={() => handleRevoke(t.id)}
                    className="cursor-pointer rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
