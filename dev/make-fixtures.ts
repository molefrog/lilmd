/**
 * Build small/medium/large markdown fixtures by concatenating files
 * from the MDN content corpus.
 *
 * Sizes:
 *   small  ~  100 KB
 *   medium ~ 1   MB
 *   large  ~ 10  MB
 *
 * Fixtures are deterministic: files are picked in sorted order.
 */

import { readdir, stat, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";

const CORPUS = new URL("./corpus/mdn", import.meta.url).pathname;
const OUT = new URL("./fixtures", import.meta.url).pathname;

const TARGETS = {
  small: 100 * 1024, //  100 KB
  medium: 1 * 1024 * 1024, // 1 MB
  large: 10 * 1024 * 1024, // 10 MB
} as const;

async function* walk(dir: string): AsyncIterable<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  // deterministic order
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && e.name.endsWith(".md")) yield p;
  }
}

async function build(name: string, budget: number) {
  const parts: string[] = [];
  let total = 0;
  let count = 0;
  for await (const path of walk(CORPUS)) {
    if (total >= budget) break;
    const rel = relative(CORPUS, path);
    const body = await readFile(path, "utf8");
    // Strip front-matter block and replace with a synthetic H1 pointing at the source.
    const stripped = body.replace(/^---\n[\s\S]*?\n---\n?/, "");
    // Promote file boundary so every fixture has a clear heading tree.
    const section = `# ${rel}\n\n${stripped.trimEnd()}\n\n`;
    parts.push(section);
    total += Buffer.byteLength(section, "utf8");
    count++;
  }
  const joined = parts.join("");
  const out = join(OUT, `${name}.md`);
  await writeFile(out, joined, "utf8");
  const s = await stat(out);
  console.log(
    `${name.padEnd(6)} ${count.toString().padStart(5)} files  ${(s.size / 1024 / 1024).toFixed(2)} MB  -> ${out}`,
  );
}

await mkdir(OUT, { recursive: true });
for (const [name, budget] of Object.entries(TARGETS)) {
  await build(name, budget);
}
