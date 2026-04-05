/**
 * Skill detail page — server component wrapper.
 * SkillDetail client component handles data fetching + editing.
 */

import { SkillDetail } from "@/components/skill-detail";

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <SkillDetail skillId={id} />
    </div>
  );
}
