"use client";

/**
 * Top bar component for the dashboard layout.
 * Contains hamburger menu (mobile), breadcrumb area, search placeholder, and user menu.
 * Per AGENTS.md: 44px touch targets, cursor-pointer on clickables.
 */

import { Menu } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { SearchBar } from "@/components/search-bar";

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      {/* Left: Mobile hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 lg:hidden">SkillsHub</h1>
      </div>

      {/* Center: Search */}
      <div className="hidden flex-1 max-w-md mx-auto md:block">
        <SearchBar />
      </div>

      {/* Right: User menu */}
      <div className="flex items-center gap-2">
        <UserMenu />
      </div>
    </header>
  );
}
