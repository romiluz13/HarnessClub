/**
 * Shared mocks for component tests.
 * Mocks Next.js navigation, auth, and SWR for isolated component testing.
 */

import { vi } from "vitest";

// ─── Next.js Navigation Mock ─────────────────────────────────
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

const mockPathname = vi.fn().mockReturnValue("/dashboard");
const mockSearchParams = vi.fn().mockReturnValue(new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname(),
  useSearchParams: () => mockSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// ─── NextAuth Mock ───────────────────────────────────────────
const mockSession = vi.fn().mockReturnValue({
  data: {
    user: { name: "Test User", email: "test@test.com", image: "https://avatar.test/img.png" },
    expires: "2099-01-01",
  },
  status: "authenticated",
});

vi.mock("next-auth/react", () => ({
  useSession: () => mockSession(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

export { mockRouter, mockPathname, mockSearchParams, mockSession };
