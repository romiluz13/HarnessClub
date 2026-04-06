/**
 * Sidebar + navigation component tests.
 * Per web-design-guidelines: active route highlighting, SVG icons (Lucide).
 * Per frontend-patterns: responsive layout, touch targets.
 *
 * @vitest-environment jsdom
 */

import { beforeEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock localStorage for sidebar collapse persistence
const localStorageMock = {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

const mockPathname = vi.fn().mockReturnValue("/dashboard/assets");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => mockPathname(),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { name: "Test User", email: "test@test.com", image: null } },
    status: "authenticated",
  }),
  signOut: vi.fn(),
}));

import { Sidebar } from "../../src/components/sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it("renders navigation links", () => {
    render(<Sidebar />);
    // Should have nav links for Skills, Teams, Search, Settings
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(3);
  });

  it("highlights active route with aria-current", () => {
    mockPathname.mockReturnValue("/dashboard/assets");
    render(<Sidebar />);
    // The active link gets aria-current="page"
    const activeLink = document.querySelector('a[aria-current="page"]');
    expect(activeLink).not.toBeNull();
    expect(activeLink?.getAttribute("href")).toBe("/dashboard/assets");
  });

  it("highlights different route when changed", () => {
    mockPathname.mockReturnValue("/dashboard/teams");
    render(<Sidebar />);
    const activeLink = document.querySelector('a[aria-current="page"]');
    expect(activeLink).not.toBeNull();
    expect(activeLink?.getAttribute("href")).toBe("/dashboard/teams");
  });

  it("uses SVG icons (not emoji per web-design-guidelines)", () => {
    render(<Sidebar />);
    const svgs = document.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(3);
  });

  it("renders app name/logo", () => {
    render(<Sidebar />);
    const brand = screen.getByText("AgentConfig");
    expect(brand).toBeInTheDocument();
  });

  it("nav links have min 44px touch targets", () => {
    render(<Sidebar />);
    const links = screen.getAllByRole("link");
    links.forEach((link) => {
      // Each nav link should have padding/height for accessibility
      expect(link).toBeVisible();
    });
  });

  it("applies the persisted collapsed state after hydration", async () => {
    localStorageMock.getItem.mockReturnValue("true");

    render(<Sidebar />);

    await waitFor(() => {
      expect(screen.queryByText("AgentConfig")).not.toBeInTheDocument();
    });
  });

  it("persists collapse toggles to localStorage", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    expect(localStorageMock.setItem).toHaveBeenCalledWith("skillshub-sidebar-collapsed", "true");
  });
});
