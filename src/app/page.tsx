/**
 * Landing Page — public-facing marketing page.
 * Per vercel-react-best-practices: Server Component, redirect if logged in.
 * Per web-design-guidelines: accessible, responsive, clear value prop.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";

const FEATURES = [
  { title: "Multi-Tool Export", desc: "One config, every tool. Export to Claude Code, Cursor, Copilot, Windsurf, and Codex.", icon: "🔄" },
  { title: "Department Harnesses", desc: "Pre-built bundles for Engineering, DevOps, Sales, Product, Legal, Marketing, Support.", icon: "🏢" },
  { title: "Security Scanning", desc: "Auto-detect secrets, prompt injection, and dangerous commands on every import.", icon: "🛡️" },
  { title: "Trust Scores", desc: "A-D grades based on provenance, scans, usage, and maintenance.", icon: "⭐" },
  { title: "Approval Workflows", desc: "Auto-approve, single review, or multi-reviewer for compliance.", icon: "✅" },
  { title: "Enterprise SSO", desc: "SAML 2.0, OIDC, SCIM directory sync, JIT provisioning.", icon: "🔐" },
] as const;

const TOOLS = [
  { name: "Claude Code", formats: "CLAUDE.md, skills, agents, plugins, MCP, hooks" },
  { name: "Cursor", formats: ".cursorrules, .cursor/rules/*.mdc" },
  { name: "Copilot", formats: ".github/copilot-instructions.md" },
  { name: "Windsurf", formats: ".windsurfrules" },
  { name: "Codex", formats: "AGENTS.md" },
] as const;

const PRICING: ReadonlyArray<{ tier: string; price: string; features: readonly string[]; highlighted?: boolean }> = [
  { tier: "Community", price: "Free", features: ["1 org, 3 teams", "100 assets", "5 export formats", "Basic search"] },
  { tier: "Team", price: "$15/user/mo", features: ["Unlimited teams", "Unlimited assets", "Approval workflows", "Audit logging", "API access"], highlighted: true },
  { tier: "Enterprise", price: "Custom", features: ["SAML/SCIM SSO", "SIEM integration", "Compliance dashboard", "Custom SLA"] },
];

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-100 dark:border-gray-800">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold text-gray-900 dark:text-white">AgentConfig</span>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Docs</Link>
            <Link href="/auth/signin" className="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 min-h-[44px] flex items-center">Sign In</Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
            The Enterprise Registry for<br />AI Agent Configurations
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
            Manage skills, rules, agents, plugins, and MCP configs across your organization. Import from any tool, export to every tool, with enterprise-grade security.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link href="/auth/signin" className="cursor-pointer rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 min-h-[44px]">Get Started Free</Link>
            <Link href="/docs" className="cursor-pointer rounded-lg border border-gray-300 px-6 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 min-h-[44px]">Read the Docs</Link>
          </div>
        </section>

        <section className="border-y border-gray-100 bg-gray-50 py-12 dark:border-gray-800 dark:bg-gray-900">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="mb-8 text-center text-sm font-semibold uppercase tracking-wider text-gray-500">Works with every AI coding tool</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {TOOLS.map((t) => (
                <div key={t.name} className="rounded-lg border border-gray-200 bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800">
                  <div className="font-semibold text-gray-900 dark:text-white">{t.name}</div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t.formats}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900 dark:text-white">Enterprise-Grade Agent Config Management</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-gray-200 p-6 dark:border-gray-700">
                <div className="mb-3 text-3xl">{f.icon}</div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">{f.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-gray-100 bg-gray-50 px-6 py-24 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900 dark:text-white">Simple Pricing</h2>
          <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-3">
            {PRICING.map((p) => (
              <div key={p.tier} className={`rounded-xl border p-8 ${p.highlighted ? "border-blue-600 bg-white shadow-lg dark:bg-gray-800" : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"}`}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{p.tier}</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{p.price}</p>
                <ul className="mt-6 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="mt-0.5 text-green-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 px-6 py-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>AgentConfig — The Enterprise Registry for AI Agent Configurations</p>
        <p className="mt-2">Built with Next.js, MongoDB Atlas, and Voyage AI</p>
      </footer>
    </div>
  );
}
