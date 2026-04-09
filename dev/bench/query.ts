/**
 * End-to-end benchmark of the actual `mdq` read flow:
 *
 *   1. parse file -> list of headings with { level, title, line_start }
 *   2. compute each heading's line_end = (next heading at same-or-higher
 *      level).line_start - 1
 *   3. pick one section by fuzzy title match
 *   4. slice its body out of the original source by line range
 *
 * This is what matters to the CLI: total time to answer `mdq read file.md "X"`.
 * Pure parse speed is necessary-but-not-sufficient because section slicing
 * adds its own overhead.
 *
 * Also includes a "hand-rolled scanner" baseline that ignores markdown
 * structure entirely and just walks lines looking for ATX headings. It's the
 * theoretical lower bound — zero parser, zero AST, zero tokens.
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { fromMarkdown } from "mdast-util-from-markdown";
import MarkdownIt from "markdown-it";

const FIXTURES_DIR = new URL("../fixtures", import.meta.url).pathname;
const RESULTS = new URL("../results/query.json", import.meta.url).pathname;

type Heading = { level: number; title: string; line_start: number };
type Section = Heading & { line_end: number };

function sectionsFromHeadings(headings: Heading[], totalLines: number): Section[] {
  const out: Section[] = [];
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    let end = totalLines;
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= h.level) {
        end = headings[j].line_start - 1;
        break;
      }
    }
    out.push({ ...h, line_end: end });
  }
  return out;
}

function findSection(sections: Section[], needle: string): Section | null {
  const q = needle.toLowerCase();
  for (const s of sections) if (s.title.toLowerCase().includes(q)) return s;
  return null;
}

function sliceLines(src: string, start: number, end: number): string {
  // 1-indexed, inclusive.
  const lines = src.split("\n");
  return lines.slice(start - 1, end).join("\n");
}

// ---- Parser adapters ---------------------------------------------------

function headingsViaMdast(src: string): Heading[] {
  const tree = fromMarkdown(src);
  const out: Heading[] = [];
  for (const node of tree.children) {
    if (node.type === "heading") {
      const title =
        node.children
          .map((c) => (c.type === "text" ? c.value : ""))
          .join("")
          .trim() || "";
      out.push({ level: node.depth, title, line_start: node.position?.start.line ?? -1 });
    }
  }
  return out;
}

const mdIt = new MarkdownIt();
function headingsViaMarkdownIt(src: string): Heading[] {
  const tokens = mdIt.parse(src, {});
  const out: Heading[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "heading_open") {
      const inline = tokens[i + 1];
      const title = inline?.content ?? "";
      const level = Number(t.tag.slice(1));
      const line = (t.map?.[0] ?? -1) + 1;
      out.push({ title, level, line_start: line });
    }
  }
  return out;
}

/**
 * Hand-rolled line scanner. Recognizes ATX headings only (# … ######),
 * ignoring setext and ignoring fenced code blocks so '#'-lines inside code
 * aren't mistaken for headings. This is the absolute floor of what `mdq`
 * could be if we bypass parser libraries.
 */
