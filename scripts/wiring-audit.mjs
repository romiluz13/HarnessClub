/**
 * Static wiring audit — no vitest needed.
 * Checks which services are imported by API routes.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.resolve('src');

function getImports(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports = [];
  const regex = /from\s+["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(content)) !== null) imports.push(match[1]);
  return imports;
}

function findRoutes(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findRoutes(full));
    else if (entry.name === 'route.ts') results.push(full);
  }
  return results;
}

const ALL_SERVICES = [
  'asset-service', 'search', 'search-hybrid', 'security-scanner', 'type-scanner',
  'trust-score', 'approval-service', 'supply-chain', 'github-import',
  'department-templates', 'org-service', 'team-service', 'sso-service',
  'scim-service', 'audit-service', 'api-token-service', 'compliance-service',
  'webhook-service', 'embedding-pipeline',
];

// Build route import map
const routes = findRoutes(path.join(SRC, 'app', 'api'));
const routeImports = new Map();
for (const route of routes) {
  routeImports.set(path.relative(SRC, route), getImports(route));
}

// Build service cross-import map
const serviceImports = new Map();
for (const svc of ALL_SERVICES) {
  const p = path.join(SRC, 'services', `${svc}.ts`);
  serviceImports.set(svc, getImports(p));
}

// Also check services/copilot/ and services/exporters/
for (const sub of ['copilot', 'exporters']) {
  const dir = path.join(SRC, 'services', sub);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.ts')) {
        const key = `${sub}/${f.replace('.ts','')}`;
        serviceImports.set(key, getImports(path.join(dir, f)));
      }
    }
  }
}

const results = [];

for (const svc of ALL_SERVICES) {
  const importedBy = [];

  // Check routes
  for (const [routePath, imports] of routeImports) {
    if (imports.some(i => i.includes(svc))) importedBy.push(`ROUTE: ${routePath}`);
  }

  // Check other services (transitive)
  for (const [otherSvc, imports] of serviceImports) {
    if (otherSvc === svc) continue;
    if (imports.some(i => i.includes(svc))) importedBy.push(`SERVICE: ${otherSvc}`);
  }

  const status = importedBy.length > 0 ? '✅ WIRED' : '🔴 DEAD';
  results.push({ service: svc, status, importedBy });
}

// Output
console.log('\n=== AGENTCONFIG WIRING AUDIT ===\n');

const wired = results.filter(r => r.status === '✅ WIRED');
const dead = results.filter(r => r.status === '🔴 DEAD');

console.log(`WIRED: ${wired.length}/${ALL_SERVICES.length}`);
console.log(`DEAD:  ${dead.length}/${ALL_SERVICES.length}\n`);

console.log('--- WIRED SERVICES ---');
for (const r of wired) {
  console.log(`  ✅ ${r.service}`);
  for (const by of r.importedBy) console.log(`     ← ${by}`);
}

console.log('\n--- DEAD SERVICES (no route or wired service imports them) ---');
for (const r of dead) {
  console.log(`  🔴 ${r.service}`);
}

// Also check: routes that exist
console.log(`\n--- ALL API ROUTES (${routes.length}) ---`);
for (const r of routes) console.log(`  ${path.relative(SRC, r)}`);

// Write to file too
const output = results.map(r => `${r.status} ${r.service} ${r.importedBy.length ? '← ' + r.importedBy.join(', ') : ''}`).join('\n');
fs.writeFileSync('wiring-audit-results.txt', `WIRED: ${wired.length}\nDEAD: ${dead.length}\n\n${output}\n`);
console.log('\nResults also written to wiring-audit-results.txt');

// Exit with error if any dead services found
if (dead.length > 0) {
  console.log(`\n❌ FAIL: ${dead.length} dead service(s) found. Wire them to routes or remove them.`);
  process.exit(1);
} else {
  console.log(`\n✅ PASS: All ${wired.length} services are wired to at least one route.`);
}
