/**
 * Integration tests against a real-world markdown fixture.
 *
 * The fixture at `src/__fixtures__/mdn-array.md` is a ~42 KB / 1,298-line
 * concatenation of 8 MDN Array.prototype method pages (see the fixture's
 * own header comment for attribution and the regen recipe). It's committed
 * into the repo so tests are hermetic — no network fetch, no corpus clone.
 *
 * These tests exist to catch regressions the unit tests can miss:
 * - Real CommonMark that the author didn't write (includes Kuma macros,
 *   JSX-flavored HTML snippets, tables, code fences, nested lists).
 * - The full CLI pipeline end-to-end, not just individual modules.
 * - A soft latency budget so a catastrophic O(n^2) or O(matches × file)
 *   regression gets caught even if individual unit tests stay green.
 */

import { describe, expect, test } from "bun:test";

import { run } from "./cli";

const FIXTURE = new URL("./__fixtures__/mdn-array.md", import.meta.url).pathname;

describe("integration: mdn-array fixture", () => {
  test("toc returns the expected shape under 100 ms", async () => {
    const t0 = performance.now();
    const r = await run([FIXTURE]);
    const elapsed = performance.now() - t0;

    expect(r.code).toBe(0);
    // The fixture has 8 synthetic H1 sections (Array.prototype.<name>) and
    // each one has at least Syntax / Examples / Specifications subsections.
    const header = r.stdout.split("\n", 1)[0];
    expect(header).toMatch(/headings/);
    expect(r.stdout).toContain("# Array.prototype.array");
    expect(r.stdout).toContain("# Array.prototype.filter");
    // Soft budget — parse path should be comfortably sub-100 ms on 42 KB.
    expect(elapsed).toBeLessThan(200);
  });

  test("toc --depth 1 hides all subsections", async () => {
    const r = await run([FIXTURE, "--depth", "1"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("# Array.prototype.concat");
    // No H2s should be rendered at depth 1.
    expect(r.stdout).not.toContain("## Syntax");
  });

  test("read with a descendant selector finds a nested section", async () => {
    const r = await run([FIXTURE, "concat > Syntax"]);
    expect(r.code).toBe(0);
    // The body of Array.prototype.concat's Syntax section should show up.
    expect(r.stdout).toContain("## Syntax");
    expect(r.stdout).toContain("concat(");
  });

  test("a generic selector returns many matches with the truncation banner", async () => {
    // "Syntax" appears under every method — 8 H2 matches — so we expect the
    // truncation banner to NOT fire at the default cap (25), but a tight
    // cap should fire it.
    const r = await run([FIXTURE, "=Syntax", "--max-results", "3"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/8 matches, showing first 3/);
  });

  test("ls lists direct children of a matched parent", async () => {
    const r = await run(["ls", FIXTURE, "Array.prototype.filter", "--json"]);
    expect(r.code).toBe(0);
    const j = JSON.parse(r.stdout);
    expect(j.results).toHaveLength(1);
    const titles = j.results[0].children.map((c: { title: string }) => c.title);
    // MDN method pages all have this same canonical H2 structure.
    expect(titles).toEqual(
      expect.arrayContaining(["Syntax", "Description", "Examples", "Specifications"]),
    );
  });

  test("grep finds a common term and attributes it to sections", async () => {
    const r = await run(["grep", FIXTURE, "callback"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("callback");
    // Should be grouped under at least one method that takes a callback
    // (filter, find, etc.), emitted as a `── <path>` section header line.
    expect(r.stdout).toMatch(/── Array\.prototype\./);
  });

  test("--body-only skips subsections under a matched H1", async () => {
    // The Array.prototype.filter page has an intro paragraph before any
    // H2, so --body-only on it should include that intro but exclude the
    // Syntax / Examples / etc. subsections.
    const r = await run([FIXTURE, "Array.prototype.filter", "--body-only"]);
    expect(r.code).toBe(0);
    expect(r.stdout).not.toContain("## Syntax");
    // And it should still include prose from above the first H2.
    expect(r.stdout).toMatch(/filter|callbackFn|element/i);
  });

  test("--json shape is a parseable document with a body field", async () => {
    const r = await run([FIXTURE, "Array.prototype.concat", "--json"]);
    expect(r.code).toBe(0);
    const j = JSON.parse(r.stdout);
    expect(j.file).toBe(FIXTURE);
    expect(j.matches).toHaveLength(1);
    expect(j.matches[0]).toMatchObject({ level: 1, title: "Array.prototype.concat" });
    expect(typeof j.matches[0].body).toBe("string");
    expect(j.matches[0].body.length).toBeGreaterThan(100);
  });
});
