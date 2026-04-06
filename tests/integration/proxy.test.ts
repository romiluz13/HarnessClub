import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("proxy", () => {
  it("adds honest local rate-limit headers to API responses", () => {
    const request = new NextRequest("http://localhost/api/assets", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    const response = proxy(request);

    expect(response.headers.get("X-RateLimit-Limit")).toBeTruthy();
    expect(response.headers.get("X-RateLimit-Remaining")).toBeTruthy();
    expect(response.headers.get("X-RateLimit-Scope")).toBe("local-instance");
  });

  it("adds security headers to all responses", () => {
    const request = new NextRequest("http://localhost/dashboard", {
      headers: { "x-forwarded-for": "203.0.113.30" },
    });

    const response = proxy(request);

    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("Content-Security-Policy")).toBeTruthy();
  });

  it("adds rate limit headers only to /api/ routes", () => {
    const nonApiRequest = new NextRequest("http://localhost/dashboard", {
      headers: { "x-forwarded-for": "203.0.113.31" },
    });
    const response = proxy(nonApiRequest);

    // Non-API routes should NOT have rate limit headers
    expect(response.headers.get("X-RateLimit-Limit")).toBeNull();
    // But should have security headers
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("CSP does not contain unsafe-eval", () => {
    const request = new NextRequest("http://localhost/api/assets", {
      headers: { "x-forwarded-for": "203.0.113.40" },
    });

    const response = proxy(request);
    const csp = response.headers.get("Content-Security-Policy") ?? "";

    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  });

  it("returns 429 after the local rate limit is exceeded", () => {
    const baseIp = "203.0.113.20";
    const seedResponse = proxy(
      new NextRequest("http://localhost/api/assets", {
        headers: { "x-forwarded-for": baseIp },
      })
    );

    const limit = Number(seedResponse.headers.get("X-RateLimit-Limit"));
    let response = seedResponse;

    for (let i = 0; i < limit; i++) {
      response = proxy(
        new NextRequest("http://localhost/api/assets", {
          headers: { "x-forwarded-for": baseIp },
        })
      );
    }

    expect(response.status).toBe(429);
    expect(response.headers.get("X-RateLimit-Scope")).toBe("local-instance");
  });
});
