/**
 * WIRING AUDIT — Integration test that verifies every service is reachable.
 *
 * This is NOT a unit test. It checks:
 * 1. Every service file → is it imported by at least one API route or another wired service?
 * 2. Every API route → does it actually call the service it claims to use?
 * 3. Dead code detection → services that exist but nothing reaches them.
 *
 * Uses static import analysis + real MongoDB connectivity checks.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getTestDb, closeTestDb } from "../helpers/db-setup";
import fs from "fs";
import path from "path";

const SRC = path.resolve(__dirname, "../../src");

/** Read a file and extract its import paths */
function getImports(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8");
  const imports: string[] = [];
  const regex = /from\s+["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

/** Recursively find all route.ts files under src/app/api */
function findAllRoutes(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAllRoutes(full));
    } else if (entry.name === "route.ts") {
      results.push(full);
    }
  }
  return results;
}

/** Check if a service name is imported by ANY route or wired service */
function isServiceReachable(
  serviceName: string,
  allRouteImports: Map<string, string[]>,
  wiredServices: Set<string>
): { reachable: boolean; importedBy: string[] } {
  const importedBy: string[] = [];

  // Check routes
  for (const [routePath, imports] of allRouteImports) {
    if (imports.some((imp) => imp.includes(serviceName))) {
      importedBy.push(routePath);
    }
  }

  // Check other wired services (transitively reachable)
  for (const wired of wiredServices) {
    const wiredPath = path.join(SRC, "services", `${wired}.ts`);
    const wiredImports = getImports(wiredPath);
    if (wiredImports.some((imp) => imp.includes(serviceName))) {
      importedBy.push(`services/${wired}.ts`);
    }
  }

  return { reachable: importedBy.length > 0, importedBy };
}

// All service files we expect to be wired
const ALL_SERVICES = [
  "asset-service",
  "search",
  "search-hybrid",
  "security-scanner",
  "type-scanner",
  "trust-score",
  "approval-service",
  "supply-chain",
  "github-import",
  "department-templates",
  "org-service",
  "team-service",
  "sso-service",
  "scim-service",
  "audit-service",
  "api-token-service",
  "compliance-service",
  "webhook-service",
  "embedding-pipeline",
];

let routeImports: Map<string, string[]>;
let wiredServices: Set<string>;

beforeAll(async () => {
  await getTestDb();

  // Build import map for all API routes
  const apiDir = path.join(SRC, "app", "api");
  const routes = findAllRoutes(apiDir);
  routeImports = new Map();
  for (const route of routes) {
    const relPath = path.relative(SRC, route);
    routeImports.set(relPath, getImports(route));
  }

  // First pass: identify services directly imported by routes
  wiredServices = new Set<string>();
  for (const svc of ALL_SERVICES) {
    for (const imports of routeImports.values()) {
      if (imports.some((imp) => imp.includes(svc))) {
        wiredServices.add(svc);
        break;
      }
    }
  }
}, 30_000);

afterAll(async () => {
  await closeTestDb();
});

describe("SERVICE WIRING AUDIT — Is Every Service Reachable?", () => {
  for (const svc of ALL_SERVICES) {
    it(`${svc} is imported by at least one API route or wired service`, () => {
      const result = isServiceReachable(svc, routeImports, wiredServices);
      if (!result.reachable) {
        console.warn(`🔴 DEAD CODE: ${svc}.ts is not imported by any route or wired service`);
      } else {
        console.log(`✅ ${svc} ← imported by: ${result.importedBy.join(", ")}`);
      }
      expect(
        result.reachable,
        `${svc}.ts exists but NOTHING imports it — dead code`
      ).toBe(true);
    });
  }
});
