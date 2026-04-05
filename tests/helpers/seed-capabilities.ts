/**
 * Seed realistic data for MongoDB capabilities testing.
 * Creates 3 teams, 6 users, 20+ skills with REAL Voyage AI embeddings.
 * All data is deterministic (uses fixed ObjectIds) for reproducible tests.
 */

import { ObjectId, type Db } from "mongodb";

// ─── Deterministic IDs ────────────────────────────────────────
export const TEAM_A_ID = new ObjectId("aa0000000000000000000001");
export const TEAM_B_ID = new ObjectId("bb0000000000000000000002");
export const TEAM_C_ID = new ObjectId("cc0000000000000000000003");

export const USER_OWNER_ID = new ObjectId("dd0000000000000000000001");
export const USER_ADMIN_ID = new ObjectId("dd0000000000000000000002");
export const USER_MEMBER_ID = new ObjectId("dd0000000000000000000003");
export const USER_VIEWER_ID = new ObjectId("dd0000000000000000000004");
export const USER_B_OWNER_ID = new ObjectId("dd0000000000000000000005");
export const USER_C_OWNER_ID = new ObjectId("dd0000000000000000000006");

// Skill IDs — deterministic for assertions (24-char hex only: 0-9, a-f)
export const SKILL_IDS = {
  reactHooks: new ObjectId("a10000000000000000000001"),
  typescriptGenerics: new ObjectId("a10000000000000000000002"),
  mongodbIndexing: new ObjectId("a10000000000000000000003"),
  nextjsRouting: new ObjectId("a10000000000000000000004"),
  tailwindCSS: new ObjectId("a10000000000000000000005"),
  dockerBasics: new ObjectId("a10000000000000000000006"),
  graphqlAPI: new ObjectId("a10000000000000000000007"),
  jestTesting: new ObjectId("a10000000000000000000008"),
  redisCache: new ObjectId("a10000000000000000000009"),
  k8sDeployment: new ObjectId("a1000000000000000000000a"),
  // Team B skills
  pythonFastAPI: new ObjectId("a1000000000000000000000b"),
  djangoModels: new ObjectId("a1000000000000000000000c"),
  celeryTasks: new ObjectId("a1000000000000000000000d"),
  // Team C skills
  rustOwnership: new ObjectId("a1000000000000000000000e"),
  goChannels: new ObjectId("a1000000000000000000000f"),
  // Dependency tree skills (for $graphLookup)
  webFundamentals: new ObjectId("a10000000000000000000010"),
  cssFundamentals: new ObjectId("a10000000000000000000011"),
  jsBasics: new ObjectId("a10000000000000000000012"),
};

/** Marker so global cleanup doesn't delete these */
export const CAP_TEST_MARKER = "_capTest";

// ─── Skill definitions ────────────────────────────────────────
export interface SkillSeed {
  _id: ObjectId;
  type: "skill";
  teamId: ObjectId;
  metadata: { name: string; description: string; author: string; version: string };
  content: string;
  tags: string[];
  /** Computed at insertion via mkSearchText */
  searchText?: string;
  stats: { installCount: number; viewCount: number };
  isPublished: boolean;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  /** Optional: parent skill for dependency tree ($graphLookup) */
  parentSkillId?: ObjectId;
}

/** Helper to build searchText for seed data */
function mkSearchText(name: string, desc: string, content: string, tags: string[]): string {
  return `Name: ${name}\n\nDescription: ${desc}\n\nTags: ${tags.join(", ")}\n\nContent:\n${content}`;
}

const now = new Date();
const day = (n: number) => new Date(now.getTime() - n * 86400000);

