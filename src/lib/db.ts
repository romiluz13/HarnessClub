/**
 * MongoDB Connection Singleton
 *
 * Per mongodb-connection skill:
 * - Create client ONCE, reuse everywhere
 * - Initialize outside handler for serverless connection reuse
 * - M0 constraints: maxPoolSize=5, minPoolSize=0, maxIdleTimeMS=30000
 *
 * Per mongodb-mcp-setup skill:
 * - Connection string via environment variable
 */

import { MongoClient, type Db } from "mongodb";

const DB_NAME = process.env.MONGODB_DB_NAME || "skillshub";

/**
 * MongoDB connection options optimized for Atlas M0 (free tier).
 *
 * Per mongodb-connection skill (serverless pattern):
 *
 * maxPoolSize=5: M0 has ~500 total connections across all clients.
 *   Each serverless function instance creates its own pool — keep small (3-5).
 * minPoolSize=0: Don't maintain unused connections in serverless.
 *   Cold starts create connections on demand.
 * maxIdleTimeMS=30000: Release unused connections after 30s.
 *   Balances reuse vs resource consumption on shared M0 cluster.
 * connectTimeoutMS=10000: Fail fast on network issues.
 * serverSelectionTimeoutMS=10000: Quick failover for topology changes.
 * retryWrites=true: Automatically retry failed write operations (idempotent).
 * retryReads=true: Automatically retry failed read operations.
 *
 * NOTE: socketTimeoutMS intentionally omitted (defaults to 0 = no timeout).
 * Per mongodb-connection skill: setting socketTimeoutMS can cause premature
 * disconnects on legitimate long-running queries like aggregation pipelines.
 */
const MONGO_OPTIONS = {
  maxPoolSize: 5,
  minPoolSize: 0,
  maxIdleTimeMS: 30000,
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 10000,
  retryWrites: true,
  retryReads: true,
};

/**
 * Cache the client promise on globalThis so it survives
 * Next.js hot module replacement in development.
 * In production, module scope naturally persists across requests.
 *
 * IMPORTANT: Client creation is lazy (not at import time) so that
 * Next.js build can import this module without MONGODB_URI being set.
 * The throw happens at first actual use (getDb/getClient), not at import.
 */
interface GlobalWithMongo {
  _mongoClientPromise?: Promise<MongoClient>;
}

const globalWithMongo = globalThis as unknown as GlobalWithMongo;

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

function getClientPromise(): Promise<MongoClient> {
  if (globalWithMongo._mongoClientPromise) {
    return globalWithMongo._mongoClientPromise;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    // During Next.js build, modules are imported but DB is never accessed.
    // Return a rejected promise that surfaces a clear error if awaited at runtime.
    return Promise.reject(
      new Error(
        "MONGODB_URI environment variable is not set. " +
          "Add it to .env.local: MONGODB_URI=mongodb+srv://..."
      )
    );
  }

  const client = new MongoClient(uri, MONGO_OPTIONS);
  globalWithMongo._mongoClientPromise = client.connect();
  return globalWithMongo._mongoClientPromise;
}

/**
 * Get the database instance.
 * This is the primary export — use this everywhere.
 *
 * Usage:
 *   import { getDb } from '@/lib/db';
 *   const db = await getDb();
 *   const skills = await db.collection('skills').find({}).toArray();
 */
export async function getDb(): Promise<Db> {
  const connectedClient = await getClientPromise();
  return connectedClient.db(DB_NAME);
}

/**
 * Get the raw MongoClient instance.
 * Only use when you need client-level operations (transactions, watch, etc.)
 */
export async function getClient(): Promise<MongoClient> {
  return getClientPromise();
}

/**
 * Lazy client promise for NextAuth.js adapter and similar integrations
 * that need the raw promise. Access via getter to ensure lazy initialization.
 */
export { getClientPromise as getClientPromise };
