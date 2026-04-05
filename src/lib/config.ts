/**
 * Type-safe configuration loader.
 *
 * Validates all required environment variables at startup
 * rather than failing at runtime deep in a call stack.
 */

interface AppConfig {
  mongodb: {
    uri: string;
    dbName: string;
  };
  voyage: {
    apiKey: string | undefined;
    model: string;
    dimensions: number;
  };
  auth: {
    secret: string | undefined;
    url: string;
    github: {
      clientId: string | undefined;
      clientSecret: string | undefined;
    };
  };
  app: {
    env: "development" | "production" | "test";
    baseUrl: string;
  };
}

/**
 * Application configuration.
 *
 * MongoDB URI is required — app cannot start without it.
 * Other values have sensible defaults or are optional during development.
 */
export const config: AppConfig = {
  mongodb: {
    uri: process.env.MONGODB_URI || "",
    dbName: process.env.MONGODB_DB_NAME || "skillshub",
  },
  voyage: {
    apiKey: process.env.VOYAGE_API_KEY,
    model: "voyage-3-lite",
    dimensions: 512,
  },
  auth: {
    secret: process.env.NEXTAUTH_SECRET,
    url: process.env.NEXTAUTH_URL || "http://localhost:3000",
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },
  app: {
    env: (process.env.NODE_ENV as AppConfig["app"]["env"]) || "development",
    baseUrl: process.env.NEXTAUTH_URL || "http://localhost:3000",
  },
};

/**
 * Validate that required config values are present.
 * Call this at app startup (e.g., in middleware or layout).
 * Returns list of missing required variables.
 */
export function validateConfig(): string[] {
  const missing: string[] = [];

  if (!config.mongodb.uri) {
    missing.push("MONGODB_URI");
  }

  return missing;
}