export const SKILLS_DATA: SkillSeed[] = [
  // Team A — 10 skills, various install/view counts and dates
  { _id: SKILL_IDS.reactHooks, type: "skill" as const, teamId: TEAM_A_ID, metadata: { name: "React Hooks Deep Dive", description: "Advanced patterns for useState, useEffect, useCallback, and custom hooks in React 19", author: "alice", version: "2.1.0" }, content: "# React Hooks\n\nCustom hooks extract reusable logic from components. Use useCallback to memoize.", tags: ["react", "hooks", "frontend"], stats: { installCount: 342, viewCount: 1205 }, isPublished: true, createdBy: USER_OWNER_ID, createdAt: day(30), updatedAt: day(2) },
  { _id: SKILL_IDS.typescriptGenerics, type: "skill" as const, teamId: TEAM_A_ID, metadata: { name: "TypeScript Generics Mastery", description: "Generic types, constraints, conditional types, and mapped types for type-safe code", author: "bob", version: "1.5.0" }, content: "# TypeScript Generics\n\nGenerics enable reusable type-safe abstractions.", tags: ["typescript", "generics", "types"], stats: { installCount: 189, viewCount: 876 }, isPublished: true, createdBy: USER_ADMIN_ID, createdAt: day(25), updatedAt: day(5) },
  { _id: SKILL_IDS.mongodbIndexing, type: "skill" as const, teamId: TEAM_A_ID, metadata: { name: "MongoDB Indexing Strategy", description: "ESR compound indexes, partial indexes, and explain() analysis for MongoDB queries", author: "alice", version: "3.0.0" }, content: "# MongoDB Indexing\n\nESR: Equality, Sort, Range. Always verify with explain().", tags: ["mongodb", "performance", "database"], stats: { installCount: 567, viewCount: 2341 }, isPublished: true, createdBy: USER_OWNER_ID, createdAt: day(60), updatedAt: day(1) },
  { _id: SKILL_IDS.nextjsRouting, type: "skill" as const, teamId: TEAM_A_ID, metadata: { name: "Next.js App Router Patterns", description: "Server Components, parallel routes, intercepting routes, and streaming in Next.js 15", author: "charlie", version: "1.0.0" }, content: "# Next.js App Router\n\nServer Components render on the server. Use suspense for streaming.", tags: ["nextjs", "react", "frontend", "routing"], stats: { installCount: 423, viewCount: 1567 }, isPublished: true, createdBy: USER_MEMBER_ID, createdAt: day(20), updatedAt: day(3) },
  { _id: SKILL_IDS.tailwindCSS, type: "skill" as const, teamId: TEAM_A_ID, metadata: { name: "Tailwind CSS Design System", description: "Design tokens, component patterns, and responsive utilities with Tailwind CSS v4", author: "alice", version: "1.2.0" }, content: "# Tailwind CSS\n\nUtility-first CSS framework. Use @apply for component abstractions.", tags: ["css", "tailwind", "frontend", "design"], stats: { installCount: 298, viewCount: 1034 }, isPublished: true, createdBy: USER_OWNER_ID, createdAt: day(15), updatedAt: day(7) },
  { _id: SKILL_IDS.dockerBasics, type: "skill" as const, teamId: TEAM_A_ID, metadata: { name: "Docker Container Basics", description: "Dockerfile best practices, multi-stage builds, and docker-compose for development", author: "bob", version: "2.0.0" }, content: "# Docker\n\nContainers package applications with their dependencies.", tags: ["docker", "devops", "containers"], stats: { installCount: 156, viewCount: 543 }, isPublished: true, createdBy: USER_ADMIN_ID, createdAt: day(45), updatedAt: day(10) },
  { _id: SKILL_IDS.graphqlAPI, type: "skill" as const, teamId: TEAM_A_ID, metadata: { name: "GraphQL API Design", description: "Schema design, resolvers, DataLoader batching, and subscriptions for GraphQL APIs", author: "charlie", version: "1.1.0" }, content: "# GraphQL\n\nQuery exactly the data you need. Use DataLoader to batch database queries.", tags: ["graphql", "api", "backend"], stats: { installCount: 87, viewCount: 312 }, isPublished: false, createdBy: USER_MEMBER_ID, createdAt: day(10), updatedAt: day(1) },
  { _id: SKILL_IDS.jestTesting, type: "skill" as const, teamId: TEAM_A_ID, metadata: { name: "Jest Testing Patterns", description: "Unit testing, mocking, snapshot testing, and code coverage with Jest and Vitest", author: "alice", version: "1.3.0" }, content: "# Jest Testing\n\nWrite tests first. Mock external dependencies. Aim for 80% coverage.", tags: ["testing", "jest", "frontend"], stats: { installCount: 234, viewCount: 890 }, isPublished: true, createdBy: USER_OWNER_ID, createdAt: day(35), updatedAt: day(4) },
  { _id: SKILL_IDS.redisCache, type: "skill" as const, teamId: TEAM_A_ID, metadata: { name: "Redis Caching Strategies", description: "Cache-aside, write-through, and TTL-based invalidation patterns with Redis", author: "bob", version: "1.0.0" }, content: "# Redis Caching\n\nCache-aside: check cache first, load from DB on miss, populate cache.", tags: ["redis", "caching", "backend", "performance"], stats: { installCount: 145, viewCount: 678 }, isPublished: true, createdBy: USER_ADMIN_ID, createdAt: day(50), updatedAt: day(8) },
  { _id: SKILL_IDS.k8sDeployment, type: "skill" as const, teamId: TEAM_A_ID, metadata: { name: "Kubernetes Deployment Guide", description: "Deployments, Services, Ingress, and HPA for production Kubernetes clusters", author: "charlie", version: "2.0.0" }, content: "# Kubernetes\n\nDeclarative infrastructure. Use Deployments for stateless apps.", tags: ["kubernetes", "devops", "infrastructure"], stats: { installCount: 78, viewCount: 234 }, isPublished: false, createdBy: USER_MEMBER_ID, createdAt: day(5), updatedAt: day(1) },
  // Team B — 3 skills (Python ecosystem)
  { _id: SKILL_IDS.pythonFastAPI, type: "skill" as const, teamId: TEAM_B_ID, metadata: { name: "FastAPI Best Practices", description: "Async endpoints, Pydantic models, dependency injection in FastAPI", author: "dave", version: "1.0.0" }, content: "# FastAPI\n\nModern Python web framework with automatic OpenAPI docs.", tags: ["python", "fastapi", "api"], stats: { installCount: 412, viewCount: 1890 }, isPublished: true, createdBy: USER_B_OWNER_ID, createdAt: day(40), updatedAt: day(2) },
  { _id: SKILL_IDS.djangoModels, type: "skill" as const, teamId: TEAM_B_ID, metadata: { name: "Django Model Patterns", description: "Model inheritance, managers, querysets, and migrations in Django ORM", author: "dave", version: "1.5.0" }, content: "# Django Models\n\nORM maps Python classes to database tables.", tags: ["python", "django", "database"], stats: { installCount: 267, viewCount: 1123 }, isPublished: true, createdBy: USER_B_OWNER_ID, createdAt: day(55), updatedAt: day(6) },
  { _id: SKILL_IDS.celeryTasks, type: "skill" as const, teamId: TEAM_B_ID, metadata: { name: "Celery Task Queues", description: "Distributed task processing with Celery, Redis broker, and result backends", author: "dave", version: "1.0.0" }, content: "# Celery\n\nAsync task queue for background processing.", tags: ["python", "celery", "async"], stats: { installCount: 98, viewCount: 445 }, isPublished: false, createdBy: USER_B_OWNER_ID, createdAt: day(12), updatedAt: day(3) },
  // Team C — 2 skills (Systems languages)
  { _id: SKILL_IDS.rustOwnership, type: "skill" as const, teamId: TEAM_C_ID, metadata: { name: "Rust Ownership Model", description: "Borrowing, lifetimes, and the borrow checker for memory-safe Rust code", author: "eve", version: "1.0.0" }, content: "# Rust Ownership\n\nEvery value has exactly one owner. Borrowing enables shared access.", tags: ["rust", "memory", "systems"], stats: { installCount: 178, viewCount: 723 }, isPublished: true, createdBy: USER_C_OWNER_ID, createdAt: day(22), updatedAt: day(4) },
  { _id: SKILL_IDS.goChannels, type: "skill" as const, teamId: TEAM_C_ID, metadata: { name: "Go Channels & Concurrency", description: "Goroutines, channels, select statements, and sync primitives in Go", author: "eve", version: "1.2.0" }, content: "# Go Concurrency\n\nDon't communicate by sharing memory; share memory by communicating.", tags: ["go", "concurrency", "backend"], stats: { installCount: 203, viewCount: 912 }, isPublished: true, createdBy: USER_C_OWNER_ID, createdAt: day(18), updatedAt: day(2) },
  // Dependency tree skills (for $graphLookup) — Team A
  { _id: SKILL_IDS.webFundamentals, type: "skill" as const, teamId: TEAM_A_ID, metadata: { name: "Web Fundamentals", description: "HTML, HTTP, and browser rendering pipeline", author: "alice", version: "1.0.0" }, content: "# Web Fundamentals\n\nHTML is the backbone of the web.", tags: ["web", "fundamentals"], stats: { installCount: 500, viewCount: 3000 }, isPublished: true, createdBy: USER_OWNER_ID, createdAt: day(90), updatedAt: day(30) },
  { _id: SKILL_IDS.cssFundamentals, type: "skill" as const, teamId: TEAM_A_ID, metadata: { name: "CSS Fundamentals", description: "Box model, flexbox, grid, and responsive design", author: "alice", version: "1.0.0" }, content: "# CSS Fundamentals\n\nCascading Style Sheets define visual presentation.", tags: ["css", "fundamentals", "frontend"], stats: { installCount: 450, viewCount: 2800 }, isPublished: true, createdBy: USER_OWNER_ID, createdAt: day(85), updatedAt: day(25), parentSkillId: SKILL_IDS.webFundamentals },
  { _id: SKILL_IDS.jsBasics, type: "skill" as const, teamId: TEAM_A_ID, metadata: { name: "JavaScript Basics", description: "Variables, functions, closures, and the event loop", author: "alice", version: "1.0.0" }, content: "# JavaScript Basics\n\nJavaScript is the language of the web.", tags: ["javascript", "fundamentals", "frontend"], stats: { installCount: 600, viewCount: 3500 }, isPublished: true, createdBy: USER_OWNER_ID, createdAt: day(80), updatedAt: day(20), parentSkillId: SKILL_IDS.webFundamentals },
];

