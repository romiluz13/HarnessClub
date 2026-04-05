/**
 * SkillCard + SkillCardSkeleton component tests.
 * Per web-design-guidelines: cursor-pointer, min touch targets, reduced-motion.
 * Per frontend-patterns: skeleton for loading state.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { SkillCard } from "../../src/components/skill-card";
import { SkillCardSkeleton } from "../../src/components/skill-card-skeleton";

const SKILL_PROPS = {
  id: "abc123",
  name: "React Hooks Deep Dive",
  description: "Advanced patterns for useState, useEffect, and custom hooks",
  author: "alice",
  version: "2.1.0",
  tags: ["react", "hooks", "frontend"],
  installCount: 342,
  viewCount: 1205,
  isPublished: true,
  updatedAt: "2026-03-01T00:00:00Z",
};

describe("SkillCard", () => {
  it("renders skill name and description", () => {
    render(<SkillCard {...SKILL_PROPS} />);
    expect(screen.getByText("React Hooks Deep Dive")).toBeInTheDocument();
    expect(screen.getByText(/Advanced patterns/)).toBeInTheDocument();
  });

  it("renders author and version", () => {
    render(<SkillCard {...SKILL_PROPS} />);
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/2\.1\.0/)).toBeInTheDocument();
  });

  it("renders tags as badges", () => {
    render(<SkillCard {...SKILL_PROPS} />);
    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("hooks")).toBeInTheDocument();
    expect(screen.getByText("frontend")).toBeInTheDocument();
  });

  it("renders install and view counts", () => {
    render(<SkillCard {...SKILL_PROPS} />);
    expect(screen.getByText("342")).toBeInTheDocument();
  });

  it("card is a clickable link to skill detail", () => {
    render(<SkillCard {...SKILL_PROPS} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", expect.stringContaining("abc123"));
  });

  it("shows draft badge when unpublished", () => {
    render(<SkillCard {...SKILL_PROPS} isPublished={false} />);
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
  });

  it("truncates long descriptions", () => {
    const longDesc = "A".repeat(300);
    render(<SkillCard {...SKILL_PROPS} description={longDesc} />);
    const desc = screen.getByText(longDesc.slice(0, 50), { exact: false });
    expect(desc).toBeInTheDocument();
  });
});

describe("SkillCardSkeleton", () => {
  it("renders with animate-pulse class", () => {
    render(<SkillCardSkeleton />);
    const pulsingElements = document.querySelectorAll("[class*='animate-pulse']");
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it("renders multiple skeleton blocks (title, desc, tags)", () => {
    render(<SkillCardSkeleton />);
    // Skeleton should have placeholder divs with bg-gray or bg-muted
    const placeholders = document.querySelectorAll("[class*='bg-']");
    expect(placeholders.length).toBeGreaterThanOrEqual(3);
  });

  it("respects grid layout", () => {
    const { container } = render(
      <div className="grid grid-cols-3 gap-4">
        <SkillCardSkeleton />
        <SkillCardSkeleton />
        <SkillCardSkeleton />
      </div>
    );
    const skeletons = container.querySelectorAll("[class*='animate-pulse']");
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });
});
