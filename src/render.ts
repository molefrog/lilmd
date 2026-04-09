/**
 * Output formatting for lilmd.
 *
 * Two targets today: `renderToc` for the TOC view and `renderSection` for a
 * single section read. Both emit grep-friendly plain text with stable
 * delimiters that agents can split on.
 *
 * A future `--json` pipeline lives in cli.ts; the shapes (Heading, Section)
 * are already JSON-clean so it's a direct serialization.
 */

import type { Section } from "./sections";
import { countLines } from "./sections";
import type { PrettyFormatter } from "./pretty";

export type TocOptions = {
  depth?: number;
  flat?: boolean;
};

export function renderToc(
  file: string,
  src: string,
  sections: Section[],
  opts: TocOptions,
): string {
  const totalLines = countLines(src);
  const headerCount = sections.length;
  const headerRange = totalLines === 0 ? "L0" : `L1-${totalLines}`;
  const plural = headerCount === 1 ? "heading" : "headings";

  const out: string[] = [];
  out.push(`${file}  ${headerRange}  ${headerCount} ${plural}`);

  for (const sec of sections) {
    if (opts.depth != null && sec.level > opts.depth) continue;
    const indent = opts.flat ? "" : "  ".repeat(Math.max(0, sec.level - 1));
    const hashes = "#".repeat(sec.level);
    const range = `L${sec.line_start}-${sec.line_end}`;
    out.push(`${indent}${hashes} ${sec.title}  ${range}`);
  }
  return out.join("\n");
}

export type SectionOptions = {
  bodyOnly?: boolean;
  noBody?: boolean;
  raw?: boolean;
  maxLines?: number;
  /** Required when bodyOnly is true so we can find the first child. */
  allSections?: Section[];
  /** Optional markdown→ANSI formatter applied to the body before delimiters. */
  pretty?: PrettyFormatter;
};

export function renderSection(
  file: string,
  srcLines: string[],
  sec: Section,
  opts: SectionOptions,
): string {
  const start = sec.line_start;
  let end = sec.line_end;

  if (opts.bodyOnly && opts.allSections) {
    const firstChild = findFirstChild(sec, opts.allSections);
    if (firstChild) end = firstChild.line_start - 1;
  }

  if (opts.noBody) {
    end = start;
  }

  // Clamp to source length so a stale `line_end` (e.g. countLines and
  // splitLines disagreeing on a trailing newline) can't overrun.
  const clampedEnd = Math.min(end, srcLines.length);
  let body = srcLines.slice(start - 1, clampedEnd).join("\n");

  // Truncate before pretty-printing so ANSI escapes can't land mid-cut.
  if (opts.maxLines != null && opts.maxLines > 0) {
    body = truncateBody(body, opts.maxLines);
  }

  if (opts.pretty) {
    body = opts.pretty(body);
  }

  if (opts.raw) return body;

  const hashes = "#".repeat(sec.level);
  const header = `── ${file}  L${start}-${end}  ${hashes} ${sec.title} ${"─".repeat(8)}`;
  const footer = `── end ${"─".repeat(40)}`;
  return `${header}\n${body}\n${footer}`;
}

/**
 * Cut `body` to the first `maxLines` lines. If anything was dropped, append
 * a marker line telling the agent how to get the rest. `maxLines <= 0`
 * disables truncation.
 */
export function truncateBody(body: string, maxLines: number): string {
  if (maxLines <= 0) return body;
  const lines = body.split("\n");
  if (lines.length <= maxLines) return body;
  const kept = lines.slice(0, maxLines).join("\n");
  const remaining = lines.length - maxLines;
  return `${kept}\n\n… ${remaining} more lines (use --max-lines=0 for full)`;
}

function findFirstChild(sec: Section, all: Section[]): Section | null {
  for (const candidate of all) {
    if (candidate.parent === sec) return candidate;
  }
  return null;
}
