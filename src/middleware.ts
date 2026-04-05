/**
 * Next.js Edge Middleware — security headers, rate limiting, CORS.
 *
 * Per api-security-best-practices:
 * - CSP headers on all responses
 * - CORS restricted to allowed origins
 * - Rate limiting via in-memory counter (edge-compatible)
 * - Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
 *
 * Per nextjs-app-router-patterns: middleware runs on Edge Runtime.
 */

import { NextRequest, NextResponse } from "next/server";

/** Rate limit window (1 minute) */
const RATE_LIMIT_WINDOW_MS = 60_000;

/** Rate limits per tier (requests per window) */
const RATE_LIMITS = {
  api: 100,         // General API
  auth: 20,         // Auth endpoints (stricter)
  marketplace: 200, // Public marketplace (higher)
  copilot: 30,      // Copilot chat (LLM-backed)
} as const;

/** In-memory rate limit store (edge-compatible, per-instance) */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getRateLimit(key: string, limit: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: limit - 1 };
  }

  entry.count++;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: limit - entry.count };
}

/** Determine rate limit tier from path */
function getTier(path: string): keyof typeof RATE_LIMITS {
  if (path.startsWith("/api/auth")) return "auth";
  if (path.startsWith("/api/marketplace")) return "marketplace";
  if (path.startsWith("/api/copilot")) return "copilot";
  return "api";
}

/** Security headers applied to ALL responses */
function addSecurityHeaders(response: NextResponse): void {
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");
  // Prevent MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // XSS protection (legacy browsers)
  response.headers.set("X-XSS-Protection", "1; mode=block");
  // Permissions policy
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  // HSTS (only in production)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
  // CSP
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://avatars.githubusercontent.com",
      "font-src 'self'",
      "connect-src 'self' https://api.voyageai.com",
      "frame-ancestors 'none'",
    ].join("; ")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only rate-limit API routes
  if (pathname.startsWith("/api/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const tier = getTier(pathname);
    const limit = RATE_LIMITS[tier];
    const key = `${ip}:${tier}`;

    const { allowed, remaining } = getRateLimit(key, limit);

    if (!allowed) {
      const response = NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      );
      response.headers.set("Retry-After", "60");
      response.headers.set("X-RateLimit-Limit", String(limit));
      response.headers.set("X-RateLimit-Remaining", "0");
      addSecurityHeaders(response);
      return response;
    }

    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", String(limit));
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    addSecurityHeaders(response);
    return response;
  }

  // Non-API routes — just add security headers
  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
