/**
 * Marketplace JSON format tests — real MongoDB, seeded data.
 * Verifies the Claude Code marketplace.json output format.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import {
  getTestDb,
  closeTestDb,
  cleanTestDb,
  seedUserWithTeam,
  seedSkill,
} from "../helpers/db-setup";

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

describe("Marketplace Data", () => {
  it("creates team with published skills for marketplace", async () => {
    const { teamId, userId, team } = await seedUserWithTeam(db);

    // Seed published skills
    const skill1 = await seedSkill(db, teamId, userId, {
      metadata: { name: "TypeScript Utils", description: "TS utility functions", version: "1.0.0" },
      isPublished: true,
      tags: ["typescript", "utils"],
    });

    const skill2 = await seedSkill(db, teamId, userId, {
      metadata: { name: "React Patterns", description: "React component patterns", version: "2.0.0" },
      isPublished: true,
      tags: ["react", "patterns"],
    });

    // Seed unpublished skill (should not appear in marketplace)
    await seedSkill(db, teamId, userId, {
      metadata: { name: "Draft Skill", description: "Not published yet" },
      isPublished: false,
    });

    // Query published skills like the marketplace endpoint does
    const publishedSkills = await db
      .collection("assets")
      .find({ teamId, isPublished: true })
      .sort({ "metadata.name": 1 })
      .toArray();

    expect(publishedSkills).toHaveLength(2);
    expect(publishedSkills[0].metadata.name).toBe("React Patterns");
    expect(publishedSkills[1].metadata.name).toBe("TypeScript Utils");

    // Verify the format matches Claude Code marketplace.json structure
    const marketplace = {
      name: team.slug,
      metadata: {
        description: `${team.name} skill registry on SkillsHub`,
        version: "1.0.0",
      },
      plugins: publishedSkills.map((s) => ({
        name: s.metadata.name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        description: s.metadata.description,
        source: {
          source: "github" as const,
          repo: s.source?.repoUrl
            ? s.source.repoUrl.replace("https://github.com/", "")
            : undefined,
        },
      })),
    };

    expect(marketplace.name).toBe(team.slug);
    expect(marketplace.plugins).toHaveLength(2);
    expect(marketplace.plugins[0].name).toBe("react-patterns");
    expect(marketplace.plugins[1].name).toBe("typescript-utils");
  });

  it("returns empty plugins for team with no published skills", async () => {
    const { teamId, userId } = await seedUserWithTeam(db);

    // Only draft skills
    await seedSkill(db, teamId, userId, { isPublished: false });

    const publishedSkills = await db
      .collection("assets")
      .find({ teamId, isPublished: true })
      .toArray();

    expect(publishedSkills).toHaveLength(0);
  });

  it("verifies team lookup by slug works", async () => {
    const { team } = await seedUserWithTeam(db);

    const found = await db.collection("teams").findOne({ slug: team.slug });
    expect(found).toBeTruthy();
    expect(found!.name).toBe(team.name);
  });
});
