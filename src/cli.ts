#!/usr/bin/env bun
/**
 * mdq CLI — composes scan + sections + select + render into commands.
 *
 * Uses node:util.parseArgs only: zero runtime dependencies. Subcommand
 * dispatch is a tiny switch on argv[0]; that's about 20 lines of glue we'd
 * reinvent on top of any framework anyway, and the benchmark (dev/bench/cli.ts)
 * showed cac and parseArgs tied at ~16ms cold start.
 *
 * Public commands (MVP):
 *   mdq [file]                   toc
 *   mdq <file> <selector>        alias for: mdq read
 *   mdq read <file> <selector>   read section(s) matching selector
 *   mdq ls <file> <selector>     direct children of matching section
 *   mdq grep <file> <pattern>    regex search inside section bodies
 *   mdq --help | -h              help
 *
 * File argument accepts `-` to read stdin.
 *
 * Exit codes:
 *   0  found something / toc printed / help
 *   1  ran successfully but found no matches (grep-style, so `&&` chaining
 *      works the way agents expect)
 *   2  usage error (bad flag, missing file, invalid regex, file not found)
 */

import { parseArgs, type ParseArgsConfig } from "node:util";
import { readFileSync } from "node:fs";

import { scan } from "./scan";
import { buildSections, countLines, pathOf, type Section } from "./sections";
import { match, parseSelector } from "./select";
import { renderSection, renderToc, truncateBody } from "./render";

const HELP = `mdq — CLI for working with large Markdown files

Usage:
  mdq                              show this help
  mdq <file>                       print table of contents
  mdq <file> <selector>            alias for 'mdq read'
  mdq read <file> <selector>       print sections matching selector
  mdq ls   <file> <selector>       list direct child headings
  mdq grep <file> <pattern>        regex-search section bodies

Selector grammar:
  Install                   fuzzy, case-insensitive substring
  =Install                  exact, case-insensitive equality
  /^inst/i                  regex (JS syntax); flags default to 'i'
  ##Install                 level filter (1..6 '#'s)
  Guide > Install           descendant, any depth under 'Guide'
  Guide >> Install          direct child of 'Guide'

Options:
  --depth <n>               TOC: max heading depth to show (0 = none)
  --flat                    TOC: flat list, no indentation
  --max-results <n>         cap matches for read/ls (default 25)
  --max-lines <n>           truncate long bodies (0 = unlimited)
  --body-only               read: skip subsections
  --no-body                 read: print headings only
  --raw                     read: drop delimiter lines
  --json                    machine-readable JSON output

Use '-' as <file> to read from stdin. Exit code is 1 when no matches.
`;

export type CliResult = { code: number; stdout: string; stderr: string };

function ok(s: string): CliResult {
  return { code: 0, stdout: s, stderr: "" };
}
function noMatch(s: string): CliResult {
  // Successful run that found nothing: exit 1 so `mdq ... && foo` works the
  // way agents expect, but keep the friendly message on stdout so humans see
  // it too.
  return { code: 1, stdout: s, stderr: "" };
}
function err(s: string, code = 1): CliResult {
  return { code, stdout: "", stderr: s };
}

const OPTIONS = {
  depth: { type: "string" },
  flat: { type: "boolean" },
  "max-results": { type: "string" },
  "max-lines": { type: "string" },
  "body-only": { type: "boolean" },
  "no-body": { type: "boolean" },
  raw: { type: "boolean" },
  json: { type: "boolean" },
  help: { type: "boolean", short: "h" },
} satisfies NonNullable<ParseArgsConfig["options"]>;

export function run(argv: string[]): CliResult {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: OPTIONS,
      allowPositionals: true,
      strict: true,
    });
  } catch (e) {
    return err(`mdq: ${(e as Error).message}\n${HELP}`, 2);
  }

  const { values, positionals } = parsed;
  if (values.help || positionals.length === 0) {
    return ok(HELP);
  }

  // Detect explicit subcommand by the first positional.
  const head = positionals[0];
  if (head === "read" || head === "ls" || head === "grep" || head === "toc") {
    return dispatch(head, positionals.slice(1), values);
  }

  // Positional form:
  //   mdq <file>              -> toc
  //   mdq <file> <selector>   -> read
  if (positionals.length === 1) return dispatch("toc", positionals, values);
  return dispatch("read", positionals, values);
}

type Values = ReturnType<typeof parseArgs<{ options: typeof OPTIONS }>>["values"];

function dispatch(cmd: string, rest: string[], values: Values): CliResult {
  switch (cmd) {
    case "toc":
      return cmdToc(rest, values);
    case "read":
      return cmdRead(rest, values);
    case "ls":
      return cmdLs(rest, values);
    case "grep":
      return cmdGrep(rest, values);
    default:
      return err(`mdq: unknown command '${cmd}'\n${HELP}`, 2);
  }
}

