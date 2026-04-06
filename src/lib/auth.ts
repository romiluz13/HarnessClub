/**
 * Auth.js v5 Configuration.
 *
 * Per server-auth-actions: authenticate every server action and API route.
 * Per api-security-best-practices: secure session handling.
 *
 * Uses GitHub OAuth provider with MongoDB adapter for user persistence.
 * JWT strategy for stateless sessions (no server-side session store needed).
 */

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { ObjectId } from "mongodb";
import { getClientPromise, getDb, isMongoConfigured } from "@/lib/db";

export interface AuthProviderDescriptor {
  id: "github";
  label: string;
}

const hasGitHubOAuth = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
const authAdapter = isMongoConfigured()
  ? MongoDBAdapter(getClientPromise(), {
    databaseName: process.env.MONGODB_DB_NAME || "skillshub",
  })
  : undefined;
const configuredAuthProviders: AuthProviderDescriptor[] = hasGitHubOAuth
  ? [{ id: "github", label: "GitHub" }]
  : [];
const authProviders = hasGitHubOAuth
  ? [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ]
  : [];

export function getConfiguredAuthProviders(): AuthProviderDescriptor[] {
  return configuredAuthProviders;
}

/**
 * Auth.js configuration with GitHub OAuth.
 *
 * The MongoDB adapter stores users, accounts, and sessions in MongoDB.
 * JWT strategy means sessions are stored in cookies, not the database.
 *
 * Session is enriched with activeOrgId + activeTeamId from user's memberships.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: authAdapter,
  providers: authProviders,
  // Auth.js relies on the incoming Host header for callback/session URLs.
  // Per the official Auth.js docs, self-hosted deployments should set this explicitly.
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    /**
     * JWT callback — enrich token with org/team context.
     * On first sign-in (user present): look up memberships.
     * On subsequent requests: token already has the data.
     * When trigger=update: refresh memberships from DB.
     */
    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.userId = user.id;
      }
      if (account) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
      }

      // Enrich with org/team on first sign-in or on session update
      if ((user || trigger === "update") && token.userId) {
        try {
          const db = await getDb();
          const dbUser = await db.collection("users").findOne({
            _id: new ObjectId(token.userId as string),
          });
          if (dbUser?.orgMemberships?.length) {
            const firstOrg = dbUser.orgMemberships[0];
            token.activeOrgId = firstOrg.orgId.toHexString();
            token.orgRole = firstOrg.role;
          }
          if (dbUser?.teamMemberships?.length) {
            const firstTeam = dbUser.teamMemberships[0];
            token.activeTeamId = firstTeam.teamId.toHexString();
            token.teamRole = firstTeam.role;
          }
          token.hasOrg = !!(dbUser?.orgMemberships?.length);
        } catch {
          // DB unavailable — keep existing token data
        }
      }

      return token;
    },
    /**
     * Session callback — expose userId + org/team context to client.
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
      }
      session.activeOrgId = token.activeOrgId as string | undefined;
      session.activeTeamId = token.activeTeamId as string | undefined;
      session.orgRole = token.orgRole as string | undefined;
      session.teamRole = token.teamRole as string | undefined;
      session.hasOrg = token.hasOrg as boolean | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
});
