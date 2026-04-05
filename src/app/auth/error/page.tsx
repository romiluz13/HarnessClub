/**
 * Auth error page.
 * Shows error message and retry link.
 */

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>

        <div>
          <h1 className="text-xl font-bold text-gray-900">Authentication Error</h1>
          <p className="mt-2 text-sm text-gray-500">
            Something went wrong during sign in. Please try again.
          </p>
        </div>

        <Link
          href="/auth/signin"
          className="inline-flex cursor-pointer items-center rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors min-h-[44px]"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
