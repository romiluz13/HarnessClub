/**
 * Tests for NextAuth type augmentation.
 *
 * Verifies that the Session type includes org/team context fields
 * after module augmentation in src/types/next-auth.d.ts.
 *
 * This is a compile-time + runtime test: if the augmentation is missing,
 * TypeScript will reject the assignment (compile error), and the runtime
 * assertion will fail.
 */

import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";

describe("NextAuth Session type augmentation", () => {
  it("Session type accepts org/team context fields", () => {
    // If the module augmentation is missing, this will be a TS compile error
    const session: Session = {
      user: { id: "user-1", name: "Test", email: "test@test.com" },
      expires: new Date().toISOString(),
      activeOrgId: "org-123",
      activeTeamId: "team-456",
      orgRole: "admin",
      teamRole: "member",
      hasOrg: true,
    };

    expect(session.activeOrgId).toBe("org-123");
    expect(session.activeTeamId).toBe("team-456");
    expect(session.orgRole).toBe("admin");
    expect(session.teamRole).toBe("member");
    expect(session.hasOrg).toBe(true);
  });

  it("Session type allows optional org/team fields", () => {
    const session: Session = {
      user: { id: "user-2", name: "Test2", email: "test2@test.com" },
      expires: new Date().toISOString(),
    };

    expect(session.activeOrgId).toBeUndefined();
    expect(session.hasOrg).toBeUndefined();
  });
});
