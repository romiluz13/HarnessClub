"use client";

/**
 * AssetPreview — Live preview of asset content with type-aware rendering.
 *
 * Per frontend-patterns: accessible, collapsible sections, dark mode.
 * Per tailwind-design-system: design tokens.
 */

import { useState } from "react";
import { Eye, ChevronDown, ChevronRight, AlertTriangle, FileText, Code } from "lucide-react";
import { renderAssetPreview } from "@/services/asset-renderer";
import type { AssetType } from "@/types/asset";
import type { RenderSection } from "@/services/asset-renderer";

interface AssetPreviewProps {
  content: string;
  type: AssetType;
  name: string;
  className?: string;
}

export function AssetPreview({ content, type, name, className = "" }: AssetPreviewProps) {
  const result = renderAssetPreview(content, type, name);

  return (
    <div className={`rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <Eye className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Live Preview</h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          {result.format}
        </span>
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="border-b border-gray-100 bg-amber-50 px-4 py-2 dark:border-gray-800 dark:bg-amber-950/20">
          {result.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3 flex-shrink-0" /> {w}
            </div>
          ))}
        </div>
      )}

      {/* Sections */}
      <div className="divide-y divide-gray-50 dark:divide-gray-800">
        {result.sections.map((section, i) => (
          <PreviewSection key={i} section={section} defaultOpen={!section.collapsible} />
        ))}
      </div>
    </div>
  );
}

function PreviewSection({ section, defaultOpen = true }: { section: RenderSection; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = section.collapsible
    ? (open ? ChevronDown : ChevronRight)
    : (section.language === "json" ? Code : FileText);

  return (
    <div>
      <button
        type="button"
        onClick={() => section.collapsible && setOpen(!open)}
        className={`flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 ${
          section.collapsible ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" : ""
        }`}
      >
        <Icon className="h-3 w-3" />
        {section.label}
      </button>
      {open && (
        <div className="px-4 pb-3">
          <pre className={`overflow-x-auto rounded-lg p-3 text-xs leading-relaxed ${
            section.language === "json" || section.language === "yaml"
              ? "bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
              : "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          }`}>
            <code>{section.content}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
