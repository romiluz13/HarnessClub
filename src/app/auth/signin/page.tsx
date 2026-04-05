/**
 * Sign-in page with GitHub OAuth button.
 * Server component that renders the sign-in form.
 * Redirects to dashboard if already authenticated.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignInForm } from "@/components/sign-in-form";

export default async function SignInPage() {
  const session = await auth();

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
            Sign in to your account
          </h2>
          <p className="mt-1 text-sm text-gray-500 text-center">
            Continue with your GitHub account
          </p>

          <div className="mt-6">
            <SignInForm />
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          By signing in, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}
