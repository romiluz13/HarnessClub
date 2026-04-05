/**
 * MongoDB $jsonSchema Validators
 *
 * Per mongodb-schema-design fundamental-schema-validation:
 * - $jsonSchema validation on all collections
 * - validationLevel "moderate" + validationAction "warn" initially
 * - Tighten to "strict" + "error" after stable
 *
 * Per mongodb-schema-design pattern-polymorphic:
 * - Assets collection uses type discriminator with shared + type-specific fields
 * - Type enum validates all 7 asset types
 *
 * GOTCHA: JavaScript numbers are IEEE 754 doubles. When inserted from
 * Node.js, numeric values are stored as BSON "double", NOT "int".
 * Use bsonType: ["int", "double"] for numeric fields to accept both.
 * See: https://www.mongodb.com/community/forums/t/jsonschema-integer/98861
 */

/**
 * Assets collection $jsonSchema validator (replaces V1 skillsValidator).
 * Polymorphic: shared fields required on all docs, type-specific fields optional.
 */
const assetsValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "type", "teamId", "metadata", "content", "tags", "searchText",
      "stats", "isPublished", "createdBy", "createdAt", "updatedAt",
    ],
    properties: {
      type: {
        enum: ["skill", "agent", "rule", "plugin", "mcp_config", "hook", "settings_bundle"],
        description: "Asset type discriminator (pattern-polymorphic)",
      },
      teamId: { bsonType: "objectId" },
      metadata: {
        bsonType: "object",
        required: ["name", "description"],
        properties: {
          name: { bsonType: "string", minLength: 1, maxLength: 200 },
          description: { bsonType: "string", minLength: 1, maxLength: 2000 },
          author: { bsonType: "string" },
          version: { bsonType: "string" },
          license: { bsonType: "string" },
        },
      },
      content: { bsonType: "string", minLength: 1 },
      tags: { bsonType: "array", items: { bsonType: "string" }, maxItems: 50 },
      searchText: { bsonType: "string", minLength: 1, description: "Pre-computed text for autoEmbed (ADR-010)" },
      embedding: { bsonType: "array", items: { bsonType: "double" }, description: "Manual Voyage fallback (M0/local)" },
      source: {
        bsonType: "object",
        properties: {
          repoUrl: { bsonType: "string" },
          path: { bsonType: "string" },
          commitHash: { bsonType: "string" },
          lastSyncedAt: { bsonType: "date" },
        },
      },
      stats: {
        bsonType: "object",
        required: ["installCount", "viewCount"],
        properties: {
          installCount: { bsonType: ["int", "double"], minimum: 0 },
          viewCount: { bsonType: ["int", "double"], minimum: 0 },
        },
      },
      isPublished: { bsonType: "bool" },
      createdBy: { bsonType: "objectId" },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
      // Type-specific config fields — optional at DB level, validated per-type in application layer.
      // MongoDB $jsonSchema does NOT support conditional validation (oneOf/if-then).
      // Per fundamental-schema-validation: "Validate structure at DB level, business rules in app."
      agentConfig: {
        bsonType: "object",
        properties: {
          model: { bsonType: "string" },
          tools: { bsonType: "array", items: { bsonType: "string" }, maxItems: 100 },
          allowedTools: { bsonType: "array", items: { bsonType: "string" }, maxItems: 100 },
          memory: { bsonType: "bool" },
        },
      },
      ruleConfig: {
        bsonType: "object",
        properties: {
          scope: { enum: ["project", "user", "organization"] },
          targetTool: { bsonType: "string" },
        },
      },
      pluginConfig: {
        bsonType: "object",
        properties: {
          manifest: {
            bsonType: "object",
            properties: {
              version: { bsonType: "string", pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+" },
              compatibility: { bsonType: "array", items: { bsonType: "string" }, maxItems: 20 },
              dependencies: { bsonType: "array", items: { bsonType: "string" }, maxItems: 50 },
              fingerprint: { bsonType: "string", maxLength: 128 },
              changelog: { bsonType: "object" },
            },
          },
          bundledAssetIds: { bsonType: "array", items: { bsonType: "objectId" }, maxItems: 200 },
        },
      },
      mcpConfig: {
        bsonType: "object",
        properties: {
          transport: { enum: ["stdio", "sse", "http"] },
          serverDefs: { bsonType: "array", items: { bsonType: "object" }, maxItems: 50 },
        },
      },
      hookConfig: {
        bsonType: "object",
        properties: {
          events: { bsonType: "array", items: { bsonType: "string" }, maxItems: 50 },
          scripts: { bsonType: "array", items: { bsonType: "object" }, maxItems: 50 },
        },
      },
      settingsConfig: {
        bsonType: "object",
        properties: {
          targetTool: { bsonType: "string" },
          settings: { bsonType: "object" },
        },
      },
    },
  },
};

