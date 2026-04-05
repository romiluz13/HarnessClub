/**
 * Seed script — populates AgentConfig with starter data.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Creates:
 *   1. Default organization ("AgentConfig Demo")
 *   2. Default department ("Engineering")
 *   3. Default team ("Default Team")
 *   4. Admin user (configurable via env or defaults)
 *   5. 3 sample assets (skill, rule, agent)
 *
 * Safe to run multiple times — skips if data already exists.
 */

import { MongoClient, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/agentconfig";
const DB_NAME = process.env.MONGODB_DB_NAME || "agentconfig";

async function seed() {
  console.log(`🌱 Seeding AgentConfig database...`);
  console.log(`   URI: ${MONGODB_URI.replace(/\/\/.*@/, "//***@")}`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  // Check if already seeded
  const existingOrg = await db.collection("organizations").findOne({ slug: "agentconfig-demo" });
  if (existingOrg) {
    console.log("✅ Database already seeded. Skipping.");
    await client.close();
    return;
  }

  const now = new Date();
  const userId = new ObjectId();
  const orgId = new ObjectId();
  const deptId = new ObjectId();
  const teamId = new ObjectId();

  const owner = { userId, name: "Admin", email: "admin@agentconfig.dev" };

  // 1. Create user
  await db.collection("users").insertOne({
    _id: userId,
    email: "admin@agentconfig.dev",
    name: "Admin",
    auth: { provider: "github", providerId: "seed-admin" },
    teamMemberships: [{ teamId, role: "owner", joinedAt: now }],
    orgMemberships: [{ orgId, role: "org_owner", joinedAt: now }],
    createdAt: now,
    updatedAt: now,
  });
  console.log("   ✅ Admin user created");

  // 2. Create organization
  await db.collection("organizations").insertOne({
    _id: orgId,
    name: "AgentConfig Demo",
    slug: "agentconfig-demo",
    plan: "free",
    owner,
    settings: {
      marketplaceEnabled: true,
      crossDeptApprovalRequired: false,
      defaultDeptType: "engineering_fe",
      ssoEnabled: false,
    },
    createdAt: now,
    updatedAt: now,
  });
  console.log("   ✅ Organization created");

  // 3. Create department
  await db.collection("departments").insertOne({
    _id: deptId,
    orgId,
    name: "Engineering",
    type: "engineering_fe",
    description: "Frontend engineering team",
    defaultAssetIds: [],
    teamCount: 1,
    createdAt: now,
    updatedAt: now,
  });
  console.log("   ✅ Department created");

  // 4. Create team
  await db.collection("teams").insertOne({
    _id: teamId,
    name: "Default Team",
    slug: "default-team",
    owner,
    memberIds: [userId],
    settings: { marketplaceEnabled: true, defaultRole: "member", autoPublish: false },
    orgId,
    departmentId: deptId,
    createdAt: now,
    updatedAt: now,
  });
  console.log("   ✅ Team created");

  // 5. Sample assets
  const sampleAssets = [
    {
      _id: new ObjectId(),
      type: "skill",
      teamId,
      metadata: { name: "TypeScript Best Practices", description: "Comprehensive TypeScript coding standards and patterns for production applications.", version: "1.0.0" },
      content: "# TypeScript Best Practices\n\n## Strict Mode\nAlways enable `strict: true` in tsconfig.json.\n\n## No Any\nUse `unknown` instead of `any` for type-safe code.\n\n## Interfaces over Types\nPrefer interfaces for object shapes — they support declaration merging.",
      tags: ["typescript", "best-practices", "coding-standards"],
      searchText: "Name: TypeScript Best Practices\nDescription: Comprehensive TypeScript coding standards\nTags: typescript, best-practices",
      isPublished: false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      type: "rule",
      teamId,
      metadata: { name: "No Console Logs", description: "Enforce removal of console.log statements before committing.", version: "1.0.0" },
      content: "# Rule: No Console Logs\n\n## Pattern\nDetect `console.log`, `console.warn`, `console.error` in production code.\n\n## Action\nReplace with structured logger or remove entirely.",
      tags: ["linting", "code-quality"],
      searchText: "Name: No Console Logs\nDescription: Enforce removal of console.log\nTags: linting, code-quality",
      isPublished: false,
      ruleConfig: { enforcement: "error", scope: "all_files", pattern: "console\\.log" },
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      type: "agent",
      teamId,
      metadata: { name: "Code Review Agent", description: "AI agent that reviews pull requests for code quality, security, and best practices.", version: "1.0.0" },
      content: "# Code Review Agent\n\nThis agent reviews code changes and provides feedback on:\n- Security vulnerabilities\n- Performance issues\n- Best practice violations\n- Missing test coverage",
      tags: ["agent", "code-review", "security"],
      searchText: "Name: Code Review Agent\nDescription: AI agent that reviews pull requests\nTags: agent, code-review",
      isPublished: false,
      agentConfig: { model: "claude-sonnet-4-20250514", provider: "anthropic" },
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    },
  ];

  await db.collection("assets").insertMany(sampleAssets);
  console.log(`   ✅ ${sampleAssets.length} sample assets created`);

  await client.close();
  console.log("\n🎉 Seed complete! Start the app with: npm run dev");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
