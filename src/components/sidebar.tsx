"use client";

/**
 * Collapsible sidebar navigation for the dashboard.
 * Stores collapse state in localStorage.
 * Per AGENTS.md: SVG icons only (Lucide), 44px touch targets, cursor-pointer on clickables.
 */

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Puzzle,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Store,
} from "lucide-react";

const SIDEBAR_COLLAPSED_KEY = "skillshub-sidebar-collapsed";

interface NavItemConfig {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
}

const NAV_ITEMS: NavItemConfig[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "1" },
  { href: "/dashboard/assets", label: "Assets", icon: Puzzle, shortcut: "2" },
  { href: "/dashboard/teams", label: "Teams", icon: Users, shortcut: "3" },
  { href: "/dashboard/approvals", label: "Approvals", icon: CheckCircle, shortcut: "4" },
  { href: "/marketplace", label: "Marketplace", icon: Store, shortcut: "5" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, shortcut: "6" },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className = "" }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  // Keyboard shortcuts: Alt+1-4 for nav, Alt+B to toggle sidebar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key === "b") {
        e.preventDefault();
        toggleCollapse();
        return;
      }
      if (e.altKey) {
        const item = NAV_ITEMS.find((n) => n.shortcut === e.key);
        if (item) {
          e.preventDefault();
          window.location.href = item.href;
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapse]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`${className} flex flex-col border-r border-gray-200 bg-white transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo / Brand */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
        {!collapsed && (
          <Link href="/dashboard" className="text-lg font-bold text-gray-900 dark:text-white">
            AgentConfig
          </Link>
        )}
        <button
          onClick={toggleCollapse}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={`${collapsed ? "Expand" : "Collapse"} sidebar (Alt+B)`}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4" role="navigation" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer min-h-[44px] ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              } ${collapsed ? "justify-center" : ""}`}
              title={collapsed ? `${item.label} (Alt+${item.shortcut})` : undefined}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={`h-5 w-5 flex-shrink-0 ${active ? "text-blue-700" : "text-gray-500"}`} />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.shortcut && (
                    <kbd className="hidden text-xs text-gray-400 lg:inline">Alt+{item.shortcut}</kbd>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
