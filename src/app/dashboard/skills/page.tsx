/**
 * Legacy skills listing route.
 * Redirects to the canonical assets registry page.
 */

import { redirect } from "next/navigation";

export default function SkillsPage() {
  redirect("/dashboard/assets");
}
