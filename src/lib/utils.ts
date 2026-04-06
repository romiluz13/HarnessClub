/**
 * Shared utility functions.
 *
 * Per api-security-best-practices: escape user input before regex compilation.
 * Prevents regex injection (ReDoS) attacks.
 */

/**
 * Escape special regex characters in a string.
 * Use this BEFORE passing any user input to `new RegExp()` or `$regex`.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
