/**
 * NextAuth.js type augmentations.
 *
 * Per typescript-advanced-types module-augmentation:
 * Extends the Session type with org/team context fields
 * so we don't need `as any` in the session callback.
 */

import "next-auth";

declare module "next-auth" {
  interface Session {
    activeOrgId?: string;
    activeTeamId?: string;
    orgRole?: string;
    teamRole?: string;
    hasOrg?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    provider?: string;
    providerAccountId?: string;
    activeOrgId?: string;
    activeTeamId?: string;
    orgRole?: string;
    teamRole?: string;
    hasOrg?: boolean;
  }
}
