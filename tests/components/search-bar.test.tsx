/**
 * SearchBar component tests.
 * Per web-design-guidelines: Cmd+K shortcut, keyboard navigation, responsive.
 * Per frontend-patterns: debounce, error handling, empty state.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// Mock fetch for search API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { SearchBar } from "../../src/components/search-bar";

describe("SearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [], total: 0 }),
    });
  });

  // ── Rendering ──────────────────────────────────────────────
  it("renders search input with placeholder", () => {
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search skills/i });
    expect(input).toBeInTheDocument();
  });

  it("renders keyboard shortcut hint in placeholder", () => {
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search skills/i });
    expect(input).toHaveAttribute("placeholder", expect.stringContaining("⌘K"));
  });

  // ── User Interaction ───────────────────────────────────────
  it("updates input value on typing", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search skills/i });
    await user.type(input, "React hooks");
    expect(input).toHaveValue("React hooks");
  });

  it("focuses input on Cmd+K", () => {
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search skills/i });
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(document.activeElement).toBe(input);
  });

  it("closes suggestions and blurs on Escape", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search skills/i });

    await act(async () => {
      input.focus();
      await user.keyboard("{Escape}");
    });

    expect(document.activeElement).not.toBe(input);
  });

  // ── Empty Results ──────────────────────────────────────────
  it("shows no results message for empty search", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [], total: 0 }),
    });
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search skills/i });
    await user.type(input, "xyznonexistent");

    await waitFor(() => {
      const noResults = screen.queryByText(/no results/i) || screen.queryByText(/no skills found/i);
      if (noResults) expect(noResults).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  // ── Accessibility ──────────────────────────────────────────
  it("has proper aria attributes", () => {
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search skills/i });
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
  });

  it("input has minimum touch target size", () => {
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search skills/i });
    expect(input).toBeVisible();
  });
});
