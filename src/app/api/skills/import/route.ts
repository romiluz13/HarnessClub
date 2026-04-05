/**
 * POST /api/skills/import — Import asset(s) from GitHub.
 *
 * Body: { repoUrl: string, teamId: string, ref?: string, batch?: boolean, filePath?: string }
 * - batch=false (default): Import first matching file
 * - batch=true: Scan repo for ALL config files, import each
 * - filePath: Import a specific file path
 *
 * Auth required. User must have skill:create permission.
 * Per api-security-best-practices: auth, RBAC check, input validation.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { importFromGitHub, batchImportFromGitHub } from "@/services/github-import";
import { hasPermission } from "@/lib/rbac";
import type { TeamRole } from "@/types/team";

function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.repoUrl || typeof body.repoUrl !== "string") {
    return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });
  }

  if (!body.teamId || !isValidObjectId(body.teamId)) {
    return NextResponse.json({ error: "Valid teamId is required" }, { status: 400 });
  }

  const repoUrl = body.repoUrl.trim().slice(0, 500);
  const teamId = new ObjectId(body.teamId);
  const userId = new ObjectId(session.user.id);
  const ref = typeof body.ref === "string" ? body.ref.trim() : "main";

  const db = await getDb();

  // Verify user has skill:create permission in team
  const user = await db.collection("users").findOne(
    {
      _id: userId,
      "teamMemberships.teamId": teamId,
    },
    { projection: { teamMemberships: 1 } }
  );

  if (!user) {
    return NextResponse.json({ error: "Not a team member" }, { status: 403 });
  }

  const membership = user.teamMemberships.find(
    (m: { teamId: ObjectId; role: string }) => m.teamId.equals(teamId)
  );
  const role = (membership?.role || "viewer") as TeamRole;

  if (!hasPermission(role, "skill:create")) {
    return NextResponse.json(
      { error: "Insufficient permissions to import assets" },
      { status: 403 }
    );
  }

  const isBatch = body.batch === true;
  const filePath = typeof body.filePath === "string" ? body.filePath.trim() : undefined;

  // Check for duplicate (same repo → same team) — skip for batch
  if (!isBatch) {
    const existing = await db.collection("assets").findOne({
      teamId,
      "source.repoUrl": { $regex: new RegExp(repoUrl.replace(/^https?:\/\//, ""), "i") },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This repository has already been imported to this team" },
        { status: 409 }
      );
    }
  }

  if (isBatch) {
    // Batch mode — scan for ALL config files
    const results = await batchImportFromGitHub(db, { repoUrl, ref, teamId, importedBy: userId });
    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    return NextResponse.json(
      {
        imported: succeeded.map((r) => ({
          assetId: r.assetId.toHexString(),
          name: r.name,
          type: r.type,
          format: r.format,
        })),
        failed: failed.map((r) => ({ error: r.error })),
        message: `Imported ${succeeded.length} asset(s), ${failed.length} failed`,
      },
      { status: succeeded.length > 0 ? 201 : 422 }
    );
  }

  // Single import
  const result = await importFromGitHub(db, { repoUrl, ref, teamId, importedBy: userId, filePath });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json(
    {
      assetId: result.assetId.toHexString(),
      skillId: result.assetId.toHexString(),
      name: result.name,
      type: result.type,
      format: result.format,
      message: "Asset imported successfully",
    },
    { status: 201 }
  );
}
