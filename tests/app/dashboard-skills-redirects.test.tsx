/**
 * Legacy dashboard skills route redirects.
 *
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

describe("legacy dashboard skills routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects /dashboard/skills to the canonical assets listing", async () => {
    const SkillsPage = (await import("../../src/app/dashboard/skills/page")).default;
    SkillsPage();

    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/assets");
  });

  it("redirects /dashboard/skills/[id] to the canonical asset detail route", async () => {
    const SkillDetailPage = (await import("../../src/app/dashboard/skills/[id]/page")).default;
    await SkillDetailPage({ params: Promise.resolve({ id: "asset-123" }) });

    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/assets/asset-123");
  });
});
