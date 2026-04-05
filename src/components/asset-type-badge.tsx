/**
 * Asset type badge — shows icon + label for each asset type.
 * Server-compatible (no 'use client'). Pure presentational.
 * Per AGENTS.md: SVG icons only (Lucide), no emoji.
 */

import {
  Lightbulb,
  Bot,
  Shield,
  Blocks,
  Cable,
  Webhook,
  Settings,
} from "lucide-react";
import type { AssetType } from "@/types/asset";

/** Config for each asset type — icon, label, color scheme */
const TYPE_CONFIG: Record<
  AssetType,
  {
    icon: typeof Lightbulb;
    label: string;
    bg: string;
    text: string;
    border: string;
  }
> = {
  skill: {
    icon: Lightbulb,
    label: "Skill",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  agent: {
    icon: Bot,
    label: "Agent",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  rule: {
    icon: Shield,
    label: "Rule",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  plugin: {
    icon: Blocks,
    label: "Plugin",
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
  },
  mcp_config: {
    icon: Cable,
    label: "MCP",
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-200",
  },
  hook: {
    icon: Webhook,
    label: "Hook",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
  },
  settings_bundle: {
    icon: Settings,
    label: "Settings",
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-200",
  },
};

interface AssetTypeBadgeProps {
  type: AssetType;
  /** "sm" = inline pill, "md" = larger badge with border */
  size?: "sm" | "md";
}

export function AssetTypeBadge({ type, size = "sm" }: AssetTypeBadgeProps) {
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.skill;
  const Icon = config.icon;

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-sm font-medium ${config.bg} ${config.text} ${config.border}`}
    >
      <Icon className="h-4 w-4" />
      {config.label}
    </span>
  );
}

/** Get the Lucide icon component for an asset type */
export function getAssetTypeIcon(type: AssetType) {
  return (TYPE_CONFIG[type] ?? TYPE_CONFIG.skill).icon;
}

/** Get human-readable label for an asset type */
export function getAssetTypeLabel(type: AssetType): string {
  return (TYPE_CONFIG[type] ?? TYPE_CONFIG.skill).label;
}
