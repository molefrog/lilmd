/**
 * Turn a flat list of headings into a section tree with line ranges and
 * parent links.
 *
 * Each Section covers its heading line through the line before the next
 * heading at the same-or-higher level (or the end of the file if none).
 * That's the "whole subtree" range — it includes the section's body *and*
 * its descendants. `--body-only` rendering is derived at render time.
 */

import type { Heading } from "./scan";

export type Section = {
  level: number;
  title: string;
  /** 1-indexed line of the heading itself. */
  line_start: number;
  /** 1-indexed inclusive end of the subtree. */
  line_end: number;
  /** Nearest enclosing section, or null for top-level. */
  parent: Section | null;
};

/**
 * Build the section tree in a single pass. Preserves document order.
 *
 * Runs in O(n): every section is pushed once and popped once, and we set
 * its `line_end` at pop time. Sections still on the stack when we run out
 * of headings keep their provisional `line_end = totalLines`.
 */
export function buildSections(headings: Heading[], totalLines: number): Section[] {
  const out: Section[] = [];
  /** Ancestors whose subtree is still open. */
  const stack: Section[] = [];

  for (const h of headings) {
    // Every section on the stack with the same-or-shallower level closes at
    // h.line - 1 (the line before the new heading).
    while (stack.length > 0 && stack[stack.length - 1]!.level >= h.level) {
      const closing = stack.pop()!;
      closing.line_end = h.line - 1;
    }
    const parent = stack.length > 0 ? stack[stack.length - 1]! : null;

    const sec: Section = {
      level: h.level,
      title: h.title,
      line_start: h.line,
      // Provisional: if nothing closes this section we leave it at totalLines.
      line_end: totalLines,
      parent,
    };
    out.push(sec);
    stack.push(sec);
  }

  return out;
}

/**
 * Walk `sec` up to the root, collecting ancestor titles in top-down order.
 * Returns [] for a root section.
 */
export function pathOf(sec: Section): string[] {
  const path: string[] = [];
  let cur = sec.parent;
  while (cur) {
    path.push(cur.title);
    cur = cur.parent;
  }
  return path.reverse();
}

/**
 * Count lines in a source string. Empty string is 0; otherwise every line
 * (including the last one, whether or not it ends with a newline) is 1.
 * A trailing newline does NOT add a phantom line.
 */
export function countLines(src: string): number {
  if (src.length === 0) return 0;
  let n = 1;
  for (let i = 0; i < src.length; i++) {
    if (src.charCodeAt(i) === 10) n++;
  }
  // If the source ends with a newline, the line-count should equal the
  // number of newlines (not newlines + 1) since the final "line" is empty.
  if (src.charCodeAt(src.length - 1) === 10) n--;
  return n;
}
