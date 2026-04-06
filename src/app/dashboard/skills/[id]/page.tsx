/**
 * Legacy skills detail route.
 * Redirects to the canonical asset detail page.
 */

import { redirect } from "next/navigation";

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/assets/${id}`);
}
