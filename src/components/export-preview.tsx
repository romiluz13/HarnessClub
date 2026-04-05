"use client";

/**
 * ExportPreview — shows how an asset renders in different tools.
 * Tabs for Cursor, VSCode, Claude Code export formats.
 *
 * Per frontend-patterns: accessible tab control, all states.
 */

import { useState } from "react";
import useSWR from "swr";
import { Download, Loader2, Monitor, Code, Terminal } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ExportTarget = "cursor" | "vscode" | "claude";

const TABS: { value: ExportTarget; label: string; icon: typeof Monitor }[] = [
  { value: "cursor", label: "Cursor", icon: Monitor },
  { value: "vscode", label: "VS Code", icon: Code },
  { value: "claude", label: "Claude Code", icon: Terminal },
];

interface ExportPreviewProps {
  assetId: string;
  className?: string;
}

export function ExportPreview({ assetId, className = "" }: ExportPreviewProps) {
  const [tab, setTab] = useState<ExportTarget>("cursor");
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error } = useSWR(
    expanded ? `/api/assets/${assetId}/export?target=${tab}&preview=true` : null,
    fetcher
  );

  return (
    <div className={`rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left"
      >
        <Download className="h-4 w-4 text-purple-600" />
        <span className="text-sm font-semibold text-gray-900 dark:text-white">Export Preview</span>
      </button>

      {expanded && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 border-t border-gray-100 px-4 py-2 dark:border-gray-800">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTab(t.value)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    tab === t.value
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                      : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Preview content */}
          <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <p className="text-center text-sm text-red-500">Failed to load export preview</p>
            ) : data?.content ? (
              <>
                <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                  <span>Filename: {data.filename ?? "export"}</span>
                  <span>•</span>
                  <span>{data.content.length} chars</span>
                </div>
                <pre className="max-h-[300px] overflow-auto rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                  <code>{data.content}</code>
                </pre>
              </>
            ) : (
              <p className="text-center text-sm text-gray-400">No preview available</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
