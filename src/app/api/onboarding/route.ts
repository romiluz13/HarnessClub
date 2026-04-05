/**
 * POST /api/onboarding — Process the 5-step onboarding wizard.
 *
 * Accepts: OnboardingAnswers (orgName, deptType, teamName, tooling, scale, workflow)
 * Returns: { success, orgId, deptId, teamId, seededAssetCount }
 *
 * Requires authenticated session.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  processOnboarding,
  validateOnboardingAnswers,
  type OnboardingAnswers,
} from "@/services/onboarding-service";
import { ObjectId } from "mongodb";

export async function POST(request: NextRequest) {
  // ── Auth check ──────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  // ── Parse body ──────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // ── Validate inputs ─────────────────────────────────────
  const validation = validateOnboardingAnswers(body);
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, error: validation.error },
      { status: 400 }
    );
  }

  const answers = body as OnboardingAnswers;

  // ── Build owner ref from session ────────────────────────
  const owner = {
    userId: new ObjectId(session.user.id),
    name: session.user.name ?? "Unknown",
    email: session.user.email ?? "",
  };

  // ── Process onboarding ──────────────────────────────────
  const db = await getDb();
  const result = await processOnboarding(db, answers, owner);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 422 }
    );
  }

  return NextResponse.json({
    success: true,
    orgId: result.orgId!.toHexString(),
    deptId: result.deptId?.toHexString(),
    teamId: result.teamId!.toHexString(),
    seededAssetCount: result.seededAssetCount,
  });
}
