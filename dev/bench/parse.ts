/**
 * Parse-speed benchmark: how fast does each parser turn bytes into an AST?
 *
 * Known pathological cases (learned empirically from earlier runs):
 * - marked's lexer on CommonMark prose takes ~1 s / 100 KB and 90+ s / 1 MB.
 *   We only measure it on small. Skipped on medium / large.
 * - mdast-util-from-markdown takes ~60 s on 10 MB of prose. We measure it on
 *   small / medium but skip large (we already have the linear-scaling data).
 *
 * Results are written incrementally to results/parse.json so a timeout or
 * crash still yields partial data.
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { fromMarkdown } from "mdast-util-from-markdown";
import MarkdownIt from "markdown-it";
import { marked } from "marked";
import * as md4w from "md4w";

await md4w.init();

const FIXTURES_DIR = new URL("../fixtures", import.meta.url).pathname;
const RESULTS = new URL("../results/parse.json", import.meta.url).pathname;

type Size = "small" | "medium" | "large";
const FIXTURES: Size[] = ["small", "medium", "large"];

type Parser = {
  name: string;
  preserves_positions: boolean;
  skip: Size[];
  run: (src: string) => unknown;
};

const mdIt = new MarkdownIt();

const parsers: Parser[] = [
  {
    name: "mdast-util-from-markdown",
    preserves_positions: true,
    skip: ["large"], // ~60s on 10 MB — we have the trend from small/medium
    run: (src) => fromMarkdown(src),
  },
  {
    name: "markdown-it",
    preserves_positions: true, // via token.map
    skip: [],
    run: (src) => mdIt.parse(src, {}),
  },
  {
    name: "marked (lexer)",
    preserves_positions: false,
    skip: ["medium", "large"], // ~1s on 100 KB, >90s on 1 MB
    run: (src) => marked.lexer(src),
  },
  {
    name: "md4w (WASM JSON)",
    preserves_positions: false,
    skip: [],
    run: (src) => md4w.mdToJSON(src),
  },
];

// Per-fixture iteration caps and wall budgets.
const PLAN: Record<Size, { max_iters: number; budget_ms: number }> = {
  small: { max_iters: 100, budget_ms: 4_000 },
  medium: { max_iters: 20, budget_ms: 5_000 },
  large: { max_iters: 5, budget_ms: 8_000 },
};

type Row = {
  fixture: Size;
  size_mb: number;
  parser: string;
  positions: boolean;
  iterations: number;
  median_ms: number | null;
  min_ms: number | null;
  mb_per_s: number | null;
  status: "ok" | "skipped" | "error";
  note?: string;
};

const results: Row[] = [];
const writeResults = () => Bun.write(RESULTS, JSON.stringify(results, null, 2));

for (const fx of FIXTURES) {
  const path = join(FIXTURES_DIR, `${fx}.md`);
  const size = statSync(path).size;
  const sizeMb = size / 1024 / 1024;
  const src = readFileSync(path, "utf8");
  const plan = PLAN[fx];
  console.log(
    `\n=== ${fx}  ${sizeMb.toFixed(2)} MB  (cap ${plan.max_iters} iters, ${plan.budget_ms}ms wall) ===`,
  );

  for (const p of parsers) {
    const base = {
      fixture: fx,
      size_mb: +sizeMb.toFixed(2),
      parser: p.name,
      positions: p.preserves_positions,
    };

    if (p.skip.includes(fx)) {
      results.push({
        ...base,
        iterations: 0,
        median_ms: null,
        min_ms: null,
        mb_per_s: null,
        status: "skipped",
        note: "skipped — known too slow at this size",
      });
      console.log(`  ${p.name.padEnd(26)}  skipped (too slow at this size)`);
      await writeResults();
      continue;
    }

    let iterations = 0;
    const times: number[] = [];
    const start = Bun.nanoseconds();
    const budgetNs = BigInt(plan.budget_ms) * 1_000_000n;

    try {
      // Warmup
      p.run(src);

      while (iterations < plan.max_iters) {
        if (BigInt(Bun.nanoseconds() - start) > budgetNs) break;
        const t0 = Bun.nanoseconds();
        p.run(src);
        times.push(Bun.nanoseconds() - t0);
        iterations++;
      }
    } catch (err) {
      results.push({
        ...base,
        iterations,
        median_ms: null,
        min_ms: null,
        mb_per_s: null,
        status: "error",
        note: (err as Error).message,
      });
      console.log(`  ${p.name.padEnd(26)}  ERROR  ${(err as Error).message}`);
      await writeResults();
      continue;
    }

    times.sort((a, b) => a - b);
    const trim = times.slice(0, Math.max(1, Math.floor(times.length / 2)));
    const mean = trim.reduce((a, b) => a + b, 0) / trim.length;
    const meanMs = mean / 1e6;
    const minMs = times[0] / 1e6;
    const mbps = sizeMb / (meanMs / 1000);

    const row: Row = {
      ...base,
      iterations,
      median_ms: +meanMs.toFixed(3),
      min_ms: +minMs.toFixed(3),
      mb_per_s: +mbps.toFixed(1),
      status: "ok",
    };
    results.push(row);

    console.log(
      `  ${p.name.padEnd(26)} ${meanMs.toFixed(2).padStart(10)} ms  ` +
        `(min ${minMs.toFixed(2).padStart(8)} ms)  ` +
        `${mbps.toFixed(1).padStart(6)} MB/s  ` +
        `${iterations} iters  ${p.preserves_positions ? "[pos]" : ""}`,
    );
    await writeResults();
  }
}

console.log(`\nWrote ${RESULTS}`);
