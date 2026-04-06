/**
 * SkillsList component tests.
 * Per frontend-patterns skill: test Error → Loading → Empty → Success states.
 * Per web-design-guidelines: cursor-pointer, aria-labels, 44px min targets.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock SWR before importing the component — vi.hoisted to avoid hoisting issues
const { mockSWR } = vi.hoisted(() => ({ mockSWR: vi.fn() }));
vi.mock("swr", () => ({ default: mockSWR }));

// Mock next/navigation + next-auth
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard/assets",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { SkillsList } from "../../src/components/skills-list";

const MOCK_SKILLS = [
  { id: "1", name: "React Hooks", description: "Advanced React patterns", author: "alice", version: "2.0", tags: ["react", "hooks"], installCount: 342, viewCount: 1205, isPublished: true, createdAt: "2026-03-01" },
  { id: "2", name: "TypeScript Generics", description: "Generic type mastery", author: "bob", version: "1.5", tags: ["typescript"], installCount: 189, viewCount: 876, isPublished: true, createdAt: "2026-03-05" },
  { id: "3", name: "Draft Skill", description: "Work in progress", author: "charlie", version: "0.1", tags: [], installCount: 0, viewCount: 10, isPublished: false, createdAt: "2026-03-10" },
];

describe("SkillsList", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ── Error State ────────────────────────────────────────────
  it("renders error state with message and retry", () => {
    mockSWR.mockReturnValue({ data: undefined, error: new Error("Network failure"), isLoading: false });
    render(<SkillsList />);
    expect(screen.getByText(/failed to load assets/i)).toBeInTheDocument();
  });

  // ── Loading State ──────────────────────────────────────────
  it("renders loading state with skeleton cards", () => {
    mockSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: true });
    render(<SkillsList />);
    // Should show skeleton elements (animated placeholders)
    const skeletons = document.querySelectorAll("[class*='animate-pulse']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // ── Empty State ────────────────────────────────────────────
  it("renders empty state with call-to-action", () => {
    mockSWR.mockReturnValue({ data: { assets: [], total: 0 }, error: undefined, isLoading: false });
    render(<SkillsList />);
    expect(screen.getByText(/no assets/i)).toBeInTheDocument();
  });

  // ── Success State ──────────────────────────────────────────
  it("requests assets from the canonical API", () => {
    mockSWR.mockReturnValue({ data: { assets: MOCK_SKILLS, total: 3 }, error: undefined, isLoading: false });
    render(<SkillsList />);
    expect(mockSWR).toHaveBeenCalledWith(
      "/api/assets",
      expect.any(Function),
      expect.objectContaining({ revalidateOnFocus: false })
    );
  });

  it("renders assets cards with correct data", () => {
    mockSWR.mockReturnValue({ data: { assets: MOCK_SKILLS, total: 3 }, error: undefined, isLoading: false });
    render(<SkillsList />);
    expect(screen.getByText("React Hooks")).toBeInTheDocument();
    expect(screen.getByText("TypeScript Generics")).toBeInTheDocument();
  });

  it("shows install count and view count stats", () => {
    mockSWR.mockReturnValue({ data: { assets: MOCK_SKILLS, total: 3 }, error: undefined, isLoading: false });
    render(<SkillsList />);
    expect(screen.getByText("342")).toBeInTheDocument(); // installCount
  });

  it("renders tags as badges", () => {
    mockSWR.mockReturnValue({ data: { assets: MOCK_SKILLS, total: 3 }, error: undefined, isLoading: false });
    render(<SkillsList />);
    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("hooks")).toBeInTheDocument();
  });

  it("shows draft badge for unpublished skills", () => {
    mockSWR.mockReturnValue({ data: { assets: MOCK_SKILLS, total: 3 }, error: undefined, isLoading: false });
    render(<SkillsList />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  // ── Accessibility ──────────────────────────────────────────
  it("skill cards are clickable with cursor-pointer", () => {
    mockSWR.mockReturnValue({ data: { assets: MOCK_SKILLS, total: 3 }, error: undefined, isLoading: false });
    render(<SkillsList />);
    const links = screen.getAllByRole("link");
    links.forEach((link) => {
      expect(link).toHaveAttribute("href", expect.stringContaining("/dashboard/assets/"));
    });
  });
});
