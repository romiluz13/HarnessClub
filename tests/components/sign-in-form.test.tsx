/**
 * Sign-in form tests.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SignInForm } from "../../src/components/sign-in-form";

const { mockSignIn } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signIn: mockSignIn,
}));

describe("SignInForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders provider-aware button text", () => {
    render(<SignInForm providerId="github" providerLabel="GitHub" />);
    expect(screen.getByRole("button", { name: /continue with github/i })).toBeInTheDocument();
  });

  it("calls signIn with the configured provider and callback URL", () => {
    render(
      <SignInForm
        providerId="github"
        providerLabel="GitHub"
        callbackUrl="/dashboard"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /continue with github/i }));
    expect(mockSignIn).toHaveBeenCalledWith("github", { callbackUrl: "/dashboard" });
  });
});
