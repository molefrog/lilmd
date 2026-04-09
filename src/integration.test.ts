/**
 * A few integration tests against real fixtures built from MDN content.
 *
 * These only run if dev/fixtures/*.md exist — they are gitignored and built
 * by `bun dev/make-fixtures.ts`. We skip the suite entirely when they're
 * missing so a fresh clone doesn't fail CI.
 *
 * Kept small on purpose: the unit suites cover correctness; the point here
 * is to prove the CLI end-to-end on an agent-sized file (10 MB / ~60k lines)
 * and to pin a rough latency budget.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { run } from "./cli";

const FIXTURES = new URL("../dev/fixtures", import.meta.url).pathname;
const small = join(FIXTURES, "small.md");
const large = join(FIXTURES, "large.md");

const HAVE_FIXTURES = existsSync(small) && existsSync(large);

describe.if(HAVE_FIXTURES)("integration: small.md", () => {
  test("toc returns many headings within 100ms", () => {
    const t0 = performance.now();
    const r = run([small]);
    const elapsed = performance.now() - t0;
    expect(r.code).toBe(0);
    expect(r.stdout.split("\n").length).toBeGreaterThan(50);
    expect(elapsed).toBeLessThan(100);
  });
});

describe.if(HAVE_FIXTURES)("integration: large.md (10 MB)", () => {
  test("toc of 10 MB completes well under 500 ms", () => {
    const sizeMb = statSync(large).size / 1024 / 1024;
    expect(sizeMb).toBeGreaterThan(5);

    // Warmup: first call pays the one-time JIT cost; we care about steady
    // state here (cold-start is a separate concern, covered by bench/cli.ts).
    run([large, "--depth", "1"]);

    const t0 = performance.now();
    const r = run([large, "--depth", "1"]);
    const elapsed = performance.now() - t0;

    expect(r.code).toBe(0);
    expect(r.stdout).toContain("headings");
    // Warm toc on 10 MB measured ~80 ms locally; give 3x headroom for CI.
    expect(elapsed).toBeLessThan(250);
  });

  test("read with a descendant selector finds a section", () => {
    const r = run([large, "Syntax"]);
    expect(r.code).toBe(0);
    // Syntax headings are everywhere in MDN; we should get the max-results cap.
    expect(r.stdout).toMatch(/(matches, showing first|── )/);
  });

  test("grep with a narrow pattern returns structured hits under 1s", () => {
    const t0 = performance.now();
    // "ArrayBuffer" is everywhere in MDN API docs; we expect hits.
    const r = run(["grep", large, "ArrayBuffer"]);
    const elapsed = performance.now() - t0;

    expect(r.code).toBe(0);
    expect(r.stdout).toContain("ArrayBuffer");
    expect(elapsed).toBeLessThan(1000);
  });
});
