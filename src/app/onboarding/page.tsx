/**
 * Onboarding page — 3-step wizard to create org + department + team.
 * Server component wrapper checks auth, client component handles the form.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";
import type { UserDocument } from "@/types/user";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }

  // If user already has an org, skip onboarding
  const db = await getDb();
  const userId = session.user.id;
  if (userId) {
    const user = await db.collection<UserDocument>("users").findOne({
      _id: new ObjectId(userId),
    });
    if (user?.orgMemberships && user.orgMemberships.length > 0) {
      redirect("/dashboard");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome to AgentConfig
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Set up your organization in 3 steps
          </p>
        </div>
        <OnboardingWizard />
      </div>
    </div>
  );
}