// ─── Users ────────────────────────────────────────────────────
export function buildUsers() {
  const mkUser = (id: ObjectId, name: string, email: string, teams: Array<{ teamId: ObjectId; role: string }>) => ({
    _id: id, name, email, image: `https://avatars.example.com/${name}`, githubId: `gh-${name}`,
    auth: { provider: "github" as const, providerId: `gh-${name}` },
    teamMemberships: teams.map((t) => ({ ...t, joinedAt: now })),
    [CAP_TEST_MARKER]: true, createdAt: now, updatedAt: now,
  });
  return [
    mkUser(USER_OWNER_ID, "Alice Owner", "alice@test.com", [{ teamId: TEAM_A_ID, role: "owner" }]),
    mkUser(USER_ADMIN_ID, "Bob Admin", "bob@test.com", [{ teamId: TEAM_A_ID, role: "admin" }]),
    mkUser(USER_MEMBER_ID, "Charlie Member", "charlie@test.com", [{ teamId: TEAM_A_ID, role: "member" }]),
    mkUser(USER_VIEWER_ID, "Diana Viewer", "diana@test.com", [{ teamId: TEAM_A_ID, role: "viewer" }]),
    mkUser(USER_B_OWNER_ID, "Dave PythonDev", "dave@test.com", [{ teamId: TEAM_B_ID, role: "owner" }]),
    mkUser(USER_C_OWNER_ID, "Eve SystemsDev", "eve@test.com", [{ teamId: TEAM_C_ID, role: "owner" }]),
  ];
}

