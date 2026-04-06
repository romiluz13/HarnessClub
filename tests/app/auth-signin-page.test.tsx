/**
 * Auth sign-in page tests.
 *
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const mockAuth = vi.fn();
const mockGetConfiguredAuthProviders = vi.fn();
const mockRedirect = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
  getConfiguredAuthProviders: mockGetConfiguredAuthProviders,
}));

vi.mock("@/components/sign-in-form", () => ({
  SignInForm: ({
    providerId,
    providerLabel,
  }: {
    providerId: string;
    providerLabel: string;
  }) => (
    <div data-testid="sign-in-form">
      {providerId}:{providerLabel}
    </div>
  ),
}));

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the sign-in form when a provider is configured", async () => {
    mockAuth.mockResolvedValue(null);
    mockGetConfiguredAuthProviders.mockReturnValue([{ id: "github", label: "GitHub" }]);

    const SignInPage = (await import("../../src/app/auth/signin/page")).default;
    render(await SignInPage());

    expect(screen.getByText(/continue with your github account/i)).toBeInTheDocument();
    expect(screen.getByTestId("sign-in-form")).toHaveTextContent("github:GitHub");
  });

  it("renders setup guidance instead of a broken button when no provider is configured", async () => {
    mockAuth.mockResolvedValue(null);
    mockGetConfiguredAuthProviders.mockReturnValue([]);

    const SignInPage = (await import("../../src/app/auth/signin/page")).default;
    render(await SignInPage());

    expect(screen.getByText(/authentication setup required/i)).toBeInTheDocument();
    expect(screen.getByText(/github oauth is not configured on this deployment yet/i)).toBeInTheDocument();
    expect(screen.queryByTestId("sign-in-form")).not.toBeInTheDocument();
  });
});
