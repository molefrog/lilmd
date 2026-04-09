/**
 * CLI framework smoke test: cold-start + argv parse for citty vs cac vs
 * Node's built-in util.parseArgs. We run each in a fresh Bun subprocess so
 * startup cost (module init, JIT) is included — that's what the user feels
 * when they type `mdq`.
 *
 * The measured path is: load module -> define subcommands -> parse argv ->
 * invoke handler that prints one line and exits. Real CLIs do more than that
 * but the delta between frameworks lives entirely at this layer.
 */

import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const tmp = mkdtempSync(join(tmpdir(), "mdq-cli-bench-"));

const scripts = {
  "citty": `
import { defineCommand, runMain } from "citty";
const main = defineCommand({
  meta: { name: "mdq" },
  subCommands: {
    toc: defineCommand({
      meta: { name: "toc" },
      args: { file: { type: "positional", required: true }, depth: { type: "string" } },
      run({ args }) { console.log("toc", args.file, args.depth ?? "-"); },
    }),
    read: defineCommand({
      meta: { name: "read" },
      args: { file: { type: "positional", required: true }, selector: { type: "positional", required: true } },
      run({ args }) { console.log("read", args.file, args.selector); },
    }),
  },
});
await runMain(main);
`,
  "cac": `
import { cac } from "cac";
const cli = cac("mdq");
cli.command("toc <file>", "render toc").option("--depth <n>", "").action((file, opts) => {
  console.log("toc", file, opts.depth ?? "-");
});
cli.command("read <file> <selector>", "read section").action((file, selector) => {
  console.log("read", file, selector);
});
cli.help();
cli.parse();
`,
  "parseArgs": `
import { parseArgs } from "node:util";
const argv = process.argv.slice(2);
const sub = argv[0];
if (sub === "toc") {
  const { values, positionals } = parseArgs({
    args: argv.slice(1),
    options: { depth: { type: "string" } },
    allowPositionals: true,
  });
  console.log("toc", positionals[0], values.depth ?? "-");
} else if (sub === "read") {
  const { positionals } = parseArgs({
    args: argv.slice(1),
    allowPositionals: true,
  });
  console.log("read", positionals[0], positionals[1]);
} else {
  console.error("unknown");
  process.exit(1);
}
`,
};

for (const [name, src] of Object.entries(scripts)) {
  writeFileSync(join(tmp, `${name}.ts`), src);
}

function runOnce(script: string, args: string[]): number {
  const t0 = Bun.nanoseconds();
  const r = spawnSync("bun", [script, ...args], { encoding: "utf8" });
  const elapsed = Bun.nanoseconds() - t0;
  if (r.status !== 0) throw new Error(`${script} failed: ${r.stderr}`);
  return elapsed;
}

const CASES: [string, string[]][] = [
  ["toc", ["toc", "foo.md", "--depth", "3"]],
  ["read", ["read", "foo.md", "# Install"]],
];

type Row = {
  framework: string;
  command: string;
  iterations: number;
  median_ms: number;
  min_ms: number;
  p90_ms: number;
};
const results: Row[] = [];

const ITERS = 30;

for (const fw of Object.keys(scripts)) {
  const script = join(tmp, `${fw}.ts`);
  for (const [cmdName, args] of CASES) {
    // Warmup
    runOnce(script, args);
    runOnce(script, args);

    const times: number[] = [];
    for (let i = 0; i < ITERS; i++) times.push(runOnce(script, args));
    times.sort((a, b) => a - b);
    const trimmed = times.slice(0, Math.max(1, Math.floor(times.length / 2)));
    const mean = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    const p90 = times[Math.floor(times.length * 0.9)];
    results.push({
      framework: fw,
      command: cmdName,
      iterations: ITERS,
      median_ms: +(mean / 1e6).toFixed(2),
      min_ms: +(times[0] / 1e6).toFixed(2),
      p90_ms: +(p90 / 1e6).toFixed(2),
    });
    console.log(
      `  ${fw.padEnd(12)} ${cmdName.padEnd(6)}  ` +
        `median ${(mean / 1e6).toFixed(2).padStart(7)} ms  ` +
        `min ${(times[0] / 1e6).toFixed(2).padStart(7)} ms  ` +
        `p90 ${(p90 / 1e6).toFixed(2).padStart(7)} ms`,
    );
  }
}

const outPath = new URL("../results/cli.json", import.meta.url).pathname;
await Bun.write(outPath, JSON.stringify(results, null, 2));
console.log(`\nWrote ${outPath}`);