function headingsViaScanner(src: string): Heading[] {
  const out: Heading[] = [];
  const len = src.length;
  let lineNo = 1;
  let inFence = false;
  let fenceChar = "";
  let fenceLen = 0;
  let i = 0;
  while (i < len) {
    // Read one line.
    const start = i;
    while (i < len && src.charCodeAt(i) !== 10 /* \n */) i++;
    const line = src.slice(start, i);
    // Track fenced code blocks so in-code '#' don't count.
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const ch = fenceMatch[1][0];
      const n = fenceMatch[1].length;
      if (!inFence) {
        inFence = true;
        fenceChar = ch;
        fenceLen = n;
      } else if (ch === fenceChar && n >= fenceLen) {
        inFence = false;
      }
    } else if (!inFence) {
      // ATX heading: up to 3 leading spaces, 1-6 hashes, then space or end.
      const m = /^ {0,3}(#{1,6})([ \t].*|\s*)$/.exec(line);
      if (m) {
        const level = m[1].length;
        // Strip trailing closing hashes + surrounding space.
        const raw = m[2].trim();
        const title = raw.replace(/\s*#+\s*$/, "").trim();
        out.push({ level, title, line_start: lineNo });
      }
    }
    lineNo++;
    i++; // skip \n
  }
  return out;
}

// ---- Benchmark harness -------------------------------------------------

type Size = "small" | "medium" | "large";
const FIXTURES: Size[] = ["small", "medium", "large"];

type Strategy = {
  name: string;
  skip: Size[];
  run: (src: string, needle: string) => { section: Section | null; body: string | null };
};

const strategies: Strategy[] = [
  {
    name: "scanner (hand-rolled)",
    skip: [],
    run: (src, needle) => {
      const totalLines = src.split("\n").length;
      const sections = sectionsFromHeadings(headingsViaScanner(src), totalLines);
      const section = findSection(sections, needle);
      const body = section ? sliceLines(src, section.line_start, section.line_end) : null;
      return { section, body };
    },
  },
  {
    name: "markdown-it",
    skip: [],
    run: (src, needle) => {
      const totalLines = src.split("\n").length;
      const sections = sectionsFromHeadings(headingsViaMarkdownIt(src), totalLines);
      const section = findSection(sections, needle);
      const body = section ? sliceLines(src, section.line_start, section.line_end) : null;
      return { section, body };
    },
  },
  {
    name: "mdast-util-from-markdown",
    skip: ["large"],
    run: (src, needle) => {
      const totalLines = src.split("\n").length;
      const sections = sectionsFromHeadings(headingsViaMdast(src), totalLines);
      const section = findSection(sections, needle);
      const body = section ? sliceLines(src, section.line_start, section.line_end) : null;
      return { section, body };
    },
  },
];

const NEEDLE = "Array"; // reasonably common in MDN JS docs
const ITERS: Record<Size, number> = { small: 100, medium: 20, large: 5 };
const WALL_BUDGET_MS = 6_000;

type Row = {
  fixture: Size;
  size_mb: number;
  strategy: string;
  iterations: number;
  median_ms: number | null;
  min_ms: number | null;
  mb_per_s: number | null;
  first_match: string | null;
  body_bytes: number | null;
  status: "ok" | "skipped" | "error" | "no-match";
  note?: string;
};

const results: Row[] = [];
const writeResults = () => Bun.write(RESULTS, JSON.stringify(results, null, 2));

for (const fx of FIXTURES) {
  const path = join(FIXTURES_DIR, `${fx}.md`);
  const size = statSync(path).size;
  const sizeMb = size / 1024 / 1024;
  const src = readFileSync(path, "utf8");
  console.log(`\n=== ${fx}  ${sizeMb.toFixed(2)} MB  needle=${JSON.stringify(NEEDLE)} ===`);

  for (const s of strategies) {
    const base = { fixture: fx, size_mb: +sizeMb.toFixed(2), strategy: s.name };
    if (s.skip.includes(fx)) {
      results.push({
        ...base,
        iterations: 0,
        median_ms: null,
        min_ms: null,
        mb_per_s: null,
        first_match: null,
        body_bytes: null,
        status: "skipped",
        note: "skipped — known too slow at this size",
      });
      console.log(`  ${s.name.padEnd(26)}  skipped`);
      await writeResults();
      continue;
    }

    let firstMatch: Section | null = null;
    let bodyBytes = 0;
    try {
      const r0 = s.run(src, NEEDLE); // warmup + correctness
      firstMatch = r0.section;
      bodyBytes = r0.body ? Buffer.byteLength(r0.body) : 0;
    } catch (err) {
      results.push({
        ...base,
        iterations: 0,
        median_ms: null,
        min_ms: null,
        mb_per_s: null,
        first_match: null,
        body_bytes: null,
        status: "error",
        note: (err as Error).message,
      });
      console.log(`  ${s.name.padEnd(26)}  ERROR  ${(err as Error).message}`);
      await writeResults();
      continue;
    }

    const times: number[] = [];
    const start = Bun.nanoseconds();
    const budgetNs = BigInt(WALL_BUDGET_MS) * 1_000_000n;
    let iterations = 0;
    while (iterations < ITERS[fx]) {
      if (BigInt(Bun.nanoseconds() - start) > budgetNs) break;
      const t0 = Bun.nanoseconds();
      s.run(src, NEEDLE);
      times.push(Bun.nanoseconds() - t0);
      iterations++;
    }
    times.sort((a, b) => a - b);
    const trim = times.slice(0, Math.max(1, Math.floor(times.length / 2)));
    const mean = trim.reduce((a, b) => a + b, 0) / trim.length;
    const meanMs = mean / 1e6;
    const minMs = times[0] / 1e6;
    const mbps = sizeMb / (meanMs / 1000);

    results.push({
      ...base,
      iterations,
      median_ms: +meanMs.toFixed(3),
      min_ms: +minMs.toFixed(3),
      mb_per_s: +mbps.toFixed(1),
      first_match: firstMatch ? `L${firstMatch.line_start}-${firstMatch.line_end} · ${firstMatch.title}` : null,
      body_bytes: bodyBytes,
      status: firstMatch ? "ok" : "no-match",
    });

    console.log(
      `  ${s.name.padEnd(26)} ${meanMs.toFixed(2).padStart(10)} ms  ` +
        `(min ${minMs.toFixed(2).padStart(8)} ms)  ` +
        `${mbps.toFixed(1).padStart(6)} MB/s  ` +
        `${iterations} iters  ` +
        `body=${bodyBytes}B  ` +
        `${firstMatch ? `"${firstMatch.title}" L${firstMatch.line_start}-${firstMatch.line_end}` : "(no match)"}`,
    );
    await writeResults();
  }
}

console.log(`\nWrote ${RESULTS}`);
