/**
 * Dashboard layout — server component.
 * 1. Checks authentication → redirect to /auth/signin
 * 2. Checks org membership → redirect to /onboarding if no org
 * 3. Wraps content in DashboardShell
 */

import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard-shell";
import type { UserDocument } from "@/types/user";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Check if user has an org — if not, redirect to onboarding
  const userId = session.user.id;
  if (userId) {
    const db = await getDb();
    const user = await db.collection<UserDocument>("users").findOne({
      _id: new ObjectId(userId),
    });
    if (!user?.orgMemberships || user.orgMemberships.length === 0) {
      redirect("/onboarding");
    }
  }

  return <DashboardShell>{children}</DashboardShell>;
}
