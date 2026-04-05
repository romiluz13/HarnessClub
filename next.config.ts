import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Enable standalone output for Docker deployments */
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
  /** Per vercel-react-best-practices: optimize images, compress responses */
  compress: true,
  /** Cache static assets aggressively */
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-DNS-Prefetch-Control", value: "on" },
      ],
    },
    {
      source: "/api/marketplace/:path*",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
      ],
    },
  ],
  /**
   * Reduce server bundle risk by letting Node load complex server-only packages
   * directly from node_modules in standalone output.
   *
   * Pi AI uses dynamic provider loading that Turbopack currently rewrites into
   * "Cannot find module as expression is too dynamic" startup failures when it
   * is bundled into the server chunk. Externalizing it keeps the production
   * runtime on the package's native Node resolution path.
   */
  serverExternalPackages: ["mongodb", "crypto", "@mariozechner/pi-agent-core", "@mariozechner/pi-ai"],
};

export default nextConfig;
