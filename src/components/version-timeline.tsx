"use client";

/**
 * VersionTimeline — Displays asset version history with rollback controls.
 *
 * Per frontend-patterns: accessible, keyboard nav, loading/empty states.
 * Per vercel-composition-patterns: composable with DiffViewer.
 */

import { useState, useCallback } from "react";
import { History, RotateCcw, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { AssetVersion } from "@/services/version-service";
import { DiffViewer } from "./diff-viewer";

interface VersionTimelineProps {
  assetId: string;
  versions: AssetVersion[];
  currentVersionNumber: number;
  onRollback?: (versionNumber: number) => Promise<void>;
  className?: string;
}

export function VersionTimeline({
  assetId,
  versions,
  currentVersionNumber,
  onRollback,
  className = "",
}: VersionTimelineProps) {
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [rollbackConfirm, setRollbackConfirm] = useState<number | null>(null);

  const handleRollback = useCallback(async (versionNumber: number) => {
    if (!onRollback) return;
    setRolling(true);
    try {
      await onRollback(versionNumber);
      setRollbackConfirm(null);
    } finally {
      setRolling(false);
    }
  }, [onRollback]);

  if (versions.length === 0) {
    return (
      <div className={`rounded-lg border border-gray-200 p-6 text-center dark:border-gray-700 ${className}`}>
        <History className="mx-auto mb-2 h-8 w-8 text-gray-400" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No version history yet</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">Versions are created when you edit content</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <History className="h-4 w-4" />
        Version History ({versions.length} versions)
      </div>

      <div className="space-y-1">
        {versions.map((version) => {
          const isExpanded = expandedVersion === version.versionNumber;
          const isCurrent = version.versionNumber === currentVersionNumber;
          const showRollbackConfirm = rollbackConfirm === version.versionNumber;

          return (
            <div key={version.versionNumber} className="rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setExpandedVersion(isExpanded ? null : version.versionNumber)}
                className="flex w-full cursor-pointer items-center justify-between p-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    isCurrent ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                  }`}>
                    v{version.versionNumber}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {version.changeReason ?? `Version ${version.versionNumber}`}
                  </span>
                  {isCurrent && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      current
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{new Date(version.createdAt).toLocaleDateString()}</span>
                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-200 p-3 dark:border-gray-700">
                  {version.diff && <DiffViewer diff={version.diff} fromLabel={`v${version.versionNumber - 1}`} toLabel={`v${version.versionNumber}`} />}

                  {!isCurrent && onRollback && (
                    <div className="mt-3 flex items-center gap-2">
                      {showRollbackConfirm ? (
                        <>
                          <span className="text-xs text-amber-600 dark:text-amber-400">Restore this version?</span>
                          <button type="button" onClick={() => handleRollback(version.versionNumber)} disabled={rolling}
                            className="cursor-pointer rounded bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-700 disabled:opacity-50">
                            {rolling ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                          </button>
                          <button type="button" onClick={() => setRollbackConfirm(null)}
                            className="cursor-pointer rounded px-3 py-1 text-xs text-gray-500 hover:text-gray-700">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setRollbackConfirm(version.versionNumber)}
                          className="flex cursor-pointer items-center gap-1 rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                          <RotateCcw className="h-3 w-3" /> Rollback to this version
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
