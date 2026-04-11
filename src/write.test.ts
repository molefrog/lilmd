/**
 * Unit tests for src/write.ts — pure line-level mutation functions.
 *
 * We parse a fixed SRC string into sections once, then exercise each
 * mutation in isolation without touching disk.
 */

import { describe, test, expect } from "bun:test";
import { scan } from "./scan";
import { buildSections, countLines, type Section } from "./sections";
import {
  setSection,
  appendToSection,
  insertAfter,
  removeSection,
  renameSection,
  shiftLevel,
  moveSection,
  unifiedDiff,
} from "./write";

// ---- fixture ----------------------------------------------------------------

const SRC = `# Doc

Intro.

## Alpha

Alpha body.

### Alpha Sub

Sub body.

## Beta

Beta body.

## Gamma

Gamma body.
`;

function parse(src: string) {
  const sections = buildSections(scan(src), countLines(src));
  const srcLines = src.split("\n");
  return { sections, srcLines };
}

function find(sections: Section[], title: string): Section {
  const s = sections.find((x) => x.title === title);
  if (!s) throw new Error(`section "${title}" not found`);
  return s;
}

function joined(lines: string[]): string {
  return lines.join("\n");
}

// ---- setSection -------------------------------------------------------------

describe("setSection", () => {
  test("replaces own body, preserves heading and subsections", () => {
    const { sections, srcLines } = parse(SRC);
    const alpha = find(sections, "Alpha");
    const result = joined(setSection(srcLines, alpha, sections, ["new content"]));
    expect(result).toContain("## Alpha");
    expect(result).toContain("new content");
    expect(result).not.toContain("Alpha body.");
    // subsection must survive
    expect(result).toContain("### Alpha Sub");
    expect(result).toContain("Sub body.");
  });

  test("replaces body of a leaf section", () => {
    const { sections, srcLines } = parse(SRC);
    const alphaSub = find(sections, "Alpha Sub");
    const result = joined(setSection(srcLines, alphaSub, sections, ["replaced"]));
    expect(result).toContain("### Alpha Sub");
    expect(result).toContain("replaced");
    expect(result).not.toContain("Sub body.");
  });

  test("set with empty body removes existing body", () => {
    const { sections, srcLines } = parse(SRC);
    const beta = find(sections, "Beta");
    const result = joined(setSection(srcLines, beta, sections, []));
    expect(result).toContain("## Beta");
    expect(result).not.toContain("Beta body.");
  });
});

// ---- appendToSection --------------------------------------------------------

describe("appendToSection", () => {
  test("adds content after body, before first child", () => {
    const { sections, srcLines } = parse(SRC);
    const alpha = find(sections, "Alpha");
    const result = joined(appendToSection(srcLines, alpha, sections, ["appended"]));
    const alphaIdx = result.indexOf("## Alpha");
    const appendedIdx = result.indexOf("appended");
    const subIdx = result.indexOf("### Alpha Sub");
    expect(appendedIdx).toBeGreaterThan(alphaIdx);
    expect(appendedIdx).toBeLessThan(subIdx);
    // original body still present
    expect(result).toContain("Alpha body.");
  });

  test("adds content to end of leaf section", () => {
    const { sections, srcLines } = parse(SRC);
    const beta = find(sections, "Beta");
    const result = joined(appendToSection(srcLines, beta, sections, ["extra"]));
    expect(result).toContain("Beta body.");
    expect(result).toContain("extra");
    const bodyIdx = result.indexOf("Beta body.");
    const extraIdx = result.indexOf("extra");
    expect(extraIdx).toBeGreaterThan(bodyIdx);
  });
});

// ---- insertAfter ------------------------------------------------------------

describe("insertAfter", () => {
  test("inserts after the full section subtree", () => {
    const { sections, srcLines } = parse(SRC);
    const alpha = find(sections, "Alpha");
    const result = joined(insertAfter(srcLines, alpha, ["## Inserted", "", "New section."]));
    const alphaSubIdx = result.indexOf("### Alpha Sub");
    const insertedIdx = result.indexOf("## Inserted");
    const betaIdx = result.indexOf("## Beta");
    expect(insertedIdx).toBeGreaterThan(alphaSubIdx);
    expect(insertedIdx).toBeLessThan(betaIdx);
  });
});

