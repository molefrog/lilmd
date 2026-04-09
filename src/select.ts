/**
 * Selector grammar parser and matcher.
 *
 *   SELECTOR := SEGMENT ( SEP SEGMENT )*
 *   SEP      := ">"                      (descendant, any depth)
 *             | ">>"                     (direct child)
 *   SEGMENT  := LEVEL? MATCHER
 *   LEVEL    := "#"{1,6}                 (optional level filter)
 *   MATCHER  := TEXT                      (fuzzy, case-insensitive substring)
 *             | "=" TEXT                  (exact, case-insensitive equality)
 *             | "/" PATTERN "/" FLAGS?    (JS regex; defaults to /.../i)
 *
 * Matching semantics:
 * - The *last* segment must match the candidate section itself.
 * - Earlier segments must match an ancestor chain walking upward from that
 *   candidate, respecting each separator between them: `A >> B` requires A
 *   to be B's *immediate* parent; `A > B` only requires A to be *some*
 *   ancestor of B.
 */

import type { Section } from "./sections";

export type Op = "descendant" | "child";
export type Kind = "fuzzy" | "exact" | "regex";

export type Segment = {
  /** Operator that connects this segment to the *previous* one.
   *  For the first segment this is always "descendant" (unused). */
  op: Op;
  /** Optional 1..6 level filter. */
  level: number | null;
  kind: Kind;
  /** The raw value (without level/kind prefix). */
  value: string;
  /** Present only for kind === "regex". */
  regex?: RegExp;
};

export function parseSelector(input: string): Segment[] {
  const trimmed = input.trim();
  if (trimmed.length === 0) return [];

  // Split on > / >>. We walk the string character by character so we can
  // distinguish the two operators without confusing a `>>` with two
  // consecutive `>`s. We intentionally ignore `>` that appear inside a
  // regex delimiter pair because users may write `/a>b/`.
  //
  // `atSegmentStart` tracks whether the running buffer is still whitespace
  // only — only in that state can a `/` open a regex literal. Using
  // `cur.length === 0` instead is wrong because `>` splits leave the loop
  // pointing at a leading space that then lands in `cur` before the next
  // non-space char.
  const rawSegments: string[] = [];
  const ops: Op[] = ["descendant"];
  let cur = "";
  let i = 0;
  let inRegex = false;
  let atSegmentStart = true;
  while (i < trimmed.length) {
    const ch = trimmed[i];
    if (ch === "/" && (atSegmentStart || inRegex)) {
      inRegex = !inRegex;
      cur += ch;
      atSegmentStart = false;
      i++;
      continue;
    }
    if (!inRegex && ch === ">") {
      rawSegments.push(cur.trim());
      cur = "";
      atSegmentStart = true;
      if (trimmed[i + 1] === ">") {
        ops.push("child");
        i += 2;
      } else {
        ops.push("descendant");
        i += 1;
      }
      continue;
    }
    cur += ch;
    if (ch !== " " && ch !== "\t") atSegmentStart = false;
    i++;
  }
  rawSegments.push(cur.trim());

  return rawSegments.map((s, idx) => parseSegment(s, ops[idx] ?? "descendant"));
}

function parseSegment(raw: string, op: Op): Segment {
  let s = raw;
  let level: number | null = null;

  // Level prefix — exactly 1..6 `#`s followed by something that is NOT
  // another `#`. The negative lookahead matters: without it, "#######foo"
  // would silently match level=6 value="#foo".
  const levelMatch = /^(#{1,6})(?!#)\s*(.*)$/.exec(s);
  if (levelMatch) {
    level = levelMatch[1]!.length;
    s = levelMatch[2] ?? "";
  }

  // Regex literal: /pattern/flags — flags default to "i".
  const regexMatch = /^\/(.+)\/([gimsuy]*)$/.exec(s);
  if (regexMatch) {
    const pattern = regexMatch[1]!;
    const flags = regexMatch[2] || "i";
    return {
      op,
      level,
      kind: "regex",
      value: pattern,
      regex: new RegExp(pattern, flags),
    };
  }

  // Exact match: =value.
  if (s.startsWith("=")) {
    return { op, level, kind: "exact", value: s.slice(1).trim() };
  }

  return { op, level, kind: "fuzzy", value: s.trim() };
}

export function match(sections: Section[], selector: Segment[]): Section[] {
  if (selector.length === 0) return [];
  const out: Section[] = [];
  for (const sec of sections) {
    if (matches(sec, selector)) out.push(sec);
  }
  return out;
}

function matches(sec: Section, segs: Segment[]): boolean {
  // Last segment matches the candidate itself.
  const last = segs[segs.length - 1];
  if (!last || !segmentMatchesSection(last, sec)) return false;

  // Walk the ancestor chain backward alongside the earlier segments.
  let cursor: Section | null = sec.parent;
  for (let i = segs.length - 2; i >= 0; i--) {
    // The separator BEFORE segs[i+1] is stored on segs[i+1].op; that's the
    // relationship we need to honor when walking from segs[i+1] back to
    // segs[i] in the ancestor chain.
    const op = segs[i + 1]!.op;
    const seg = segs[i]!;

    if (op === "child") {
      if (!cursor || !segmentMatchesSection(seg, cursor)) return false;
      cursor = cursor.parent;
    } else {
      // Descendant: find any matching ancestor.
      let found: Section | null = null;
      while (cursor) {
        if (segmentMatchesSection(seg, cursor)) {
          found = cursor;
          break;
        }
        cursor = cursor.parent;
      }
      if (!found) return false;
      cursor = found.parent;
    }
  }
  return true;
}

function segmentMatchesSection(seg: Segment, sec: Section): boolean {
  if (seg.level !== null && seg.level !== sec.level) return false;
  const title = sec.title;
  switch (seg.kind) {
    case "exact":
      return title.toLowerCase() === seg.value.toLowerCase();
    case "regex":
      return seg.regex!.test(title);
    case "fuzzy":
      return title.toLowerCase().includes(seg.value.toLowerCase());
  }
}