// ─── Teams ────────────────────────────────────────────────────
export function buildTeams() {
  const mkTeam = (id: ObjectId, name: string, slug: string, ownerId: ObjectId, memberIds: ObjectId[]) => ({
    _id: id, name, slug,
    owner: { userId: ownerId, name: "Owner", email: "owner@test.com" },
    memberIds,
    settings: { marketplaceEnabled: true, defaultRole: "member" as const, autoPublish: false },
    [CAP_TEST_MARKER]: true, createdAt: now, updatedAt: now,
  });
  return [
    mkTeam(TEAM_A_ID, "Frontend Masters", "cap-frontend-masters", USER_OWNER_ID, [USER_OWNER_ID, USER_ADMIN_ID, USER_MEMBER_ID, USER_VIEWER_ID]),
    mkTeam(TEAM_B_ID, "Python Guild", "cap-python-guild", USER_B_OWNER_ID, [USER_B_OWNER_ID]),
    mkTeam(TEAM_C_ID, "Systems Engineers", "cap-systems-eng", USER_C_OWNER_ID, [USER_C_OWNER_ID]),
  ];
}

// ─── Activity Buckets ─────────────────────────────────────────
export function buildActivity() {
  const events = [];
  for (let d = 0; d < 30; d++) {
    events.push({
      _id: new ObjectId(),
      assetId: SKILL_IDS.reactHooks,
      teamId: TEAM_A_ID,
      date: day(d),
      events: [
        { type: "view", userId: USER_VIEWER_ID, ts: day(d) },
        ...(d % 3 === 0 ? [{ type: "install", userId: USER_MEMBER_ID, ts: day(d) }] : []),
      ],
      [CAP_TEST_MARKER]: true,
    });
  }
  return events;
}

