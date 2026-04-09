/**
 * CLI-level integration tests. We call the exported `run(argv)` function
 * directly instead of spawning a subprocess — faster, easier to diff
 * output, and still exercises every branch. A separate spawn-based smoke
 * test for stdin and the `bin/lilmd.ts` entry lives in `integration.test.ts`.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { run } from "./cli";

let dir: string;
let file: string;
const SRC = `# lilmd

Intro paragraph.

## Getting Started

Steps:

### Install

brew install lilmd

### Setup

run it.

## API

API section.

### read

Reads a section.

## Community

Talk to us.
`;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "lilmd-cli-test-"));
  file = join(dir, "doc.md");
  writeFileSync(file, SRC);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("cli: help", () => {
  test("no args prints help with exit 0", async () => {
    const r = await run([]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Usage:");
    expect(r.stdout).toContain("Selector grammar");
  });

  test("--help prints help", async () => {
    const r = await run(["--help"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Usage:");
  });
});

describe("cli: toc (positional form)", () => {
  test("single positional is interpreted as toc", async () => {
    const r = await run([file]);
    expect(r.code).toBe(0);
    expect(r.stdout.split("\n")[0]).toContain("headings");
    expect(r.stdout).toContain("# lilmd");
    expect(r.stdout).toContain("## Getting Started");
    expect(r.stdout).toContain("### Install");
  });

  test("--depth filters deeper headings", async () => {
    const r = await run([file, "--depth", "2"]);
    expect(r.stdout).toContain("## Getting Started");
    expect(r.stdout).not.toContain("### Install");
  });

  test("--flat removes indentation", async () => {
    const r = await run([file, "--flat"]);
    const dataLines = r.stdout.split("\n").slice(1);
    for (const l of dataLines) expect(l).not.toMatch(/^ /);
  });

  test("--json emits structured output", async () => {
    const r = await run([file, "--json"]);
    const j = JSON.parse(r.stdout);
    expect(j.file).toBe(file);
    expect(j.headings.length).toBeGreaterThan(0);
    expect(j.headings[0]).toMatchObject({ level: 1, title: "lilmd" });
  });
});

describe("cli: read (positional form alias)", () => {
  test("two positionals is interpreted as read", async () => {
    const r = await run([file, "Install"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("### Install");
    expect(r.stdout).toContain("brew install lilmd");
  });

  test("descendant chain narrows results", async () => {
    const r = await run([file, "API > read"]);
    expect(r.stdout).toContain("Reads a section.");
    expect(r.stdout).not.toContain("brew install lilmd");
  });

  test("direct child succeeds for immediate parent", async () => {
    const r = await run([file, "API >> read"]);
    expect(r.stdout).toContain("Reads a section.");
  });

  test("level filter matches only that level", async () => {
    const r = await run([file, "##API"]);
    expect(r.stdout).toContain("## API");
    expect(r.stdout).toContain("API section.");
  });

  test("no match prints friendly message and exits 1", async () => {
    const r = await run([file, "does-not-exist"]);
    expect(r.code).toBe(1);
    expect(r.stdout).toMatch(/no match/i);
  });

  test("no match with --json emits empty matches array and exits 1", async () => {
    const r = await run([file, "does-not-exist", "--json"]);
    expect(r.code).toBe(1);
    const j = JSON.parse(r.stdout);
    expect(j.matches).toEqual([]);
    expect(j.truncated).toBe(false);
    expect(j.file).toBe(file);
  });

  test("--body-only stops before first child", async () => {
    const r = await run([file, "Getting Started", "--body-only"]);
    expect(r.stdout).toContain("Steps:");
    expect(r.stdout).not.toContain("brew install lilmd");
  });

  test("--no-body prints only the heading", async () => {
    const r = await run([file, "Install", "--no-body"]);
    expect(r.stdout).toContain("### Install");
    expect(r.stdout).not.toContain("brew install");
  });

  test("--raw drops delimiters", async () => {
    const r = await run([file, "Install", "--raw"]);
    expect(r.stdout).not.toMatch(/── /);
  });

  test("--max-lines truncates long bodies", async () => {
    const r = await run([file, "lilmd", "--max-lines", "3"]);
    expect(r.stdout).toContain("more lines");
  });

  test("--json emits match objects with body", async () => {
    const r = await run([file, "Install", "--json"]);
    const j = JSON.parse(r.stdout);
    expect(j.matches[0]).toMatchObject({ level: 3, title: "Install" });
    expect(j.matches[0].body).toContain("brew install lilmd");
  });

  test("explicit 'read' subcommand works", async () => {
    const r = await run(["read", file, "Install"]);
    expect(r.stdout).toContain("brew install lilmd");
  });

  test("--pretty renders section with ANSI styling", async () => {
    // FORCE_COLOR=1 makes chalk emit ANSI outside a TTY; restore on teardown.
    const prev = process.env.FORCE_COLOR;
    process.env.FORCE_COLOR = "1";
    try {
      const r = await run([file, "Install", "--pretty"]);
      expect(r.code).toBe(0);
      expect(r.stdout).toContain("brew install lilmd");
      expect(r.stdout).toMatch(/── .*Install/);
      expect(r.stdout).toMatch(/\x1b\[\d/);
    } finally {
      if (prev == null) delete process.env.FORCE_COLOR;
      else process.env.FORCE_COLOR = prev;
    }
  });

  test("--pretty + --raw drops delimiters but keeps ANSI body", async () => {
    const prev = process.env.FORCE_COLOR;
    process.env.FORCE_COLOR = "1";
    try {
      const r = await run([file, "Install", "--pretty", "--raw"]);
      expect(r.code).toBe(0);
      expect(r.stdout).not.toMatch(/── /);
      expect(r.stdout).toMatch(/\x1b\[\d/);
    } finally {
      if (prev == null) delete process.env.FORCE_COLOR;
      else process.env.FORCE_COLOR = prev;
    }
  });

  test("--pretty cannot be combined with --json", async () => {
    const r = await run([file, "Install", "--pretty", "--json"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/--pretty.*--json|--json.*--pretty/);
  });

  test("--pretty on a no-match query still exits 1", async () => {
    const r = await run([file, "does-not-exist", "--pretty"]);
    expect(r.code).toBe(1);
    expect(r.stdout).toMatch(/no match/i);
  });
});

describe("cli: ls", () => {
  test("lists direct children of a matched section", async () => {
    const r = await run(["ls", file, "lilmd"]);
    expect(r.stdout).toContain("# lilmd");
    expect(r.stdout).toContain("## Getting Started");
    expect(r.stdout).toContain("## API");
    expect(r.stdout).toContain("## Community");
    // grandchildren should NOT be in the ls output
    expect(r.stdout).not.toContain("### Install");
  });

  test("ls on a leaf reports (no children)", async () => {
    const r = await run(["ls", file, "Install"]);
    expect(r.stdout).toContain("no children");
  });

  test("ls --json emits a file + results shape", async () => {
    const r = await run(["ls", file, "API", "--json"]);
    const j = JSON.parse(r.stdout);
    expect(j.file).toBe(file);
    expect(Array.isArray(j.results)).toBe(true);
    expect(j.results).toHaveLength(1);
    expect(j.results[0].parent.title).toBe("API");
    expect(j.results[0].children.map((c: { title: string }) => c.title)).toEqual(["read"]);
  });

  test("ls --json on no match is a parseable empty-results doc", async () => {
    const r = await run(["ls", file, "zzz-nope", "--json"]);
    expect(r.code).toBe(1);
    const j = JSON.parse(r.stdout);
    expect(j.file).toBe(file);
    expect(j.results).toEqual([]);
  });
});

describe("cli: grep", () => {
  test("finds a word and attributes it to the enclosing section", async () => {
    const r = await run(["grep", file, "brew"]);
    expect(r.stdout).toContain("L");
    expect(r.stdout).toContain("brew install lilmd");
    // The section header path should include the enclosing heading
    expect(r.stdout).toContain("Install");
  });

  test("regex pattern works", async () => {
    const r = await run(["grep", file, "^## "]);
    expect(r.stdout).toContain("## Getting Started");
    expect(r.stdout).toContain("## API");
  });

  test("no match prints friendly message", async () => {
    const r = await run(["grep", file, "xyzzy-nothing"]);
    expect(r.stdout).toMatch(/no match/i);
  });

  test("invalid regex returns exit 2 with an error", async () => {
    const r = await run(["grep", file, "["]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/invalid regex/);
  });

  test("--json emits an array of hits with section metadata", async () => {
    const r = await run(["grep", file, "lilmd", "--json"]);
    const j = JSON.parse(r.stdout);
    expect(Array.isArray(j)).toBe(true);
    expect(j.length).toBeGreaterThan(0);
    expect(j[0]).toHaveProperty("line");
    expect(j[0]).toHaveProperty("text");
    expect(j[0]).toHaveProperty("section");
  });

  test("works on a file with no headings (section is null)", async () => {
    const noHeadings = join(dir, "flat.md");
    writeFileSync(noHeadings, "just some words\nand more words with cat in them\n");
    const r = await run(["grep", noHeadings, "cat"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("cat");
    expect(r.stdout).toContain("no enclosing heading");

    const rJ = await run(["grep", noHeadings, "cat", "--json"]);
    const j = JSON.parse(rJ.stdout);
    expect(j[0].section).toBeNull();
  });

  test("matches before the first heading are attributed to null", async () => {
    const mixed = join(dir, "preamble.md");
    writeFileSync(mixed, "preamble with cat\n\n# After\n\nalso cat\n");
    const rJ = await run(["grep", mixed, "cat", "--json"]);
    const j = JSON.parse(rJ.stdout);
    expect(j).toHaveLength(2);
    expect(j[0].section).toBeNull();
    expect(j[1].section.title).toBe("After");
  });
});

describe("cli: errors", () => {
  test("unknown flag reports parse error with exit 2", async () => {
    const r = await run([file, "--nope"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/nope|unknown/i);
  });

  test("read without selector is an error", async () => {
    const r = await run(["read", file]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/selector/);
  });

  test("missing file returns friendly exit 2 (not a stack trace)", async () => {
    const r = await run(["/does/not/exist.md"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/cannot open/);
    expect(r.stderr).not.toMatch(/ENOENT|at \w/); // no raw node stack
  });

  test("--max-results with a non-number is an error", async () => {
    const r = await run([file, "Install", "--max-results", "abc"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/max-results/);
  });

  test("--depth with a negative number is an error", async () => {
    const r = await run([file, "--depth", "-1"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/depth/);
  });
});

describe("cli: extras per review", () => {
  test("--depth 0 shows zero headings (and not 'all')", async () => {
    const r = await run([file, "--depth", "0"]);
    expect(r.code).toBe(0);
    // Header line still present, but no heading lines underneath.
    const lines = r.stdout.split("\n").filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/headings/);
  });

  test("--max-results 1 with multiple matches shows banner + JSON truncated", async () => {
    const r = await run([file, "/.+/", "--max-results", "1"]);
    expect(r.stdout).toMatch(/matches, showing first 1/);

    const rJ = await run([file, "/.+/", "--max-results", "1", "--json"]);
    const j = JSON.parse(rJ.stdout);
    expect(j.matches).toHaveLength(1);
    expect(j.truncated).toBe(true);
  });

  test("ls honors --max-results", async () => {
    // lilmd has several descendants; ensure the cap is applied.
    const r = await run(["ls", file, "/.+/", "--max-results", "1", "--json"]);
    const j = JSON.parse(r.stdout);
    expect(j.results).toHaveLength(1);
  });
});
