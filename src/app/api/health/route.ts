/**
 * GET /api/health — lightweight readiness probe for app + MongoDB.
 *
 * Used by Docker health checks and deployment smoke tests.
 */

import { NextResponse } from "next/server";
import { getDb, isMongoConfigured } from "@/lib/db";

export async function GET() {
  const timestamp = new Date().toISOString();

  if (!isMongoConfigured()) {
    return NextResponse.json(
      {
        status: "degraded",
        checks: {
          app: "ok",
          mongo: "missing_config",
        },
        timestamp,
      },
      { status: 503 }
    );
  }

  try {
    const db = await getDb();
    await db.command({ ping: 1 });

    return NextResponse.json({
      status: "ok",
      checks: {
        app: "ok",
        mongo: "ok",
      },
      timestamp,
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        checks: {
          app: "ok",
          mongo: "error",
        },
        timestamp,
      },
      { status: 503 }
    );
  }
}
