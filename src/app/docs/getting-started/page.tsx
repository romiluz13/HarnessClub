/**
 * Getting Started Guide — onboarding flow for new users.
 */

import Link from "next/link";

const STEPS = [
  {
    step: 1,
    title: "Configure Infra And Auth",
    description: "Before the UI works, connect MongoDB, set NEXTAUTH_SECRET, and configure GitHub OAuth for sign-in.",
    code: `# Required before first sign-in
MONGODB_URI=mongodb+srv://... or mongodb://localhost:27017/...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Optional but recommended for hybrid/vector search
VOYAGE_API_KEY=...`,
  },
  {
    step: 2,
    title: "Create Your Organization",
    description: "After GitHub OAuth is configured, sign in and create your organization. Choose a unique slug — this becomes your marketplace URL.",
    code: `POST /api/orgs
{
  "name": "Acme Corp",
  "slug": "acme-corp"
}`,
  },
  {
    step: 3,
    title: "Create A Department And Team",
    description: "Create departments based on your team structure, then create or use a team inside that org context before importing assets.",
    code: `POST /api/orgs/{orgId}/departments
{
  "name": "Frontend Engineering",
  "type": "engineering_fe"
}
// Team members import/export assets at the team level`,
  },
  {
    step: 4,
    title: "Import Your First Asset",
    description: "Import raw content or a URL. teamId is required because assets always belong to a team.",
    code: `POST /api/assets/import
{
  "teamId": "664f2f9c8c2b9b3e6f4a1234",
  "assetType": "rule",
  "filename": "CLAUDE.md",
  "content": "# Repository instructions..."
}`,
  },
  {
    step: 5,
    title: "Export to Your Tool",
    description: "Export any asset to your preferred AI coding tool format.",
    code: `GET /api/assets/{id}/export?format=cursor
// Returns .mdc file with frontmatter

GET /api/assets/{id}/export?format=copilot
// Returns copilot-instructions.md`,
  },
  {
    step: 6,
    title: "Verify And Share",
    description: "Use the health and discovery endpoints to verify the deployment, then publish to marketplace once the asset is ready.",
    code: `GET /api/health
GET /api/v1

// Team marketplace endpoint:
GET /api/marketplace/{teamSlug}

// Or org-wide:
GET /api/marketplace/org/{orgSlug}`,
  },
] as const;

export default function GettingStartedPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-100 dark:border-gray-800">
        <nav className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4">
          <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">AgentConfig</Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <Link href="/docs" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">Docs</Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">Getting Started</span>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Getting Started</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Connect MongoDB, configure GitHub OAuth, and bring your first agent assets online with truthful production checks.
        </p>

        <div className="mt-12 space-y-16">
          {STEPS.map((s) => (
            <div key={s.step}>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {s.step}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{s.title}</h2>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">{s.description}</p>
                  <pre className="mt-4 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
                    <code>{s.code}</code>
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-950">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">What&apos;s Next?</h3>
          <ul className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200">
            <li>→ <Link href="/docs" className="underline">Browse all documentation</Link></li>
            <li>→ <Link href="/dashboard" className="underline">Go to your dashboard</Link></li>
          </ul>
        </div>
      </main>
    </div>
  );
}
