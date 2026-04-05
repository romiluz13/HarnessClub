/**
 * Onboarding Service — Orchestrates the 5-question interactive wizard.
 *
 * Flow: org → dept → team → customize starter assets based on answers.
 * No mocks — every operation hits real MongoDB.
 *
 * Per mongodb-schema-design: uses existing org/dept/team/asset services.
 * Per api-security-best-practices: validates all inputs.
 */

import { ObjectId, type Db } from "mongodb";
import type { DepartmentType } from "@/types/organization";
import type { CachedUserRef } from "@/types/team";
import { createOrg } from "./org-service";
import { createDepartment } from "./org-service";
import { createTeam } from "./team-service";
import { createAsset } from "./asset-service";
import { getDepartmentTemplate } from "./department-templates";

// ─── Types ──────────────────────────────────────────────────

/** Tooling preferences from Step 3 */
export type AgentTooling = "claude-code" | "cursor" | "copilot" | "windsurf" | "codex" | "multiple" | "undecided";

/** Team scale from Step 4 */
export type TeamScale = "solo" | "small" | "medium" | "large";

/** Workflow preference from Step 4 */
export type WorkflowPreference = "move_fast" | "balanced" | "strict_review";

/** Full onboarding answers from the 5-step wizard */
export interface OnboardingAnswers {
  /** Step 1: Organization name */
  orgName: string;
  /** Step 2: Department type */
  deptType: DepartmentType;
  /** Step 3: Team name + primary agent tooling */
  teamName: string;
  tooling: AgentTooling;
  /** Step 4: Scale + workflow preference */
  scale: TeamScale;
  workflow: WorkflowPreference;
}

/** Result of processOnboarding */
export interface OnboardingResult {
  success: boolean;
  orgId?: ObjectId;
  deptId?: ObjectId;
  teamId?: ObjectId;
  seededAssetIds?: ObjectId[];
  seededAssetCount?: number;
  error?: string;
}

// ─── Customization Engine ───────────────────────────────────

/**
 * Customize template asset content based on wizard answers.
 * Injects tooling name, scale recommendations, and workflow hints.
 */
export function customizeContent(
  content: string,
  answers: Pick<OnboardingAnswers, "tooling" | "scale" | "workflow" | "teamName" | "orgName">
): string {
  const toolingName = getToolingDisplayName(answers.tooling);
  const scaleHint = getScaleHint(answers.scale);
  const workflowHint = getWorkflowHint(answers.workflow);

  let result = content;

  // Replace placeholders if present in template
  result = result.replace(/\{\{TOOLING\}\}/g, toolingName);
  result = result.replace(/\{\{TEAM_NAME\}\}/g, answers.teamName);
  result = result.replace(/\{\{ORG_NAME\}\}/g, answers.orgName);
  result = result.replace(/\{\{SCALE_HINT\}\}/g, scaleHint);
  result = result.replace(/\{\{WORKFLOW_HINT\}\}/g, workflowHint);

  // Append configuration section if not already present
  if (!result.includes("## Configuration")) {
    result += `\n\n## Configuration\n\n`;
    result += `- **Primary Agent**: ${toolingName}\n`;
    result += `- **Team Scale**: ${scaleHint}\n`;
    result += `- **Review Policy**: ${workflowHint}\n`;
  }

  return result;
}

function getToolingDisplayName(tooling: AgentTooling): string {
  const map: Record<AgentTooling, string> = {
    "claude-code": "Claude Code",
    "cursor": "Cursor",
    "copilot": "GitHub Copilot",
    "windsurf": "Windsurf",
    "codex": "OpenAI Codex",
    "multiple": "Multiple Agents",
    "undecided": "Agent TBD",
  };
  return map[tooling];
}

function getScaleHint(scale: TeamScale): string {
  const map: Record<TeamScale, string> = {
    solo: "Solo developer — lightweight approval, fast iteration",
    small: "Small team (2–5) — peer review recommended",
    medium: "Medium team (6–20) — structured approval workflows",
    large: "Large team (20+) — multi-reviewer approval, RBAC enforcement",
  };
  return map[scale];
}

function getWorkflowHint(workflow: WorkflowPreference): string {
  const map: Record<WorkflowPreference, string> = {
    move_fast: "Move fast — auto-approve, minimal review",
    balanced: "Balanced — single reviewer before publish",
    strict_review: "Strict review — multi-reviewer, all changes require approval",
  };
  return map[workflow];
}

// ─── Settings from Workflow Preference ──────────────────────

/**
 * Derive team settings from workflow preference.
 */
function deriveTeamSettings(workflow: WorkflowPreference) {
  switch (workflow) {
    case "move_fast":
      return { marketplaceEnabled: true, defaultRole: "member" as const, autoPublish: true };
    case "strict_review":
      return { marketplaceEnabled: false, defaultRole: "viewer" as const, autoPublish: false };
    case "balanced":
    default:
      return { marketplaceEnabled: true, defaultRole: "member" as const, autoPublish: false };
  }
}

// ─── Main Orchestrator ──────────────────────────────────────

/**
 * Process the full onboarding wizard submission.
 *
 * Creates: org → dept (auto-seeds template assets) → team → reassigns and customizes assets.
 * All operations hit real MongoDB.
 */
