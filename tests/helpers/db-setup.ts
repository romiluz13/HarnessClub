/**
 * Real MongoDB test helper.
 *
 * Connects to real Atlas cluster using skillshub_test database.
 * Provides seed data factories and cleanup utilities.
 * ZERO mocks — all operations hit real MongoDB.
 */

import { MongoClient, ObjectId, type Db } from "mongodb";

const TEST_DB_NAME = process.env.MONGODB_DB_NAME || "skillshub_test";

let client: MongoClient | null = null;
let db: Db | null = null;

/** Connect to real MongoDB test database */
export async function getTestDb(): Promise<Db> {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI not set. Create .env.test with your MongoDB connection string."
    );
  }

  client = new MongoClient(uri, {
    maxPoolSize: 3,
    minPoolSize: 0,
    maxIdleTimeMS: 10000,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
  });

  await client.connect();
  db = client.db(TEST_DB_NAME);
  return db;
}

/** Close the test database connection */
export async function closeTestDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

/** Delete all test data but preserve search fixtures (Atlas Search needs persistent docs) */
export async function cleanTestDb(): Promise<void> {
  const testDb = await getTestDb();
  const collections = await testDb.listCollections().toArray();
  await Promise.all(
    collections.map((c) =>
      testDb.collection(c.name).deleteMany({ _searchFixture: { $ne: true } })
    )
  );
}

// ─── Seed Data Factories ────────────────────────────────────────

export function createTestUser(overrides: Record<string, unknown> = {}) {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    _id: new ObjectId(),
    email: `test-${uniqueId}@example.com`,
    name: "Test User",
    image: "https://avatars.githubusercontent.com/u/1",
    githubId: `gh-${uniqueId}`,
    auth: {
      provider: "github",
      providerId: `gh-${uniqueId}`,
    },
    teamMemberships: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createTestTeam(
  ownerId: ObjectId,
  overrides: Record<string, unknown> = {}
) {
  const slug = `test-team-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    _id: new ObjectId(),
    name: `Test Team ${slug}`,
    slug,
    owner: {
      userId: ownerId,
      name: "Test User",
      email: "test@example.com",
    },
    memberIds: [ownerId],
    settings: {
      marketplaceEnabled: false,
      defaultRole: "member" as const,
      autoPublish: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createTestSkill(
  teamId: ObjectId,
  createdBy: ObjectId,
  overrides: Record<string, unknown> = {}
) {
  const name = `test-skill-${Date.now()}`;
  const description = "A test skill for integration testing";
  const content = "# Test Skill\n\nThis is test content.";
  const tags = ["test", "integration"];
  return {
    _id: new ObjectId(),
    type: "skill" as const,
    teamId,
    metadata: { name, description, author: "test-author", version: "1.0.0" },
    content,
    tags,
    searchText: `Name: ${name}\n\nDescription: ${description}\n\nTags: ${tags.join(", ")}\n\nContent:\n${content}`,
    source: {
      repoUrl: "https://github.com/test-org/test-repo",
      path: "SKILL.md",
      commitHash: "abc123",
      lastSyncedAt: new Date(),
    },
    stats: { installCount: 0, viewCount: 0 },
    isPublished: false,
    embedding: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy,
    ...overrides,
  };
}

/** Seed a complete user + team + membership graph */
export async function seedUserWithTeam(testDb: Db) {
  const userId = new ObjectId();
  const teamId = new ObjectId();
  const slug = `seed-team-${Date.now()}`;

  const team = createTestTeam(userId, { _id: teamId, slug, name: `Seed Team ${slug}` });
  const user = createTestUser({
    _id: userId,
    email: `seed-${Date.now()}@test.com`,
    teamMemberships: [{ teamId, role: "owner", joinedAt: new Date() }],
  });

  await Promise.all([
    testDb.collection("users").insertOne(user),
    testDb.collection("teams").insertOne(team),
  ]);

  return { user, team, userId, teamId };
}

/** Seed an asset (skill) belonging to a team */
export async function seedSkill(
  testDb: Db,
  teamId: ObjectId,
  createdBy: ObjectId,
  overrides: Record<string, unknown> = {}
) {
  const skill = createTestSkill(teamId, createdBy, overrides);
  await testDb.collection("assets").insertOne(skill);
  return skill;
}

/** Alias for seedSkill — seeds an asset document */
export const seedAsset = seedSkill;