/**
 * Read `file` from disk or stdin. Returns a CliResult on failure so callers
 * can just forward it — we swallow raw ENOENT stack traces here and emit a
 * friendly "mdq: cannot open 'foo.md'" message instead.
 */
function loadFile(file: string): { src: string } | CliResult {
  try {
    const src = file === "-" ? readFileSync(0, "utf8") : readFileSync(file, "utf8");
    return { src };
  } catch (e) {
    const msg = (e as NodeJS.ErrnoException).code === "ENOENT"
      ? `mdq: cannot open '${file}': not found\n`
      : `mdq: cannot open '${file}': ${(e as Error).message}\n`;
    return err(msg, 2);
  }
}

/**
 * Parse `v` as a base-10 integer. Returns null (not fallback) on invalid
 * input so callers can distinguish "not provided" from "bad value".
 */
function parseIntOrNull(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n) || String(n) !== v.trim()) return null;
  return n;
}

function readFlag(
  v: Values,
  name: "depth" | "max-results" | "max-lines",
  fallback: number | null,
): { value: number | null } | CliResult {
  const raw = v[name];
  if (raw == null) return { value: fallback };
  const n = parseIntOrNull(raw);
  if (n == null || n < 0) {
    return err(`mdq: --${name} expects a non-negative integer, got '${raw}'\n`, 2);
  }
  return { value: n };
}

// ---- commands ----------------------------------------------------------

function cmdToc(rest: string[], v: Values): CliResult {
  const file = rest[0];
  if (file == null) return err("mdq toc: missing <file>\n", 2);
  const loaded = loadFile(file);
  if ("code" in loaded) return loaded;
  const { src } = loaded;
  const sections = buildSections(scan(src), countLines(src));

  if (v.json) {
    return ok(
      JSON.stringify(
        {
          file,
          total_lines: countLines(src),
          headings: sections.map(sectionToJSON),
        },
        null,
        2,
      ),
    );
  }

  const depth = readFlag(v, "depth", null);
  if ("code" in depth) return depth;
  return ok(
    renderToc(file, src, sections, {
      depth: depth.value ?? undefined,
      flat: !!v.flat,
    }),
  );
}

function cmdRead(rest: string[], v: Values): CliResult {
  const file = rest[0];
  const selectorStr = rest[1];
  if (file == null || selectorStr == null) {
    return err("mdq read: missing <file> or <selector>\n", 2);
  }
  const loaded = loadFile(file);
  if ("code" in loaded) return loaded;
  const { src } = loaded;
  const sections = buildSections(scan(src), countLines(src));

  const maxResults = readFlag(v, "max-results", 25);
  if ("code" in maxResults) return maxResults;
  const maxLines = readFlag(v, "max-lines", 0);
  if ("code" in maxLines) return maxLines;

  const selector = parseSelector(selectorStr);
  const matches = match(sections, selector);

  // Split source once and pass srcLines through to render. Previously
  // renderSection/sliceBody each re-split for every match, turning
  // `mdq read file.md sel` into O(matches × file_size).
  const srcLines = src.split("\n");

  if (v.json) {
    return emitReadJson(
      file,
      srcLines,
      sections,
      matches,
      maxResults.value ?? 25,
      maxLines.value ?? 0,
      v,
    );
  }

  if (matches.length === 0) return noMatch("(no match)\n");

  const cap = maxResults.value ?? 25;
  const toPrint = matches.slice(0, cap);
  const out: string[] = [];
  if (matches.length > cap) {
    out.push(
      `${matches.length} matches, showing first ${cap}. Use --max-results=N to raise the cap.`,
    );
  }
  for (const sec of toPrint) {
    out.push(
      renderSection(file, srcLines, sec, {
        bodyOnly: !!v["body-only"],
        noBody: !!v["no-body"],
        raw: !!v.raw,
        maxLines: maxLines.value ?? 0,
        allSections: sections,
      }),
    );
  }
  return ok(out.join("\n"));
}

function emitReadJson(
  file: string,
  srcLines: string[],
  all: Section[],
  matches: Section[],
  maxResults: number,
  maxLines: number,
  v: Values,
): CliResult {
  const body = JSON.stringify(
    {
      file,
      matches: matches.slice(0, maxResults).map((s) => ({
        ...sectionToJSON(s),
        body: v["no-body"]
          ? ""
          : maybeTruncate(sliceBody(srcLines, s, all, !!v["body-only"]), maxLines),
      })),
      truncated: matches.length > maxResults,
    },
    null,
    2,
  );
  // JSON path keeps exit 0 regardless — the shape itself signals no matches.
  return matches.length === 0 ? { code: 1, stdout: body, stderr: "" } : ok(body);
}

