/**
 * Shared parsing helpers — used across all parsers.
 * Frontmatter extraction, tag inference, name normalization.
 */

/** Extract YAML frontmatter from markdown content */
export function extractFrontmatter(
  content: string
): { frontmatter: Record<string, string>; body: string } | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return null;

  const yaml = match[1];
  const body = match[2];
  const frontmatter: Record<string, string> = {};

  for (const line of yaml.split("\n")) {
    const kvMatch = line.match(/^(\w[\w.-]*)\s*:\s*(.+)$/);
    if (kvMatch) {
      frontmatter[kvMatch[1].trim()] = kvMatch[2].trim().replace(/^["']|["']$/g, "");
    }
  }

  return { frontmatter, body };
}

/** Extract the first # heading from markdown as a name */
export function extractFirstHeading(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/** Extract description from first paragraph after heading */
export function extractFirstParagraph(content: string): string {
  // Skip frontmatter
  const body = content.replace(/^---[\s\S]*?---\s*\n/, "");
  // Skip heading
  const afterHeading = body.replace(/^#.*\n+/, "");
  // Get first non-empty paragraph
  const lines = afterHeading.split("\n");
  const paragraph: string[] = [];
  let started = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!started && trimmed.length > 0 && !trimmed.startsWith("#")) {
      started = true;
      paragraph.push(trimmed);
    } else if (started && trimmed.length > 0 && !trimmed.startsWith("#")) {
      paragraph.push(trimmed);
    } else if (started && trimmed.length === 0) {
      break;
    }
  }

  return paragraph.join(" ").slice(0, 2000) || "No description available";
}

/**
 * Infer tags from content.
 * Extracts from: frontmatter tags, headings, code blocks, keywords.
 */
export function inferTags(
  content: string,
  frontmatterTags?: string
): string[] {
  const tags = new Set<string>();

  // From frontmatter
  if (frontmatterTags) {
    const parsed = frontmatterTags.replace(/[\[\]]/g, "").split(",");
    for (const tag of parsed) {
      const trimmed = tag.trim().toLowerCase();
      if (trimmed.length > 0 && trimmed.length <= 30) {
        tags.add(trimmed);
      }
    }
  }

  // Detect common tool/framework mentions
  const toolPatterns: Array<[RegExp, string]> = [
    [/\breact\b/i, "react"],
    [/\bnext\.?js\b/i, "nextjs"],
    [/\btypescript\b/i, "typescript"],
    [/\bmongodb\b/i, "mongodb"],
    [/\bpython\b/i, "python"],
    [/\btailwind\b/i, "tailwind"],
    [/\bnode\.?js\b/i, "nodejs"],
    [/\bdocker\b/i, "docker"],
    [/\bkubernetes\b/i, "kubernetes"],
    [/\bgraphql\b/i, "graphql"],
    [/\bpostgres\b/i, "postgres"],
    [/\bredis\b/i, "redis"],
    [/\baws\b/i, "aws"],
    [/\bgcp\b/i, "gcp"],
    [/\bazure\b/i, "azure"],
    [/\brust\b/i, "rust"],
    [/\bgo\b/i, "go"],
    [/\bjava\b/i, "java"],
    [/\bsecurity\b/i, "security"],
    [/\btesting\b/i, "testing"],
    [/\bci[/-]cd\b/i, "ci-cd"],
    [/\baccessibility\b/i, "accessibility"],
    [/\bperformance\b/i, "performance"],
  ];

  for (const [pattern, tag] of toolPatterns) {
    if (pattern.test(content)) {
      tags.add(tag);
    }
  }

  return Array.from(tags).slice(0, 20); // Cap at 20 auto-inferred tags
}

/** Normalize a name from a filename (strip extension, capitalize) */
export function nameFromFilename(filename: string): string {
  return filename
    .replace(/^\./, "") // Remove leading dot (.cursorrules → cursorrules)
    .replace(/\.(md|mdc|json|txt)$/i, "") // Remove extension
    .replace(/[-_]/g, " ") // Dashes/underscores → spaces
    .replace(/\b\w/g, (c) => c.toUpperCase()) // Capitalize words
    .trim();
}

/** Safe JSON parse — returns null on failure */
export function safeJsonParse(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
