/**
 * CLI-level integration tests. We call the exported `run(argv)` function
 * directly instead of spawning a subprocess — faster, easier to diff
 * output, and still exercises every branch. A separate spawn-based smoke
 * test for stdin and the `bin/lilmd.ts` entry lives in `integration.test.ts`.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
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

// ---- fixture with links and code blocks ------------------------------------

const LINKS_SRC = `# Guide

Intro with a [home page](https://example.com) link.

## Install

Run [brew](https://brew.sh) or [npm](https://npmjs.com).

## API

No links here.
`;

const CODE_SRC = `# Guide

## Install

\`\`\`bash
npm install lilmd
\`\`\`

## Usage

\`\`\`ts
import { run } from "lilmd";
\`\`\`

\`\`\`
plain block
\`\`\`
`;

// ---- cli: links -------------------------------------------------------------

describe("cli: links", () => {
  let lfile: string;
  beforeAll(() => {
    lfile = join(dir, "links.md");
    writeFileSync(lfile, LINKS_SRC);
  });

  test("extracts links from all sections", async () => {
    const r = await run(["links", lfile]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("home page");
    expect(r.stdout).toContain("https://example.com");
    expect(r.stdout).toContain("brew");
    expect(r.stdout).toContain("https://brew.sh");
    expect(r.stdout).toContain("npm");
  });

  test("filters by selector", async () => {
    const r = await run(["links", lfile, "Install"]);
    expect(r.stdout).toContain("brew");
    expect(r.stdout).not.toContain("home page");
  });

  test("no match exits 1 with friendly message", async () => {
    const r = await run(["links", lfile, "API"]);
    expect(r.code).toBe(1);
    expect(r.stdout).toMatch(/no match/i);
  });

  test("--json emits array of link objects", async () => {
    const r = await run(["links", lfile, "--json"]);
    const j = JSON.parse(r.stdout);
    expect(Array.isArray(j)).toBe(true);
    expect(j.length).toBeGreaterThan(0);
    expect(j[0]).toHaveProperty("text");
    expect(j[0]).toHaveProperty("url");
    expect(j[0]).toHaveProperty("line");
    expect(j[0]).toHaveProperty("section");
  });
});

// ---- cli: code --------------------------------------------------------------

describe("cli: code", () => {
  let cfile: string;
  beforeAll(() => {
    cfile = join(dir, "code.md");
    writeFileSync(cfile, CODE_SRC);
  });

  test("extracts all code blocks", async () => {
    const r = await run(["code", cfile]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("npm install lilmd");
    expect(r.stdout).toContain('import { run }');
    expect(r.stdout).toContain("plain block");
  });

  test("--lang filters by language", async () => {
    const r = await run(["code", cfile, "--lang", "ts"]);
    expect(r.stdout).toContain('import { run }');
    expect(r.stdout).not.toContain("npm install lilmd");
  });

  test("filters by selector", async () => {
    const r = await run(["code", cfile, "Install"]);
    expect(r.stdout).toContain("npm install lilmd");
    expect(r.stdout).not.toContain('import { run }');
  });

  test("no match exits 1", async () => {
    const r = await run(["code", cfile, "--lang", "python"]);
    expect(r.code).toBe(1);
    expect(r.stdout).toMatch(/no match/i);
  });

  test("--json emits array with lang and body", async () => {
    const r = await run(["code", cfile, "--json"]);
    const j = JSON.parse(r.stdout);
    expect(Array.isArray(j)).toBe(true);
    const ts = j.find((b: { lang: string }) => b.lang === "ts");
    expect(ts).toBeDefined();
    expect(ts.body).toContain('import { run }');
    expect(ts).toHaveProperty("line_start");
  });
});

// ---- cli: set ---------------------------------------------------------------

describe("cli: set", () => {
  test("replaces section body in the file", async () => {
    const wfile = join(dir, "set.md");
    writeFileSync(wfile, SRC);
    const r = await run(["set", wfile, "Install", "--body", "new content here"]);
    expect(r.code).toBe(0);
    const content = readFileSync(wfile, "utf8");
    expect(content).toContain("### Install");
    expect(content).toContain("new content here");
    expect(content).not.toContain("brew install lilmd");
  });

  test("--dry-run shows diff without modifying file", async () => {
    const wfile = join(dir, "set-dry.md");
    writeFileSync(wfile, SRC);
    const r = await run(["set", wfile, "Install", "--body", "replacement", "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("---");
    expect(r.stdout).toContain("+++");
    expect(r.stdout).toContain("-brew install lilmd");
    expect(r.stdout).toContain("+replacement");
    const content = readFileSync(wfile, "utf8");
    expect(content).toContain("brew install lilmd"); // file unchanged
  });

  test("no match exits 1", async () => {
    const r = await run(["set", file, "nonexistent", "--body", "x"]);
    expect(r.code).toBe(1);
    expect(r.stdout).toMatch(/no match/i);
  });

  test("missing --body is an error", async () => {
    const r = await run(["set", file, "Install"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/--body/);
  });
});

// ---- cli: append ------------------------------------------------------------

describe("cli: append", () => {
  test("appends content after section body", async () => {
    const wfile = join(dir, "append.md");
    writeFileSync(wfile, SRC);
    const r = await run(["append", wfile, "Install", "--body", "extra line"]);
    expect(r.code).toBe(0);
    const content = readFileSync(wfile, "utf8");
    expect(content).toContain("brew install lilmd");
    expect(content).toContain("extra line");
    const brewIdx = content.indexOf("brew install lilmd");
    const extraIdx = content.indexOf("extra line");
    expect(extraIdx).toBeGreaterThan(brewIdx);
  });

  test("--dry-run shows diff without modifying file", async () => {
    const wfile = join(dir, "append-dry.md");
    writeFileSync(wfile, SRC);
    const r = await run(["append", wfile, "Install", "--body", "appended", "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("+appended");
    const content = readFileSync(wfile, "utf8");
    expect(content).not.toContain("appended");
  });
});

// ---- cli: insert ------------------------------------------------------------

describe("cli: insert", () => {
  test("inserts a new section after the matched section", async () => {
    const wfile = join(dir, "insert.md");
    writeFileSync(wfile, SRC);
    const r = await run(["insert", wfile, "--after", "Install", "--body", "## New\n\nnew body"]);
    expect(r.code).toBe(0);
    const content = readFileSync(wfile, "utf8");
    const installIdx = content.indexOf("### Install");
    const newIdx = content.indexOf("## New");
    expect(newIdx).toBeGreaterThan(installIdx);
  });

  test("--dry-run shows diff without modifying file", async () => {
    const wfile = join(dir, "insert-dry.md");
    writeFileSync(wfile, SRC);
    const r = await run(["insert", wfile, "--after", "Install", "--body", "## New\n\nnew", "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("+## New");
    const content = readFileSync(wfile, "utf8");
    expect(content).not.toContain("## New");
  });

  test("missing --after is an error", async () => {
    const r = await run(["insert", file, "--body", "x"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/--after/);
  });
});

// ---- cli: rm ----------------------------------------------------------------

describe("cli: rm", () => {
  test("removes section and its descendants", async () => {
    const wfile = join(dir, "rm.md");
    writeFileSync(wfile, SRC);
    const r = await run(["rm", wfile, "Getting Started"]);
    expect(r.code).toBe(0);
    const content = readFileSync(wfile, "utf8");
    expect(content).not.toContain("## Getting Started");
    expect(content).not.toContain("### Install");
    expect(content).not.toContain("brew install lilmd");
    expect(content).toContain("## API");
  });

  test("--dry-run shows diff without modifying file", async () => {
    const wfile = join(dir, "rm-dry.md");
    writeFileSync(wfile, SRC);
    const r = await run(["rm", wfile, "Install", "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("-### Install");
    const content = readFileSync(wfile, "utf8");
    expect(content).toContain("### Install");
  });

  test("no match exits 1", async () => {
    const r = await run(["rm", file, "nonexistent"]);
    expect(r.code).toBe(1);
    expect(r.stdout).toMatch(/no match/i);
  });
});

// ---- cli: rename ------------------------------------------------------------

describe("cli: rename", () => {
  test("renames the heading in the file", async () => {
    const wfile = join(dir, "rename.md");
    writeFileSync(wfile, SRC);
    const r = await run(["rename", wfile, "Install", "Setup"]);
    expect(r.code).toBe(0);
    const content = readFileSync(wfile, "utf8");
    expect(content).toContain("### Setup");
    expect(content).not.toMatch(/^### Install$/m);
    expect(content).toContain("brew install lilmd"); // body unchanged
  });

  test("--dry-run shows diff without modifying file", async () => {
    const wfile = join(dir, "rename-dry.md");
    writeFileSync(wfile, SRC);
    const r = await run(["rename", wfile, "Install", "Setup", "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("-### Install");
    expect(r.stdout).toContain("+### Setup");
    const content = readFileSync(wfile, "utf8");
    expect(content).toContain("### Install");
  });

  test("missing new name is an error", async () => {
    const r = await run(["rename", file, "Install"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/new.*name|name/i);
  });
});

// ---- cli: promote / demote --------------------------------------------------

describe("cli: promote", () => {
  test("decreases heading level of section and descendants", async () => {
    const wfile = join(dir, "promote.md");
    writeFileSync(wfile, SRC);
    const r = await run(["promote", wfile, "Getting Started"]);
    expect(r.code).toBe(0);
    const content = readFileSync(wfile, "utf8");
    expect(content).toMatch(/^# Getting Started$/m);
    expect(content).toMatch(/^## Install$/m);
    expect(content).toMatch(/^## Setup$/m);
  });

  test("--dry-run shows diff without modifying file", async () => {
    const wfile = join(dir, "promote-dry.md");
    writeFileSync(wfile, SRC);
    const r = await run(["promote", wfile, "Install", "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("-### Install");
    expect(r.stdout).toContain("+## Install");
    const content = readFileSync(wfile, "utf8");
    expect(content).toContain("### Install");
  });
});

describe("cli: demote", () => {
  test("increases heading level of section and descendants", async () => {
    const wfile = join(dir, "demote.md");
    writeFileSync(wfile, SRC);
    const r = await run(["demote", wfile, "API"]);
    expect(r.code).toBe(0);
    const content = readFileSync(wfile, "utf8");
    expect(content).toMatch(/^### API$/m);
    expect(content).toMatch(/^#### read$/m);
  });

  test("--dry-run shows diff without modifying file", async () => {
    const wfile = join(dir, "demote-dry.md");
    writeFileSync(wfile, SRC);
    const r = await run(["demote", wfile, "API", "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("-## API");
    expect(r.stdout).toContain("+### API");
    const content = readFileSync(wfile, "utf8");
    expect(content).toContain("## API");
  });
});

// ---- cli: mv ----------------------------------------------------------------

describe("cli: mv", () => {
  test("moves section to be a child of target", async () => {
    const wfile = join(dir, "mv.md");
    writeFileSync(wfile, SRC);
    const r = await run(["mv", wfile, "API", "Getting Started"]);
    expect(r.code).toBe(0);
    const content = readFileSync(wfile, "utf8");
    // API should now be under Getting Started (level 3)
    expect(content).toMatch(/^### API$/m);
    const gsIdx = content.indexOf("## Getting Started");
    const apiIdx = content.indexOf("### API");
    expect(apiIdx).toBeGreaterThan(gsIdx);
    expect(content).not.toMatch(/^## API$/m);
  });

  test("--dry-run shows diff without modifying file", async () => {
    const wfile = join(dir, "mv-dry.md");
    writeFileSync(wfile, SRC);
    const r = await run(["mv", wfile, "Community", "API", "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("---");
    expect(r.stdout).toContain("+++");
    const content = readFileSync(wfile, "utf8");
    expect(content).toMatch(/^## Community$/m);
  });

  test("no match for source section exits 1", async () => {
    const r = await run(["mv", file, "nonexistent", "API"]);
    expect(r.code).toBe(1);
    expect(r.stdout).toMatch(/no match/i);
  });

  test("missing destination is an error", async () => {
    const r = await run(["mv", file, "API"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/destination|dest/i);
  });

  test("destination selector matches nothing exits 1", async () => {
    const r = await run(["mv", file, "API", "nonexistent"]);
    expect(r.code).toBe(1);
    expect(r.stdout).toMatch(/no match/i);
  });
});

// ---- cli: write command edge cases ------------------------------------------

describe("cli: write edge cases", () => {
  test("write command on non-existent file returns friendly error", async () => {
    const r = await run(["set", "/does/not/exist.md", "x", "--body", "y"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/cannot open/);
  });

  test("set with multiple matches operates on the first match only", async () => {
    // Selector '/.+/' matches every section; only the first (# lilmd) should change.
    const wfile = join(dir, "set-multi.md");
    writeFileSync(wfile, SRC);
    const r = await run(["set", wfile, "/.+/", "--body", "replaced", "--dry-run"]);
    expect(r.code).toBe(0);
    // The diff should contain "+replaced" (the new body) exactly once.
    const addedLines = r.stdout.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
    expect(addedLines).toHaveLength(1);
    expect(addedLines[0]).toBe("+replaced");
  });

  test("promote at level 1 clamps (no-op on heading level)", async () => {
    const wfile = join(dir, "promote-clamp.md");
    writeFileSync(wfile, SRC);
    const r = await run(["promote", wfile, "lilmd"]); // top-level H1
    expect(r.code).toBe(0);
    const content = readFileSync(wfile, "utf8");
    expect(content).toMatch(/^# lilmd$/m); // still level 1
  });

  test("demote at level 6 clamps (no-op on heading level)", async () => {
    const src = `###### Deep\n\nbody\n`;
    const wfile = join(dir, "demote-clamp.md");
    writeFileSync(wfile, src);
    const sections = (await import("./sections")).buildSections(
      (await import("./scan")).scan(src),
      (await import("./sections")).countLines(src),
    );
    const r = await run(["demote", wfile, "Deep"]);
    expect(r.code).toBe(0);
    const content = readFileSync(wfile, "utf8");
    expect(content).toMatch(/^###### Deep$/m); // still level 6
  });

  test("write commands reject stdin ('-') as file", async () => {
    const r = await run(["set", "-", "x", "--body", "y"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/stdin|'-'/i);
  });

  test("--dry-run output ends with a newline", async () => {
    const r = await run(["rename", file, "Install", "Setup", "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.stdout.endsWith("\n")).toBe(true);
  });
});
