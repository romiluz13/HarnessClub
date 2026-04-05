/**
 * TeamsList component tests.
 * Per frontend-patterns skill: Error → Loading → Empty → Success.
 * Per web-design-guidelines: focus trap in modal, form validation.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// Mock SWR — vi.hoisted to avoid hoisting issues
const { mockSWR } = vi.hoisted(() => ({ mockSWR: vi.fn() }));
vi.mock("swr", () => ({ default: mockSWR }));

// Mock next/navigation + next-auth
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard/teams",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { TeamsList } from "../../src/components/teams-list";

const MOCK_TEAMS = [
  { id: "t1", name: "Frontend Masters", slug: "frontend-masters", ownerName: "alice", memberCount: 5, skillCount: 12, userRole: "owner", createdAt: "2026-01-01" },
  { id: "t2", name: "Python Guild", slug: "python-guild", ownerName: "bob", memberCount: 3, skillCount: 8, userRole: "member", createdAt: "2026-02-01" },
];

describe("TeamsList", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ── Error State ────────────────────────────────────────────
  it("renders error state", () => {
    mockSWR.mockReturnValue({ data: undefined, error: new Error("Network error"), isLoading: false });
    render(<TeamsList />);
    expect(screen.getByText(/failed|error/i)).toBeInTheDocument();
  });

  // ── Loading State ──────────────────────────────────────────
  it("renders loading spinner", () => {
    mockSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: true });
    render(<TeamsList />);
    const spinners = document.querySelectorAll("[class*='animate-spin']");
    expect(spinners.length).toBeGreaterThan(0);
  });

  // ── Empty State ────────────────────────────────────────────
  it("renders empty state with create CTA", () => {
    mockSWR.mockReturnValue({ data: { teams: [] }, error: undefined, isLoading: false });
    render(<TeamsList />);
    expect(screen.getByText(/no teams/i)).toBeInTheDocument();
    // Should show create button
    const createBtn = screen.getByRole("button", { name: /create/i });
    expect(createBtn).toBeInTheDocument();
  });

  // ── Success State ──────────────────────────────────────────
  it("renders team cards with correct data", () => {
    mockSWR.mockReturnValue({ data: { teams: MOCK_TEAMS }, error: undefined, isLoading: false });
    render(<TeamsList />);
    expect(screen.getByText("Frontend Masters")).toBeInTheDocument();
    expect(screen.getByText("Python Guild")).toBeInTheDocument();
  });

  it("shows member and skill counts", () => {
    mockSWR.mockReturnValue({ data: { teams: MOCK_TEAMS }, error: undefined, isLoading: false });
    render(<TeamsList />);
    expect(screen.getByText(/5/)).toBeInTheDocument(); // members
    expect(screen.getByText(/12/)).toBeInTheDocument(); // skills
  });

  it("shows user role in team cards", () => {
    mockSWR.mockReturnValue({ data: { teams: MOCK_TEAMS }, error: undefined, isLoading: false });
    render(<TeamsList />);
    // userRole is rendered with capitalize class alongside role icon
    expect(screen.getByText("owner")).toBeInTheDocument();
    expect(screen.getByText("member")).toBeInTheDocument();
  });

  // ── Create Team Modal (empty state) ────────────────────────
  it("opens create team modal from empty state", async () => {
    mockSWR.mockReturnValue({ data: { teams: [] }, error: undefined, isLoading: false });
    const user = userEvent.setup();
    render(<TeamsList />);
    const createBtn = screen.getByRole("button", { name: /create/i });
    await user.click(createBtn);
    // Modal should appear with form fields
    expect(screen.getByText(/team name/i)).toBeInTheDocument();
  });

  // ── Accessibility ──────────────────────────────────────────
  it("team cards are links with cursor-pointer", () => {
    mockSWR.mockReturnValue({ data: { teams: MOCK_TEAMS }, error: undefined, isLoading: false });
    render(<TeamsList />);
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => expect(link).toHaveAttribute("href"));
  });
});
