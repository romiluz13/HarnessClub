/**
 * Team Management Service.
 *
 * Business logic for team CRUD, membership, and invites.
 * All functions require pre-authenticated user context.
 *
 * Per async-parallel: parallelize independent DB operations.
 * Per server-serialization: minimize data returned to client.
 */

import { ObjectId, type Db } from "mongodb";
import type { TeamDocument, CreateTeamInput, TeamSettings, TeamRole } from "@/types/team";
import type { TeamMembership, UserDocument } from "@/types/user";

/** Default settings for new teams */
const DEFAULT_SETTINGS: TeamSettings = {
  marketplaceEnabled: false,
  defaultRole: "member",
  autoPublish: false,
};

/**
 * Create a new team. The creator becomes the owner.
 */
export async function createTeam(
  db: Db,
  input: CreateTeamInput
): Promise<TeamDocument> {
  const now = new Date();
  const teamId = new ObjectId();

  const team: TeamDocument = {
    _id: teamId,
    name: input.name,
    slug: input.slug,
    owner: input.owner,
    memberIds: [input.owner.userId],
    settings: DEFAULT_SETTINGS,
    createdAt: now,
    updatedAt: now,
  };

  // Parallel: insert team + add membership to user
  const membership: TeamMembership = {
    teamId,
    role: "owner",
    joinedAt: now,
  };

  await Promise.all([
    db.collection<TeamDocument>("teams").insertOne(team),
    db.collection<UserDocument>("users").updateOne(
      { _id: input.owner.userId },
      { $push: { teamMemberships: membership } }
    ),
  ]);

  return team;
}

/**
 * Add a member to a team.
 */
export async function addTeamMember(
  db: Db,
  teamId: ObjectId,
  userId: ObjectId,
  role: TeamRole
): Promise<void> {
  const now = new Date();
  const membership: TeamMembership = { teamId, role, joinedAt: now };

  await Promise.all([
    db.collection<TeamDocument>("teams").updateOne(
      { _id: teamId },
      { $addToSet: { memberIds: userId }, $set: { updatedAt: now } }
    ),
    db.collection<UserDocument>("users").updateOne(
      { _id: userId },
      { $push: { teamMemberships: membership } }
    ),
  ]);
}

/**
 * Remove a member from a team.
 */
export async function removeTeamMember(
  db: Db,
  teamId: ObjectId,
  userId: ObjectId
): Promise<void> {
  const now = new Date();

  await Promise.all([
    db.collection<TeamDocument>("teams").updateOne(
      { _id: teamId },
      { $pull: { memberIds: userId }, $set: { updatedAt: now } }
    ),
    db.collection<UserDocument>("users").updateOne(
      { _id: userId },
      { $pull: { teamMemberships: { teamId } } }
    ),
  ]);
}

/**
 * Update a member's role.
 */
export async function updateMemberRole(
  db: Db,
  teamId: ObjectId,
  userId: ObjectId,
  newRole: TeamRole
): Promise<void> {
  await db.collection("users").updateOne(
    { _id: userId, "teamMemberships.teamId": teamId },
    { $set: { "teamMemberships.$.role": newRole } }
  );
}

/**
 * Get a team by slug. Returns null if not found.
 */
export async function getTeamBySlug(
  db: Db,
  slug: string
): Promise<TeamDocument | null> {
  return db.collection<TeamDocument>("teams").findOne({ slug });
}

/**
 * Get all teams for a user.
 */
export async function getUserTeams(
  db: Db,
  userId: ObjectId
): Promise<TeamDocument[]> {
  return db
    .collection<TeamDocument>("teams")
    .find({ memberIds: userId })
    .sort({ name: 1 })
    .toArray();
}

/**
 * Generate a URL-safe slug from a team name.
 * Checks uniqueness in the database.
 */
export async function generateUniqueSlug(
  db: Db,
  name: string
): Promise<string> {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  let slug = base;
  let counter = 0;

  while (await db.collection("teams").findOne({ slug })) {
    counter++;
    slug = `${base}-${counter}`;
  }

  return slug;
}
