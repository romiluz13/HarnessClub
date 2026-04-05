"use client";

/**
 * DiffViewer — Side-by-side diff viewer for asset versions.
 *
 * Per frontend-patterns: accessible, keyboard navigable, responsive.
 * Per tailwind-design-system: design tokens, dark mode support.
 */

import { useMemo } from "react";
import type { VersionDiff, DiffLine } from "@/services/version-service";

interface DiffViewerProps {
  diff: VersionDiff;
  fromLabel?: string;
  toLabel?: string;
  className?: string;
}

export function DiffViewer({ diff, fromLabel = "Before", toLabel = "After", className = "" }: DiffViewerProps) {
  const { leftLines, rightLines } = useMemo(() => buildSideBySide(diff.lines), [diff.lines]);

  return (
    <div className={`overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Stats bar */}
      <div className="flex items-center gap-4 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs dark:border-gray-700 dark:bg-gray-800">
        <span className="text-green-600 dark:text-green-400">+{diff.linesAdded} added</span>
        <span className="text-red-600 dark:text-red-400">−{diff.linesRemoved} removed</span>
        <span className="text-gray-500 dark:text-gray-400">{diff.linesUnchanged} unchanged</span>
      </div>

      {/* Side-by-side panels */}
      <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700">
        {/* Left panel (old) */}
        <div>
          <div className="border-b border-gray-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 dark:border-gray-700 dark:bg-red-950 dark:text-red-300">
            {fromLabel}
          </div>
          <div className="overflow-x-auto">
            <pre className="text-xs leading-5">
              {leftLines.map((line, i) => (
                <DiffLineRow key={i} line={line} side="left" />
              ))}
            </pre>
          </div>
        </div>

        {/* Right panel (new) */}
        <div>
          <div className="border-b border-gray-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 dark:border-gray-700 dark:bg-green-950 dark:text-green-300">
            {toLabel}
          </div>
          <div className="overflow-x-auto">
            <pre className="text-xs leading-5">
              {rightLines.map((line, i) => (
                <DiffLineRow key={i} line={line} side="right" />
              ))}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Internal helpers ───────────────────────────────────────

interface SideLine {
  type: "add" | "remove" | "unchanged" | "empty";
  content: string;
  lineNumber?: number;
}

function DiffLineRow({ line, side }: { line: SideLine; side: "left" | "right" }) {
  if (line.type === "empty") {
    return <div className="h-5 bg-gray-100 dark:bg-gray-800" aria-hidden />;
  }

  const bgClass =
    line.type === "add" ? "bg-green-50 dark:bg-green-950/30"
    : line.type === "remove" ? "bg-red-50 dark:bg-red-950/30"
    : "";

  const textClass =
    line.type === "add" ? "text-green-800 dark:text-green-300"
    : line.type === "remove" ? "text-red-800 dark:text-red-300"
    : "text-gray-700 dark:text-gray-300";

  return (
    <div className={`flex ${bgClass}`} role="row" aria-label={`${line.type} line`}>
      <span className="w-10 flex-shrink-0 select-none px-2 text-right text-gray-400 dark:text-gray-500" aria-hidden>
        {line.lineNumber ?? ""}
      </span>
      <span className={`flex-1 whitespace-pre-wrap break-all px-2 ${textClass}`}>
        {line.type === "add" && <span className="mr-1 text-green-600">+</span>}
        {line.type === "remove" && <span className="mr-1 text-red-600">−</span>}
        {line.content}
      </span>
    </div>
  );
}

/**
 * Build side-by-side line arrays from a flat diff.
 * Adds empty placeholder lines so both sides stay aligned.
 */
function buildSideBySide(lines: DiffLine[]): { leftLines: SideLine[]; rightLines: SideLine[] } {
  const leftLines: SideLine[] = [];
  const rightLines: SideLine[] = [];

  for (const line of lines) {
    if (line.type === "unchanged") {
      leftLines.push({ type: "unchanged", content: line.content, lineNumber: line.lineNumber });
      rightLines.push({ type: "unchanged", content: line.content, lineNumber: line.lineNumber });
    } else if (line.type === "remove") {
      leftLines.push({ type: "remove", content: line.content, lineNumber: line.lineNumber });
      rightLines.push({ type: "empty", content: "" });
    } else {
      leftLines.push({ type: "empty", content: "" });
      rightLines.push({ type: "add", content: line.content, lineNumber: line.lineNumber });
    }
  }

  return { leftLines, rightLines };
}