function cmdLs(rest: string[], v: Values): CliResult {
  const file = rest[0];
  const selectorStr = rest[1];
  if (file == null || selectorStr == null) {
    return err("mdq ls: missing <file> or <selector>\n", 2);
  }
  const loaded = loadFile(file);
  if ("code" in loaded) return loaded;
  const { src } = loaded;
  const sections = buildSections(scan(src), countLines(src));

  const maxResults = readFlag(v, "max-results", 25);
  if ("code" in maxResults) return maxResults;
  const cap = maxResults.value ?? 25;

  const selector = parseSelector(selectorStr);
  const matches = match(sections, selector).slice(0, cap);

  // Index children by parent once so we don't repeat an O(n) filter per
  // match — inexpensive in practice but easy to do right.
  const childrenOf = new Map<Section, Section[]>();
  for (const sec of sections) {
    if (sec.parent) {
      const list = childrenOf.get(sec.parent);
      if (list) list.push(sec);
      else childrenOf.set(sec.parent, [sec]);
    }
  }

  if (v.json) {
    const results = matches.map((parent) => ({
      parent: sectionToJSON(parent),
      children: (childrenOf.get(parent) ?? []).map(sectionToJSON),
    }));
    const body = JSON.stringify({ file, results }, null, 2);
    return matches.length === 0 ? { code: 1, stdout: body, stderr: "" } : ok(body);
  }

  if (matches.length === 0) return noMatch("(no match)\n");

  const out: string[] = [];
  for (const parent of matches) {
    const children = childrenOf.get(parent) ?? [];
    out.push(
      `${"#".repeat(parent.level)} ${parent.title}  L${parent.line_start}-${parent.line_end}`,
    );
    if (children.length === 0) {
      out.push("  (no children)");
    } else {
      for (const c of children) {
        out.push(
          `  ${"#".repeat(c.level)} ${c.title}  L${c.line_start}-${c.line_end}`,
        );
      }
    }
  }
  return ok(out.join("\n"));
}

function cmdGrep(rest: string[], v: Values): CliResult {
  const file = rest[0];
  const pattern = rest[1];
  if (file == null || pattern == null) {
    return err("mdq grep: missing <file> or <pattern>\n", 2);
  }
  const loaded = loadFile(file);
  if ("code" in loaded) return loaded;
  const { src } = loaded;
  const sections = buildSections(scan(src), countLines(src));

  let re: RegExp;
  try {
    re = new RegExp(pattern);
  } catch (e) {
    return err(`mdq grep: invalid regex: ${(e as Error).message}\n`, 2);
  }

  const srcLines = src.split("\n");
  type Hit = { section: Section | null; line: number; text: string };
  const hits: Hit[] = [];

  // Walk all lines once and attribute each match to the innermost enclosing
  // section. Sections are in document order, so a monotonic cursor is enough.
  // Matches before the first heading get `section: null`.
  let secIdx = -1;
  for (let lineNo = 1; lineNo <= srcLines.length; lineNo++) {
    while (
      secIdx + 1 < sections.length &&
      sections[secIdx + 1]!.line_start <= lineNo
    ) {
      secIdx++;
    }
    const line = srcLines[lineNo - 1]!;
    if (re.test(line)) {
      const section = secIdx >= 0 ? sections[secIdx] ?? null : null;
      hits.push({ section, line: lineNo, text: line });
    }
  }

  if (v.json) {
    const body = JSON.stringify(
      hits.map((h) => ({
        file,
        line: h.line,
        text: h.text,
        section: h.section ? sectionToJSON(h.section) : null,
      })),
      null,
      2,
    );
    return hits.length === 0 ? { code: 1, stdout: body, stderr: "" } : ok(body);
  }

  if (hits.length === 0) return noMatch("(no match)\n");

  // Group consecutive hits by section for readable output.
  const out: string[] = [];
  let lastSection: Section | null | undefined = undefined;
  for (const hit of hits) {
    if (hit.section !== lastSection) {
      if (hit.section) {
        const path = pathOf(hit.section).concat(hit.section.title).join(" > ");
        out.push(
          `── ${path}  L${hit.section.line_start}-${hit.section.line_end}`,
        );
      } else {
        out.push(`── ${file}  (no enclosing heading)`);
      }
      lastSection = hit.section;
    }
    out.push(`  L${hit.line}:  ${hit.text}`);
  }
  return ok(out.join("\n"));
}

// ---- shared helpers ----------------------------------------------------

function sliceBody(
  srcLines: string[],
  sec: Section,
  all: Section[],
  bodyOnly: boolean,
): string {
  let end = sec.line_end;
  if (bodyOnly) {
    const firstChild = all.find((s) => s.parent === sec);
    if (firstChild) end = firstChild.line_start - 1;
  }
  return srcLines.slice(sec.line_start - 1, end).join("\n");
}

function maybeTruncate(body: string, maxLines: number): string {
  return maxLines > 0 ? truncateBody(body, maxLines) : body;
}

function sectionToJSON(sec: Section): Record<string, unknown> {
  return {
    level: sec.level,
    title: sec.title,
    line_start: sec.line_start,
    line_end: sec.line_end,
    path: pathOf(sec),
  };
}

// Entry point lives in bin/mdq.ts; this module only exports `run`.
