/**
 * Sign-in page with GitHub OAuth button.
 * Server component that renders the sign-in form.
 * Redirects to dashboard if already authenticated.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, getConfiguredAuthProviders } from "@/lib/auth";
import { SignInForm } from "@/components/sign-in-form";

export default async function SignInPage() {
  const session = await auth();
  const configuredProviders = getConfiguredAuthProviders();
  const primaryProvider = configuredProviders[0];

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">SkillsHub</h1>
          <p className="mt-2 text-sm text-gray-500">
            AI Skills Management for Teams
          </p>
        </div>

        {/* Sign-in card */}
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 text-center">
            {primaryProvider ? "Sign in to your account" : "Authentication setup required"}
          </h2>
          <p className="mt-1 text-sm text-gray-500 text-center">
            {primaryProvider
              ? `Continue with your ${primaryProvider.label} account`
              : "GitHub OAuth is not configured on this deployment yet."}
          </p>

          <div className="mt-6">
            {primaryProvider ? (
              <SignInForm
                providerId={primaryProvider.id}
                providerLabel={primaryProvider.label}
              />
            ) : (
              <div
                className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
                role="status"
              >
                <p className="font-medium">
                  Set <code>GITHUB_CLIENT_ID</code> and <code>GITHUB_CLIENT_SECRET</code> to enable sign-in.
                </p>
                <p>
                  This open-source build boots without OAuth so installs can still build cleanly, but sign-in stays
                  intentionally unavailable until the provider is configured.
                </p>
                <Link href="/docs/getting-started" className="inline-flex text-sm font-medium text-amber-900 underline">
                  Open setup guide
                </Link>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          By signing in, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}
