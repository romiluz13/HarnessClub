/**
 * Settings page — hub with links to all admin sub-pages.
 */

import Link from "next/link";
import { Building2, Key, Globe, Shield, FileText } from "lucide-react";

const SETTINGS_SECTIONS = [
  { href: "/dashboard/settings/organization", label: "Organization", desc: "Org name, departments, plan", icon: Building2 },
  { href: "/dashboard/settings/tokens", label: "API Tokens", desc: "Create and manage API tokens", icon: Key },
  { href: "/dashboard/settings/webhooks", label: "Webhooks", desc: "Event notifications", icon: Globe },
  { href: "/dashboard/settings/sso", label: "SSO", desc: "SAML / OIDC configuration", icon: Shield },
  { href: "/dashboard/settings/audit", label: "Audit Logs", desc: "Activity and compliance logs", icon: FileText },
] as const;

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Organization and team administration.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SETTINGS_SECTIONS.map((s) => (
          <Link key={s.href} href={s.href}
            className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-blue-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700">
            <s.icon className="h-6 w-6 text-gray-400 group-hover:text-blue-600 dark:text-gray-500" />
            <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">{s.label}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