/** @deprecated Use assetsValidator instead. Kept for migration reference. */
const skillsValidator = assetsValidator;

/** Teams collection $jsonSchema validator (updated Phase 11: optional orgId, departmentId) */
const teamsValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["name", "slug", "owner", "memberIds", "settings", "createdAt", "updatedAt"],
    properties: {
      name: { bsonType: "string", minLength: 1, maxLength: 100 },
      slug: { bsonType: "string", minLength: 1, maxLength: 100 },
      owner: {
        bsonType: "object",
        required: ["userId", "name", "email"],
        properties: {
          userId: { bsonType: "objectId" },
          name: { bsonType: "string" },
          email: { bsonType: "string" },
        },
      },
      memberIds: { bsonType: "array", items: { bsonType: "objectId" }, maxItems: 1000 },
      settings: {
        bsonType: "object",
        required: ["marketplaceEnabled", "defaultRole", "autoPublish"],
        properties: {
          marketplaceEnabled: { bsonType: "bool" },
          defaultRole: { enum: ["owner", "admin", "member", "viewer"] },
          autoPublish: { bsonType: "bool" },
        },
      },
      orgId: { bsonType: "objectId" },
      departmentId: { bsonType: "objectId" },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};

/** Organizations collection $jsonSchema validator (Phase 11) */
const organizationsValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["name", "slug", "plan", "owner", "settings", "createdAt", "updatedAt"],
    properties: {
      name: { bsonType: "string", minLength: 1, maxLength: 200 },
      slug: { bsonType: "string", minLength: 1, maxLength: 100 },
      plan: { enum: ["free", "team", "enterprise"] },
      owner: {
        bsonType: "object",
        required: ["userId", "name", "email"],
        properties: {
          userId: { bsonType: "objectId" },
          name: { bsonType: "string" },
          email: { bsonType: "string" },
        },
      },
      settings: {
        bsonType: "object",
        required: ["marketplaceEnabled", "crossDeptApprovalRequired", "ssoEnabled"],
        properties: {
          marketplaceEnabled: { bsonType: "bool" },
          crossDeptApprovalRequired: { bsonType: "bool" },
          defaultDeptType: {
            enum: [
              "engineering_fe", "engineering_be", "devops", "sales",
              "product", "legal", "marketing", "support", "custom",
            ],
          },
          ssoEnabled: { bsonType: "bool" },
        },
      },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};

/** Departments collection $jsonSchema validator (Phase 11) */
const departmentsValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["orgId", "name", "type", "description", "defaultAssetIds", "teamCount", "createdAt", "updatedAt"],
    properties: {
      orgId: { bsonType: "objectId" },
      name: { bsonType: "string", minLength: 1, maxLength: 200 },
      type: {
        enum: [
          "engineering_fe", "engineering_be", "devops", "sales",
          "product", "legal", "marketing", "support", "custom",
        ],
      },
      description: { bsonType: "string", maxLength: 1000 },
      defaultAssetIds: { bsonType: "array", items: { bsonType: "objectId" }, maxItems: 200 },
      teamCount: { bsonType: ["int", "double"] },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};

/** Users collection $jsonSchema validator */
const usersValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["email", "name", "auth", "teamMemberships", "createdAt", "updatedAt"],
    properties: {
      email: { bsonType: "string" },
      name: { bsonType: "string", minLength: 1, maxLength: 200 },
      auth: {
        bsonType: "object",
        required: ["provider", "providerId"],
        properties: {
          provider: { enum: ["github"] },
          providerId: { bsonType: "string" },
        },
      },
      teamMemberships: {
        bsonType: "array",
        maxItems: 50,
        items: {
          bsonType: "object",
          required: ["teamId", "role", "joinedAt"],
          properties: {
            teamId: { bsonType: "objectId" },
            role: { enum: ["owner", "admin", "member", "viewer"] },
            joinedAt: { bsonType: "date" },
          },
        },
      },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};

/** Audit logs collection $jsonSchema validator */
const auditLogsValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["actorId", "action", "targetId", "teamId", "timestamp"],
    properties: {
      actorId: { bsonType: "objectId" },
      action: {
        bsonType: "string",
        description: "Audit action type",
      },
      targetId: { bsonType: "objectId" },
      targetType: { bsonType: "string" },
      teamId: { bsonType: "objectId" },
      details: { bsonType: "object" },
      timestamp: { bsonType: "date" },
    },
  },
};

export {
  assetsValidator,
  auditLogsValidator,
  departmentsValidator,
  organizationsValidator,
  skillsValidator,
  teamsValidator,
  usersValidator,
};
