"use client";

/**
 * useActiveOrg — returns the current user's active org/team from session.
 *
 * Usage:
 *   const { orgId, teamId, orgRole, teamRole, hasOrg } = useActiveOrg();
 *
 * Returns null values if session hasn't loaded yet.
 * Call `refresh()` after onboarding to force session update.
 */

import { useSession } from "next-auth/react";
import { useCallback } from "react";

export interface ActiveOrgContext {
  orgId: string | null;
  teamId: string | null;
  orgRole: string | null;
  teamRole: string | null;
  hasOrg: boolean;
  loading: boolean;
  /** Call after onboarding to refresh session with new org data */
  refresh: () => void;
}

export function useActiveOrg(): ActiveOrgContext {
  const { data: session, status, update } = useSession();

  const refresh = useCallback(() => {
    // Triggers JWT callback with trigger="update" to re-fetch memberships
    update();
  }, [update]);

  if (status === "loading") {
    return { orgId: null, teamId: null, orgRole: null, teamRole: null, hasOrg: false, loading: true, refresh };
  }

  const s = session as Record<string, unknown> | null;
  return {
    orgId: (s?.activeOrgId as string) ?? null,
    teamId: (s?.activeTeamId as string) ?? null,
    orgRole: (s?.orgRole as string) ?? null,
    teamRole: (s?.teamRole as string) ?? null,
    hasOrg: !!(s?.hasOrg),
    loading: false,
    refresh,
  };
}
