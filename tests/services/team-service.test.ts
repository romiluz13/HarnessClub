/**
 * Team service integration tests — real MongoDB, seeded data.
 * Tests all CRUD operations against the skillshub_test database.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import {
  getTestDb,
  closeTestDb,
  cleanTestDb,
  createTestUser,
} from "../helpers/db-setup";
import {
  createTeam,
  addTeamMember,
  removeTeamMember,
  updateMemberRole,
  getTeamBySlug,
  getUserTeams,
  generateUniqueSlug,
} from "@/services/team-service";

let db: Db;

beforeAll(async () => {
  db = await getTestDb();
});

afterAll(async () => {
  await cleanTestDb();
  await closeTestDb();
});

beforeEach(async () => {
  await cleanTestDb();
});

describe("createTeam", () => {
  it("creates team and adds owner membership", async () => {
    const user = createTestUser();
    await db.collection("users").insertOne(user);

    const team = await createTeam(db, {
      name: "Engineering",
      slug: "engineering",
      owner: { userId: user._id, name: user.name, email: user.email },
    });

    expect(team.name).toBe("Engineering");
    expect(team.slug).toBe("engineering");
    expect(team.memberIds).toHaveLength(1);

    // Verify user got the membership
    const updatedUser = await db.collection("users").findOne({ _id: user._id });
    expect(updatedUser!.teamMemberships).toHaveLength(1);
    expect(updatedUser!.teamMemberships[0].role).toBe("owner");
  });
});

describe("addTeamMember / removeTeamMember", () => {
  it("adds a member to team and user", async () => {
    const owner = createTestUser({ email: "owner@test.com" });
    const member = createTestUser({ email: "member@test.com" });
    await Promise.all([
      db.collection("users").insertOne(owner),
      db.collection("users").insertOne(member),
    ]);

    const team = await createTeam(db, {
      name: "Team Add Test",
      slug: "team-add-test",
      owner: { userId: owner._id, name: owner.name, email: owner.email },
    });

    await addTeamMember(db, team._id, member._id, "member");

    const updatedTeam = await db.collection("teams").findOne({ _id: team._id });
    expect(updatedTeam!.memberIds).toHaveLength(2);

    const updatedMember = await db.collection("users").findOne({ _id: member._id });
    expect(updatedMember!.teamMemberships).toHaveLength(1);
    expect(updatedMember!.teamMemberships[0].role).toBe("member");
  });

  it("removes a member from team and user", async () => {
    const owner = createTestUser({ email: "owner2@test.com" });
    const member = createTestUser({ email: "member2@test.com" });
    await Promise.all([
      db.collection("users").insertOne(owner),
      db.collection("users").insertOne(member),
    ]);

    const team = await createTeam(db, {
      name: "Team Remove Test",
      slug: "team-remove-test",
      owner: { userId: owner._id, name: owner.name, email: owner.email },
    });

    await addTeamMember(db, team._id, member._id, "member");
    await removeTeamMember(db, team._id, member._id);

    const updatedTeam = await db.collection("teams").findOne({ _id: team._id });
    expect(updatedTeam!.memberIds).toHaveLength(1); // Only owner remains

    const updatedMember = await db.collection("users").findOne({ _id: member._id });
    expect(updatedMember!.teamMemberships).toHaveLength(0);
  });
});

describe("updateMemberRole", () => {
  it("updates a member role in their membership", async () => {
    const owner = createTestUser({ email: "owner3@test.com" });
    const member = createTestUser({ email: "member3@test.com" });
    await Promise.all([
      db.collection("users").insertOne(owner),
      db.collection("users").insertOne(member),
    ]);

    const team = await createTeam(db, {
      name: "Role Update Test",
      slug: "role-update-test",
      owner: { userId: owner._id, name: owner.name, email: owner.email },
    });

    await addTeamMember(db, team._id, member._id, "member");
    await updateMemberRole(db, team._id, member._id, "admin");

    const updatedMember = await db.collection("users").findOne({ _id: member._id });
    expect(updatedMember!.teamMemberships[0].role).toBe("admin");
  });
});

describe("getTeamBySlug", () => {
  it("returns team by slug", async () => {
    const owner = createTestUser();
    await db.collection("users").insertOne(owner);
    await createTeam(db, {
      name: "Slug Test",
      slug: "slug-test",
      owner: { userId: owner._id, name: owner.name, email: owner.email },
    });

    const found = await getTeamBySlug(db, "slug-test");
    expect(found).toBeTruthy();
    expect(found!.name).toBe("Slug Test");
  });

  it("returns null for nonexistent slug", async () => {
    const found = await getTeamBySlug(db, "nonexistent-slug-" + Date.now());
    expect(found).toBeNull();
  });
});

describe("getUserTeams", () => {
  it("returns all teams the user belongs to", async () => {
    const user = createTestUser({ email: "multi@test.com" });
    await db.collection("users").insertOne(user);

    await createTeam(db, {
      name: "Alpha Team",
      slug: "alpha-team",
      owner: { userId: user._id, name: user.name, email: user.email },
    });
    await createTeam(db, {
      name: "Beta Team",
      slug: "beta-team",
      owner: { userId: user._id, name: user.name, email: user.email },
    });

    const teams = await getUserTeams(db, user._id);
    expect(teams).toHaveLength(2);
    const names = teams.map((t) => t.name);
    expect(names).toContain("Alpha Team");
    expect(names).toContain("Beta Team");
  });

  it("returns empty array for user with no teams", async () => {
    const teams = await getUserTeams(db, new ObjectId());
    expect(teams).toHaveLength(0);
  });
});

describe("generateUniqueSlug", () => {
  it("generates a clean slug from name", async () => {
    const slug = await generateUniqueSlug(db, "My Cool Team!");
    expect(slug).toBe("my-cool-team");
  });

  it("appends counter for duplicate slugs", async () => {
    const user = createTestUser();
    await db.collection("users").insertOne(user);
    await createTeam(db, {
      name: "Unique Slug Test",
      slug: "unique-slug-test",
      owner: { userId: user._id, name: user.name, email: user.email },
    });

    const slug = await generateUniqueSlug(db, "Unique Slug Test");
    expect(slug).toBe("unique-slug-test-1");
  });
});
