import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
]);

function isLoopbackOrPrivateIpv4(value: string): boolean {
  const parts = value.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isLoopbackOrPrivateIpv6(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized === "::1"
    || normalized === "::"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("fe80:");
}

function isBlockedIpAddress(value: string): boolean {
  const version = isIP(value);
  if (version === 4) {
    return isLoopbackOrPrivateIpv4(value);
  }
  if (version === 6) {
    return isLoopbackOrPrivateIpv6(value);
  }
  return false;
}

export interface OutboundUrlValidationOptions {
  allowedProtocols?: string[];
}

export async function assertSafeOutboundUrl(
  rawUrl: string,
  options: OutboundUrlValidationOptions = {}
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL is invalid");
  }

  const allowedProtocols = options.allowedProtocols ?? ["http:", "https:"];
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new Error("URL protocol must be http or https");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URL must not include embedded credentials");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(hostname)
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
  ) {
    throw new Error("URL host is not allowed");
  }

  if (isBlockedIpAddress(hostname)) {
    throw new Error("URL host is not allowed");
  }

  const resolved = await lookup(hostname, { all: true, verbatim: true });
  if (resolved.length === 0 || resolved.some((entry) => isBlockedIpAddress(entry.address))) {
    throw new Error("URL host is not allowed");
  }

  return parsed;
}
