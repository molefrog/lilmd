import { defineConfig } from "bunup";

/**
 * Two build artifacts share one `dist/`:
 *
 * 1. Library  — src/index.ts → dist/index.{js,cjs,d.ts}
 *    For programmatic consumers that import mdq functions.
 *
 * 2. CLI      — bin/mdq.ts → dist/mdq.js
 *    A single self-contained JS file with a `#!/usr/bin/env node` shebang,
 *    so installing the npm package lets users run `mdq` without Bun.
 *
 * Both target Node so the published artifacts run on the broader runtime;
 * during development everything still executes the .ts sources directly
 * via Bun (bun test, bun bin/mdq.ts …).
 */
export default defineConfig([
  {
    name: "lib",
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    target: "node",
    dts: true,
    clean: true,
    sourcemap: "linked",
  },
  {
    name: "cli",
    entry: ["bin/mdq.ts"],
    format: ["esm"],
    target: "node",
    // Keep marked/marked-terminal external so the lazy `--pretty` path stays
    // lazy: bundling them would pull cli-highlight + chalk + cli-table3 into
    // the cold-start bundle and blow the ~16 ms startup budget.
    external: ["marked", "marked-terminal"],
    // Don't wipe the library build that the previous config wrote.
    clean: false,
    sourcemap: "linked",
  },
]);
