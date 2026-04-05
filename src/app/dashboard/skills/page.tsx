/**
 * Skills listing page with import capability.
 * Server component wrapper; client components handle data fetching.
 */

import { SkillsList } from "@/components/skills-list";
import { SkillsPageHeader } from "@/components/skills-page-header";

export default function SkillsPage() {
  return (
    <div className="space-y-6">
      <SkillsPageHeader />
      <SkillsList />
    </div>
  );
}
