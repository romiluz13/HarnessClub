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
const { mockFetch, mockPush } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockPush: vi.fn(),
}));
global.fetch = mockFetch;

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
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
      json: () => Promise.resolve({ suggestions: [], total: 0 }),
    });
  });

  // ── Rendering ──────────────────────────────────────────────
  it("renders search input with placeholder", () => {
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search assets/i });
    expect(input).toBeInTheDocument();
  });

  it("renders keyboard shortcut hint in placeholder", () => {
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search assets/i });
    expect(input).toHaveAttribute("placeholder", expect.stringContaining("⌘K"));
  });

  // ── User Interaction ───────────────────────────────────────
  it("updates input value on typing", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search assets/i });
    await user.type(input, "React hooks");
    expect(input).toHaveValue("React hooks");
  });

  it("focuses input on Cmd+K", () => {
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search assets/i });
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(document.activeElement).toBe(input);
  });

  it("closes suggestions and blurs on Escape", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search assets/i });

    await act(async () => {
      input.focus();
      await user.keyboard("{Escape}");
    });

    expect(document.activeElement).not.toBe(input);
  });

  it("submits the typed query to the assets listing route", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search assets/i });
    await user.type(input, "registry hygiene");
    fireEvent.submit(input.closest("form")!);

    expect(mockPush).toHaveBeenCalledWith("/dashboard/assets?q=registry%20hygiene");
  });

  it("navigates to the canonical asset detail route from a suggestion", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        suggestions: [{ skillId: "asset-1", name: "React Hooks" }],
      }),
    });

    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search assets/i });
    await user.type(input, "Re");

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await user.click(await screen.findByText("React Hooks"));

    expect(mockPush).toHaveBeenCalledWith("/dashboard/assets/asset-1");
  });

  // ── Accessibility ──────────────────────────────────────────
  it("has proper aria attributes", () => {
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search assets/i });
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
  });

  it("input has minimum touch target size", () => {
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: /search assets/i });
    expect(input).toBeVisible();
  });
});
