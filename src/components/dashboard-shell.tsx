"use client";

/**
 * Dashboard shell: wires together Sidebar, TopBar, and MobileNav.
 * This is a client component because it manages mobile drawer state.
 * The actual layout remains a server component that wraps this shell.
 */

import { useState, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { MobileNav } from "@/components/mobile-nav";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar className="hidden lg:flex" />

      {/* Mobile navigation drawer */}
      <MobileNav open={mobileNavOpen} onClose={closeMobileNav} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={openMobileNav} />

        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