/**
 * Generate REAL embeddings via Voyage AI and seed everything into the DB.
 * This is idempotent — skips if marker docs already exist.
 */
export async function seedCapabilitiesData(db: Db): Promise<void> {
  const skills = db.collection("assets");

  // Check if already seeded
  const existing = await skills.findOne({ [CAP_TEST_MARKER]: true });
  if (existing) return; // Already seeded

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY required for real embedding tests");

  // Generate embeddings for ALL skills in a single batch call
  const texts = SKILLS_DATA.map(
    (s) => `${s.metadata.name} ${s.metadata.description} ${s.content}`
  );

  // Voyage AI allows up to 128 inputs per call
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "voyage-3-lite",
      input: texts,
      input_type: "document",
    }),
  });

  if (!response.ok) {
    throw new Error(`Voyage API error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };

  // Build asset documents with real embeddings + searchText
  const skillDocs = SKILLS_DATA.map((s, i) => ({
    ...s,
    searchText: mkSearchText(s.metadata.name, s.metadata.description, s.content, s.tags),
    embedding: data.data[i].embedding,
    [CAP_TEST_MARKER]: true,
  }));

  // Insert all data
  await Promise.all([
    skills.insertMany(skillDocs),
    db.collection("users").insertMany(buildUsers()),
    db.collection("teams").insertMany(buildTeams()),
    db.collection("activity").insertMany(buildActivity()),
  ]);
}

/** Remove only capability test data */
export async function cleanCapabilitiesData(db: Db): Promise<void> {
  await Promise.all([
    db.collection("assets").deleteMany({ [CAP_TEST_MARKER]: true }),
    db.collection("users").deleteMany({ [CAP_TEST_MARKER]: true }),
    db.collection("teams").deleteMany({ [CAP_TEST_MARKER]: true }),
    db.collection("activity").deleteMany({ [CAP_TEST_MARKER]: true }),
  ]);
}
