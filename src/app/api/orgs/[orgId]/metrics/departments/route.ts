/**
 * GET /api/orgs/[orgId]/metrics/departments — Department comparison metrics.
 * Per api-security-best-practices: auth + org membership required.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/api-helpers";
import { compareDepartments } from "@/services/metrics-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;

  const { orgId: orgIdStr } = await params;
  if (!ObjectId.isValid(orgIdStr)) {
    return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
  }

  const db = await getDb();
  const orgId = new ObjectId(orgIdStr);

  const departments = await compareDepartments(db, orgId);

  return NextResponse.json({ departments });
}
