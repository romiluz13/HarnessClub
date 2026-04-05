"use client";

/**
 * Skills page header with import button.
 * Client component to manage import modal state.
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import { ImportSkillModal } from "@/components/import-skill-modal";

export function SkillsPageHeader() {
  const [showImport, setShowImport] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Skills</h2>
          <p className="mt-1 text-sm text-gray-500">
            Browse and manage your team&apos;s skill registries.
          </p>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors min-h-[44px]"
        >
          <Plus className="h-4 w-4" />
          Import Skill
        </button>
      </div>

      {showImport && <ImportSkillModal onClose={() => setShowImport(false)} />}
    </>
  );
}
