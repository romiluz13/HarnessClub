"use client";

/**
 * Mobile slide-out navigation drawer.
 * Overlay + slide animation. Closes on backdrop click, Escape, or navigation.
 * Per AGENTS.md: 44px touch targets, honor prefers-reduced-motion, cursor-pointer.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { X, LayoutDashboard, Puzzle, Users, Settings } from "lucide-react";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/skills", label: "Skills", icon: Puzzle },
  { href: "/dashboard/teams", label: "Teams", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 motion-safe:animate-in motion-safe:fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl motion-safe:animate-in motion-safe:slide-in-from-left">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
          <span className="text-lg font-bold text-gray-900">SkillsHub</span>
          <button
            onClick={onClose}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="space-y-1 px-3 py-4" role="navigation" aria-label="Mobile navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors cursor-pointer min-h-[44px] ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${active ? "text-blue-700" : "text-gray-500"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