// ---- removeSection ----------------------------------------------------------

describe("removeSection", () => {
  test("removes heading and body", () => {
    const { sections, srcLines } = parse(SRC);
    const beta = find(sections, "Beta");
    const result = joined(removeSection(srcLines, beta));
    expect(result).not.toContain("## Beta");
    expect(result).not.toContain("Beta body.");
    expect(result).toContain("## Alpha");
    expect(result).toContain("## Gamma");
  });

  test("removes heading, body, and all descendants", () => {
    const { sections, srcLines } = parse(SRC);
    const alpha = find(sections, "Alpha");
    const result = joined(removeSection(srcLines, alpha));
    expect(result).not.toContain("## Alpha");
    expect(result).not.toContain("Alpha body.");
    expect(result).not.toContain("### Alpha Sub");
    expect(result).not.toContain("Sub body.");
    expect(result).toContain("## Beta");
  });
});

// ---- renameSection ----------------------------------------------------------

describe("renameSection", () => {
  test("renames heading, preserving level and body", () => {
    const { sections, srcLines } = parse(SRC);
    const alpha = find(sections, "Alpha");
    const result = joined(renameSection(srcLines, alpha, "Renamed"));
    expect(result).toMatch(/^## Renamed$/m);
    expect(result).not.toMatch(/^## Alpha$/m);
    expect(result).toContain("Alpha body.");
  });

  test("preserves the heading level hashes", () => {
    const { sections, srcLines } = parse(SRC);
    const sub = find(sections, "Alpha Sub");
    const result = joined(renameSection(srcLines, sub, "New Sub"));
    expect(result).toContain("### New Sub");
  });
});

// ---- shiftLevel -------------------------------------------------------------

describe("shiftLevel", () => {
  test("demote (+1) increases hashes on section and descendants", () => {
    const { sections, srcLines } = parse(SRC);
    const alpha = find(sections, "Alpha");
    const result = joined(shiftLevel(srcLines, alpha, +1));
    expect(result).toMatch(/^### Alpha$/m);
    expect(result).toMatch(/^#### Alpha Sub$/m);
    expect(result).not.toMatch(/^## Alpha$/m);
  });

  test("promote (-1) decreases hashes on section and descendants", () => {
    const { sections, srcLines } = parse(SRC);
    const alpha = find(sections, "Alpha");
    const result = joined(shiftLevel(srcLines, alpha, -1));
    expect(result).toContain("# Alpha");
    expect(result).toContain("## Alpha Sub");
    expect(result).not.toMatch(/^## Alpha$/m);
  });

  test("does not modify body text containing # characters", () => {
    const src = `## Section\n\nBody with # hash in text.\n`;
    const sections = buildSections(scan(src), countLines(src));
    const sec = sections[0]!;
    const lines = src.split("\n");
    const result = joined(shiftLevel(lines, sec, +1));
    expect(result).toContain("Body with # hash in text.");
    expect(result).toContain("### Section");
  });

  test("clamps at level 6 (demote)", () => {
    const src = `###### Deep\n\nbody\n`;
    const sections = buildSections(scan(src), countLines(src));
    const sec = sections[0]!;
    const result = joined(shiftLevel(src.split("\n"), sec, +1));
    expect(result).toContain("###### Deep"); // clamped at 6
  });

  test("clamps at level 1 (promote)", () => {
    const src = `# Top\n\nbody\n`;
    const sections = buildSections(scan(src), countLines(src));
    const sec = sections[0]!;
    const result = joined(shiftLevel(src.split("\n"), sec, -1));
    expect(result).toContain("# Top"); // clamped at 1
  });
});

// ---- moveSection ------------------------------------------------------------

describe("moveSection", () => {
  test("moves section to be a child of target (fromSec after toSec)", () => {
    const { sections, srcLines } = parse(SRC);
    const beta = find(sections, "Beta");
    const alpha = find(sections, "Alpha");
    const result = joined(moveSection(srcLines, beta, alpha));
    // Beta should now appear after Alpha Sub (inside Alpha's subtree)
    const alphaIdx = result.indexOf("## Alpha");
    const betaIdx = result.indexOf("### Beta"); // level adjusted
    const gammaIdx = result.indexOf("## Gamma");
    expect(betaIdx).toBeGreaterThan(alphaIdx);
    expect(betaIdx).toBeLessThan(gammaIdx);
    expect(result).not.toMatch(/^## Beta$/m); // old level gone
    expect(result).toContain("Beta body.");
  });

  test("moves section to be a child of target (fromSec before toSec)", () => {
    const { sections, srcLines } = parse(SRC);
    const alphaSub = find(sections, "Alpha Sub");
    const beta = find(sections, "Beta");
    const result = joined(moveSection(srcLines, alphaSub, beta));
    // Alpha Sub should now be inside Beta
    const betaIdx = result.indexOf("## Beta");
    const subIdx = result.indexOf("### Alpha Sub"); // same level — Beta is 2, target child is 3
    expect(subIdx).toBeGreaterThan(betaIdx);
    // Alpha no longer has Alpha Sub
    const alphaIdx = result.indexOf("## Alpha");
    expect(result.indexOf("### Alpha Sub")).toBeGreaterThan(result.indexOf("## Beta"));
    // Alpha's own subsection list is empty now
    expect(result.slice(alphaIdx, result.indexOf("## Beta"))).not.toContain("### Alpha Sub");
  });

  test("adjusts heading levels when moving to a deeper target", () => {
    const { sections, srcLines } = parse(SRC);
    const gamma = find(sections, "Gamma");
    const alphaSub = find(sections, "Alpha Sub");
    // Move Gamma (level 2) under Alpha Sub (level 3) → Gamma becomes level 4
    const result = joined(moveSection(srcLines, gamma, alphaSub));
    expect(result).toMatch(/^#### Gamma$/m);
    expect(result).not.toMatch(/^## Gamma$/m);
  });
});

// ---- unifiedDiff ------------------------------------------------------------

describe("unifiedDiff", () => {
  test("returns empty string for identical arrays", () => {
    expect(unifiedDiff(["a", "b"], ["a", "b"], "f.md")).toBe("");
  });

  test("shows replaced lines with - and +", () => {
    const diff = unifiedDiff(["a", "b", "c"], ["a", "x", "c"], "f.md");
    expect(diff).toContain("-b");
    expect(diff).toContain("+x");
    expect(diff).toContain("--- a/f.md");
    expect(diff).toContain("+++ b/f.md");
    expect(diff).toContain("@@");
  });

  test("includes context lines around changes", () => {
    const old = ["1", "2", "3", "4", "5", "6", "7", "8"];
    const next = ["1", "2", "3", "X", "5", "6", "7", "8"];
    const diff = unifiedDiff(old, next, "f.md");
    // Context before and after the change
    expect(diff).toContain(" 3");
    expect(diff).toContain(" 5");
    expect(diff).toContain("-4");
    expect(diff).toContain("+X");
  });

  test("handles insertions (new lines added)", () => {
    const diff = unifiedDiff(["a", "c"], ["a", "b", "c"], "f.md");
    expect(diff).toContain("+b");
    expect(diff).not.toContain("-b");
  });

  test("handles deletions", () => {
    const diff = unifiedDiff(["a", "b", "c"], ["a", "c"], "f.md");
    expect(diff).toContain("-b");
    expect(diff).not.toContain("+b");
  });

  test("change at the very first line — no context before", () => {
    const diff = unifiedDiff(["X", "b", "c"], ["Y", "b", "c"], "f.md");
    expect(diff).toContain("-X");
    expect(diff).toContain("+Y");
    expect(diff).toContain("@@ -1,");
  });

  test("change at the very last line — no context after", () => {
    const diff = unifiedDiff(["a", "b", "X"], ["a", "b", "Y"], "f.md");
    expect(diff).toContain("-X");
    expect(diff).toContain("+Y");
  });

  test("full-file replacement", () => {
    const diff = unifiedDiff(["old"], ["new"], "f.md");
    expect(diff).toContain("-old");
    expect(diff).toContain("+new");
  });

  test("output ends with a newline", () => {
    const diff = unifiedDiff(["a"], ["b"], "f.md");
    expect(diff.endsWith("\n")).toBe(true);
  });
});
