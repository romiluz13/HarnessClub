/**
 * Getting Started Guide — onboarding flow for new users.
 */

import Link from "next/link";

const STEPS = [
  {
    step: 1,
    title: "Create Your Organization",
    description: "Sign in with GitHub and create your organization. Choose a unique slug — this becomes your marketplace URL.",
    code: `POST /api/orgs
{
  "name": "Acme Corp",
  "slug": "acme-corp"
}`,
  },
  {
    step: 2,
    title: "Set Up a Department",
    description: "Create departments based on your team structure. Choose from 8 pre-built templates — each comes with starter configs.",
    code: `POST /api/orgs/{orgId}/departments
{
  "name": "Frontend Engineering",
  "type": "engineering_fe"
}
// → Auto-provisions 2 starter assets`,
  },
  {
    step: 3,
    title: "Import Your Configs",
    description: "Import existing CLAUDE.md, .cursorrules, or any config file. Drag-and-drop or use the GitHub import.",
    code: `POST /api/assets/import
{
  "url": "https://github.com/org/repo",
  "path": "CLAUDE.md",
  "type": "rule"
}`,
  },
  {
    step: 4,
    title: "Export to Your Tool",
    description: "Export any asset to your preferred AI coding tool format.",
    code: `GET /api/assets/{id}/export?format=cursor
// Returns .mdc file with frontmatter

GET /api/assets/{id}/export?format=copilot
// Returns copilot-instructions.md`,
  },
  {
    step: 5,
    title: "Share via Marketplace",
    description: "Publish configs to your team's marketplace. Claude Code and other tools can poll this endpoint.",
    code: `// Your marketplace endpoint:
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
          Set up your organization, import configs, and start sharing in under 5 minutes.
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
