/**
 * Error Boundary — catches rendering errors and shows recovery UI.
 *
 * Per vercel-react-best-practices: error boundaries should be granular.
 * Per frontend-patterns: show actionable error states with retry.
 * Per web-design-guidelines: WCAG 2.1 AA compliant error messaging.
 */

"use client";

import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** What section of the app this wraps (for error context) */
  section?: string;
  /** Custom fallback UI */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log to error reporting service (Sentry, etc.)
    console.error(`[ErrorBoundary:${this.props.section ?? "unknown"}]`, error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-8 dark:border-red-800 dark:bg-red-950"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
            Something went wrong
          </h3>
          <p className="max-w-md text-center text-sm text-red-700 dark:text-red-300">
            {this.state.error?.message ?? "An unexpected error occurred."}
            {this.props.section && (
              <span className="block mt-1 text-xs opacity-70">
                Section: {this.props.section}
              </span>
            )}
          </p>
          <button
            onClick={this.handleRetry}
            className="cursor-pointer rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-red-500 dark:hover:bg-red-600"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
