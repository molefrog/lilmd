/**
 * Position-preservation correctness test.
 *
 * Given a hand-crafted fixture with known line numbers, verify that each
 * position-claiming parser reports heading line numbers that match reality.
 *
 * The `mdq` feature `L<start>-<end>` hinges entirely on this, so getting a
 * wrong line number by +/- 1 is a correctness bug, not a style preference.
 */

import { fromMarkdown } from "mdast-util-from-markdown";
import MarkdownIt from "markdown-it";

const fixture = [
  "# Root", //              line 1
  "", //                     line 2
  "Intro paragraph.", //      line 3
  "", //                     line 4
  "## Alpha", //              line 5
  "", //                     line 6
  "alpha body", //            line 7
  "", //                     line 8
  "### Alpha sub", //         line 9
  "", //                     line 10
  "x", //                     line 11
  "", //                     line 12
  "## Beta", //               line 13
  "", //                     line 14
  "beta body", //             line 15
  "", //                     line 16
  "```js", //                 line 17
  "// fenced", //             line 18
  "```", //                   line 19
  "", //                     line 20
  "## Gamma", //              line 21
  "",
  "- list item",
  "- another",
  "",
  "#### Deep", //             line 26
  "",
  "end.",
].join("\n");

// Expected start lines for each heading, in document order.
const expected: { title: string; level: number; line: number }[] = [
  { title: "Root", level: 1, line: 1 },
  { title: "Alpha", level: 2, line: 5 },
  { title: "Alpha sub", level: 3, line: 9 },
  { title: "Beta", level: 2, line: 13 },
  { title: "Gamma", level: 2, line: 21 },
  { title: "Deep", level: 4, line: 26 },
];

type Heading = { title: string; level: number; line: number };

function viaMdast(src: string): Heading[] {
  const tree = fromMarkdown(src);
  const out: Heading[] = [];
  for (const node of tree.children) {
    if (node.type === "heading") {
      const title = (node.children[0] as { value?: string })?.value ?? "";
      out.push({
        title,
        level: node.depth,
        line: node.position?.start.line ?? -1,
      });
    }
  }
  return out;
}

function viaMarkdownIt(src: string): Heading[] {
  const md = new MarkdownIt();
  const tokens = md.parse(src, {});
  const out: Heading[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "heading_open") {
      const inline = tokens[i + 1];
      const title = inline?.content ?? "";
      const level = Number(t.tag.slice(1)); // h2 -> 2
      // token.map is a [startLine, endLine] 0-indexed half-open range.
      const line = (t.map?.[0] ?? -1) + 1;
      out.push({ title, level, line });
    }
  }
  return out;
}

function diff(actual: Heading[], expected: Heading[]) {
  const n = Math.max(actual.length, expected.length);
  const errors: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = actual[i];
    const e = expected[i];
    if (!a || !e || a.title !== e.title || a.level !== e.level || a.line !== e.line) {
      errors.push(`  #${i}  expected ${JSON.stringify(e)}  got ${JSON.stringify(a)}`);
    }
  }
  return errors;
}

const cases: [string, (s: string) => Heading[]][] = [
  ["mdast-util-from-markdown", viaMdast],
  ["markdown-it", viaMarkdownIt],
];

let ok = true;
for (const [name, fn] of cases) {
  const actual = fn(fixture);
  const errs = diff(actual, expected);
  if (errs.length === 0) {
    console.log(`PASS  ${name}  (${actual.length} headings, all positions correct)`);
  } else {
    ok = false;
    console.log(`FAIL  ${name}`);
    for (const e of errs) console.log(e);
  }
}

if (!ok) process.exit(1);
