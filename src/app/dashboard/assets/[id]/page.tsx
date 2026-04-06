/**
 * Asset detail page — server component wrapper.
 * Reuses the existing detail client component while the asset registry model
 * is the canonical route surface.
 */

import { SkillDetail } from "@/components/skill-detail";

export default async function AssetDetailPage({
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
