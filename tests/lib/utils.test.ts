import { describe, it, expect } from "vitest";
import { escapeRegex } from "@/lib/utils";

describe("escapeRegex", () => {
  it("escapes all special regex characters", () => {
    const input = ".*+?^${}()|[]\\";
    const result = escapeRegex(input);
    expect(result).toBe("\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\");
  });

  it("returns plain strings unchanged", () => {
    expect(escapeRegex("hello world")).toBe("hello world");
  });

  it("escapes catastrophic backtracking payloads", () => {
    const malicious = "(?:a{1000000})";
    const result = escapeRegex(malicious);
    // All special chars escaped — no longer executable as regex
    expect(() => new RegExp(result)).not.toThrow();
    expect(result).not.toContain("(?:");
  });

  it("escapes dollar sign", () => {
    expect(escapeRegex("$100")).toBe("\\$100");
  });

  it("handles empty string", () => {
    expect(escapeRegex("")).toBe("");
  });
});
