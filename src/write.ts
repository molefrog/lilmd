/**
 * Pure line-level mutations for lilmd write commands.
 *
 * Every function takes `srcLines` (the file split on "\n") and returns a new
 * string[] — nothing touches the disk here. The CLI layer owns I/O and the
 * optional --dry-run diff.
 *
 * Line-number conventions match the rest of the codebase:
 *   Section.line_start / line_end  are 1-indexed, inclusive.
 *   srcLines indices are 0-indexed (= line_number - 1).
 */

import type { Section } from "./sections";

// ---- internal helpers -------------------------------------------------------

function firstChildOf(sec: Section, all: Section[]): Section | undefined {
  return all.find((s) => s.parent === sec);
}

/**
 * 0-indexed index of the last line of the section's own body
 * (stops before the first child heading, or at the section's last line).
 */
function bodyEndIdx(sec: Section, all: Section[]): number {
  const child = firstChildOf(sec, all);
  // firstChild.line_start - 2: child.line_start is 1-indexed, so 0-indexed
  // is line_start-1; one line before that is line_start-2.
  return child ? child.line_start - 2 : sec.line_end - 1;
}

/** Shift the heading level on a single source line by `delta`. Clamps 1..6. */
function shiftHeadingLine(line: string, delta: number): string {
  const m = line.match(/^(#{1,6})( .*|$)/);
  if (!m) return line;
  const newLevel = Math.max(1, Math.min(6, m[1]!.length + delta));
  return "#".repeat(newLevel) + m[2]!;
}

// ---- public mutations -------------------------------------------------------

/**
 * Replace the section's own body (between heading and first child) with
 * `bodyLines`. Heading and subsections are preserved unchanged.
 */
export function setSection(
  srcLines: string[],
  sec: Section,
  all: Section[],
  bodyLines: string[],
): string[] {
  const bodyEnd = bodyEndIdx(sec, all);
  // srcLines.slice(0, sec.line_start) keeps indices 0..line_start-1, i.e.
  // all lines up to and including the heading (heading is at line_start-1).
  return [
    ...srcLines.slice(0, sec.line_start),
    ...bodyLines,
    ...srcLines.slice(bodyEnd + 1),
  ];
}

/**
 * Append `lines` immediately after the section's own body, before any
 * child headings (or at the section end if there are none).
 */
export function appendToSection(
  srcLines: string[],
  sec: Section,
  all: Section[],
  lines: string[],
): string[] {
  const bodyEnd = bodyEndIdx(sec, all);
  return [
    ...srcLines.slice(0, bodyEnd + 1),
    ...lines,
    ...srcLines.slice(bodyEnd + 1),
  ];
}

/**
 * Insert `lines` after the entire section subtree (heading + all descendants).
 */
export function insertAfter(
  srcLines: string[],
  sec: Section,
  lines: string[],
): string[] {
  // sec.line_end is 1-indexed; slice(0, line_end) keeps 0..line_end-1 = all
  // lines through the last line of the section.
  return [
    ...srcLines.slice(0, sec.line_end),
    ...lines,
    ...srcLines.slice(sec.line_end),
  ];
}

/** Remove the entire section subtree (heading + body + all descendants). */
export function removeSection(srcLines: string[], sec: Section): string[] {
  return [
    ...srcLines.slice(0, sec.line_start - 1),
    ...srcLines.slice(sec.line_end),
  ];
}

/** Rename the section heading, preserving its level and any leading indent. */
export function renameSection(
  srcLines: string[],
  sec: Section,
  newTitle: string,
): string[] {
  const result = [...srcLines];
  result[sec.line_start - 1] = `${"#".repeat(sec.level)} ${newTitle}`;
  return result;
}

/**
 * Shift the heading level of `sec` and every descendant by `delta`.
 * +1 = demote (deeper), -1 = promote (shallower). Clamps to 1..6.
 *
 * Only lines that look like ATX headings are touched; plain body text is
 * unchanged. Known limitation: heading-like lines *inside fenced code blocks*
 * are also shifted — acceptable for agent-authored markdown where `# ` inside
 * a code fence is uncommon, but callers should be aware.
 */
export function shiftLevel(
  srcLines: string[],
  sec: Section,
  delta: number,
): string[] {
  const result = [...srcLines];
  for (let i = sec.line_start - 1; i <= sec.line_end - 1; i++) {
    result[i] = shiftHeadingLine(result[i]!, delta);
  }
  return result;
}

/**
 * Move `fromSec` to be a child of `toSec`, adjusting heading levels so that
 * fromSec's new level = toSec.level + 1.
 *
 * The inserted block lands after toSec's last line (it becomes the final
 * child in toSec's subtree).
 *
 * Precondition: toSec must not be a descendant of fromSec (caller validates).
 */
export function moveSection(
  srcLines: string[],
  fromSec: Section,
  toSec: Section,
): string[] {
  // 1. Extract and adjust the block.
  const block = srcLines.slice(fromSec.line_start - 1, fromSec.line_end);
  const delta = toSec.level + 1 - fromSec.level;
  const adjusted = block.map((l) => shiftHeadingLine(l, delta));

  // 2. Remove fromSec.
  const afterRemoval = [
    ...srcLines.slice(0, fromSec.line_start - 1),
    ...srcLines.slice(fromSec.line_end),
  ];

  // 3. Recalculate toSec's end position after the removal.
  const removedCount = fromSec.line_end - fromSec.line_start + 1;
  const newToEnd =
    fromSec.line_start <= toSec.line_start
      ? toSec.line_end - removedCount
      : toSec.line_end;

  // 4. Insert the adjusted block after toSec's (new) last line.
  return [
    ...afterRemoval.slice(0, newToEnd),
    ...adjusted,
    ...afterRemoval.slice(newToEnd),
  ];
}

// ---- unified diff -----------------------------------------------------------

/**
 * Produce a single-hunk unified diff for two versions of a file.
 * Returns "" if old and next are identical.
 *
 * Uses a simple prefix/suffix scan to find the changed region; works
 * correctly for all targeted single-region edits (set, append, rm, …).
 * For mv (two disjoint changes) the hunk spans the whole changed region.
 */
export function unifiedDiff(
  old: string[],
  next: string[],
  path: string,
): string {
  const CONTEXT = 3;

  // Find first differing index.
  let lo = 0;
  while (lo < old.length && lo < next.length && old[lo] === next[lo]) lo++;

  if (lo === old.length && lo === next.length) return ""; // identical

  // Find last differing index from the end.
  let oldHi = old.length - 1;
  let newHi = next.length - 1;
  while (oldHi >= lo && newHi >= lo && old[oldHi] === next[newHi]) {
    oldHi--;
    newHi--;
  }

  const ctxLo = Math.max(0, lo - CONTEXT);
  const ctxOldHi = Math.min(old.length - 1, oldHi + CONTEXT);

  const ctxBefore = lo - ctxLo;
  const removedCount = oldHi - lo + 1;
  const addedCount = newHi - lo + 1;
  const ctxAfter = ctxOldHi - oldHi;

  const oldTotal = ctxBefore + removedCount + ctxAfter;
  const newTotal = ctxBefore + addedCount + ctxAfter;

  const lines: string[] = [
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -${ctxLo + 1},${oldTotal} +${ctxLo + 1},${newTotal} @@`,
  ];

  for (let i = ctxLo; i < lo; i++) lines.push(` ${old[i]}`);
  for (let i = lo; i <= oldHi; i++) lines.push(`-${old[i]!}`);
  for (let i = lo; i <= newHi; i++) lines.push(`+${next[i]!}`);
  for (let i = oldHi + 1; i <= ctxOldHi; i++) lines.push(` ${old[i]!}`);

  return lines.join("\n") + "\n";
}