export async function processOnboarding(
  db: Db,
  answers: OnboardingAnswers,
  owner: CachedUserRef
): Promise<OnboardingResult> {
  // ── Validate inputs ──────────────────────────────────────
  if (!answers.orgName || answers.orgName.trim().length < 2) {
    return { success: false, error: "Organization name must be at least 2 characters" };
  }
  if (!answers.teamName || answers.teamName.trim().length < 2) {
    return { success: false, error: "Team name must be at least 2 characters" };
  }

  const orgName = answers.orgName.trim();
  const teamName = answers.teamName.trim();
  const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const teamSlug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // ── 1. Create Organization ───────────────────────────────
  const orgResult = await createOrg(db, {
    name: orgName,
    slug: orgSlug,
    owner,
    settings: { defaultDeptType: answers.deptType },
  });
  if (!orgResult.success || !orgResult.orgId) {
    return { success: false, error: orgResult.error ?? "Failed to create organization" };
  }

  // ── 2. Create Department (auto-seeds template assets) ────
  const deptDisplayName = answers.deptType === "custom"
    ? "General"
    : answers.deptType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const deptResult = await createDepartment(db, {
    orgId: orgResult.orgId,
    name: deptDisplayName,
    type: answers.deptType,
    description: `${deptDisplayName} department for ${orgName}`,
  }, owner.userId);

  // ── 3. Create Team ───────────────────────────────────────
  let team;
  try {
    team = await createTeam(db, {
      name: teamName,
      slug: teamSlug,
      owner,
    });
  } catch (err) {
    return { success: false, error: `Failed to create team: ${(err as Error).message}` };
  }

  // Link team to org and dept
  const linkUpdate: Record<string, unknown> = { orgId: orgResult.orgId };
  if (deptResult.success && deptResult.deptId) {
    linkUpdate.departmentId = deptResult.deptId;
  }
  await db.collection("teams").updateOne(
    { _id: team._id },
    { $set: linkUpdate }
  );

  // Apply workflow-derived settings
  const teamSettings = deriveTeamSettings(answers.workflow);
  await db.collection("teams").updateOne(
    { _id: team._id },
    { $set: { settings: teamSettings } }
  );

  // ── 4. Seed + customize starter assets after team exists ─
  const template = getDepartmentTemplate(answers.deptType);
  const seededAssetIds: ObjectId[] = [];

  if (template) {
    for (const tmpl of template.assets) {
      const customizedContent = customizeContent(tmpl.content, {
        tooling: answers.tooling,
        scale: answers.scale,
        workflow: answers.workflow,
        teamName,
        orgName,
      });

      const result = await createAsset(db, {
        type: tmpl.type,
        teamId: team._id,
        metadata: { name: tmpl.name, description: tmpl.description },
        content: customizedContent,
        tags: [...tmpl.tags, `tooling:${answers.tooling}`, `scale:${answers.scale}`],
        createdBy: owner.userId,
      });

      if (result.success) {
        seededAssetIds.push(result.assetId);
      }
    }

    if (deptResult.deptId && seededAssetIds.length > 0) {
      await db.collection("departments").updateOne(
        { _id: deptResult.deptId },
        { $set: { defaultAssetIds: seededAssetIds, updatedAt: new Date() } }
      );
    }
  }

  // ── 5. Update user org membership ─────────────────────────
  // Note: createTeam already adds teamMembership to user.
  // We only need to add orgMembership here.
  await db.collection("users").updateOne(
    { _id: owner.userId },
    {
      $addToSet: {
        orgMemberships: { orgId: orgResult.orgId, role: "org_owner", joinedAt: new Date() },
      },
    }
  );

  return {
    success: true,
    orgId: orgResult.orgId,
    deptId: deptResult.deptId,
    teamId: team._id,
    seededAssetIds,
    seededAssetCount: seededAssetIds.length,
  };
}

// ─── Validation Helper ──────────────────────────────────────

/**
 * Validate onboarding answers shape (used by API route).
 */
export function validateOnboardingAnswers(body: unknown): { valid: boolean; error?: string } {
  if (!body || typeof body !== "object") return { valid: false, error: "Invalid request body" };

  const b = body as Record<string, unknown>;

  if (!b.orgName || typeof b.orgName !== "string" || b.orgName.trim().length < 2) {
    return { valid: false, error: "orgName must be at least 2 characters" };
  }
  if (!b.teamName || typeof b.teamName !== "string" || b.teamName.trim().length < 2) {
    return { valid: false, error: "teamName must be at least 2 characters" };
  }

  const validDeptTypes = ["engineering_fe", "engineering_be", "devops", "sales", "product", "legal", "marketing", "support", "custom"];
  if (!b.deptType || !validDeptTypes.includes(b.deptType as string)) {
    return { valid: false, error: `deptType must be one of: ${validDeptTypes.join(", ")}` };
  }

  const validTooling = ["claude-code", "cursor", "copilot", "windsurf", "codex", "multiple", "undecided"];
  if (!b.tooling || !validTooling.includes(b.tooling as string)) {
    return { valid: false, error: `tooling must be one of: ${validTooling.join(", ")}` };
  }

  const validScale = ["solo", "small", "medium", "large"];
  if (!b.scale || !validScale.includes(b.scale as string)) {
    return { valid: false, error: `scale must be one of: ${validScale.join(", ")}` };
  }

  const validWorkflow = ["move_fast", "balanced", "strict_review"];
  if (!b.workflow || !validWorkflow.includes(b.workflow as string)) {
    return { valid: false, error: `workflow must be one of: ${validWorkflow.join(", ")}` };
  }

  return { valid: true };
}
