"use client";

/**
 * Client-side SessionProvider wrapper for Auth.js.
 * Wraps children with next-auth SessionProvider for useSession() hook access.
 * Per vercel-composition-patterns: thin client wrapper around server-rendered content.
 */

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

interface SessionProviderProps {
  children: React.ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
