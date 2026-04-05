/**
 * Documentation Hub — getting started, API reference, format specs, guides.
 * Per vercel-react-best-practices: Server Component, no client JS.
 */

import Link from "next/link";

const SECTIONS = [
  {
    title: "Getting Started",
    description: "Set up your first organization, team, and import your agent configs in under 5 minutes.",
    href: "/docs/getting-started",
    items: [
      "Create an organization",
      "Set up your first team",
      "Import configs from GitHub",
      "Export to your preferred tool",
    ],
  },
  {
    title: "API Reference",
    description: "RESTful API for managing assets, teams, organizations, and marketplace.",
    href: null,
    items: [
      "Authentication (OAuth, API tokens)",
      "Assets CRUD",
      "Search & Discovery",
      "Marketplace Protocol",
      "Webhooks",
    ],
  },
  {
    title: "Format Specifications",
    description: "Detailed specs for each supported asset type and export format.",
    href: null,
    items: [
      "Asset Types (skill, rule, agent, plugin, mcp_config, hook, settings_bundle)",
      "Export Formats (Claude Code, Cursor MDC, Copilot, Windsurf, Codex)",
      "Plugin Bundle Manifests",
      "Marketplace JSON Schema",
    ],
  },
  {
    title: "Department Harnesses",
    description: "Pre-built configuration bundles for common department types.",
    href: null,
    items: [
      "Engineering (Frontend & Backend)",
      "DevOps & Platform",
      "Sales & Product",
      "Legal, Marketing & Support",
      "Custom Harness Creation",
    ],
  },
  {
    title: "Security & Governance",
    description: "Enterprise security features, compliance, and trust management.",
    href: null,
    items: [
      "Security Scanning (base + type-specific)",
      "Trust Scores (A-D grading)",
      "Approval Workflows",
      "SSO (SAML 2.0 / OIDC)",
      "SCIM Directory Sync",
      "Audit Logging & SIEM Export",
    ],
  },
  {
    title: "Plugin Authoring",
    description: "Create and publish plugins — bundles of related configs.",
    href: null,
    items: [
      "Plugin Manifest Structure",
      "Bundling Assets",
      "Version Management",
      "Publishing to Marketplace",
    ],
  },
  {
    title: "CLI Reference",
    description: "The `ac` command-line tool for managing configs locally.",
    href: null,
    items: [
      "ac init — Initialize config",
      "ac import — Import from repo/URL",
      "ac export — Export to tool format",
      "ac search — Search marketplace",
      "ac publish — Publish to team",
    ],
  },
] as const;

type Section = typeof SECTIONS[number];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-100 dark:border-gray-800">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">AgentConfig</Link>
          <span className="text-sm font-medium text-gray-500">Documentation</span>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Documentation</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Everything you need to manage AI agent configurations at enterprise scale.
        </p>

        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {SECTIONS.map((s) => {
            const card = (
              <div className="relative rounded-xl border border-gray-200 p-6 transition-all dark:border-gray-700"
                   style={s.href ? {} : {}}>
                {!s.href && (
                  <span className="absolute right-4 top-4 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    Coming Soon
                  </span>
                )}
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{s.title}</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{s.description}</p>
                <ul className="mt-4 space-y-1">
                  {s.items.map((item) => (
                    <li key={item} className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="mr-2 text-blue-500">→</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            );

            return s.href ? (
              <Link key={s.title} href={s.href} className="hover:border-blue-300 hover:shadow-sm dark:hover:border-blue-600 rounded-xl transition-all">
                {card}
              </Link>
            ) : (
              <div key={s.title} className="opacity-80">{card}</div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
