"use client";

/**
 * User avatar dropdown menu.
 * Shows user name, email, sign-out option.
 * Per AGENTS.md: cursor-pointer on all clickables, 44px touch targets.
 */

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";

export function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [open]);

  if (!session?.user) return null;

  const { name, email, image } = session.user;

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-transparent hover:border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User menu"
      >
        {image ? (
          <img
            src={image}
            alt={name ?? "User avatar"}
            className="h-8 w-8 rounded-full"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <User className="h-4 w-4" />
          </div>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-12 z-50 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
            <p className="text-xs text-gray-500 truncate">{email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors min-h-[44px]"
            role="menuitem"
          >
            <LogOut className="h-4 w-4 text-gray-500" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
