# Benchmark summary

Why `mdq` uses a hand-rolled scanner instead of an off-the-shelf markdown
parser. Numbers captured on Bun 1.3.11 against MDN content (`mdn/content`,
sparse-checkout of `files/en-us/web/{javascript,css,html,api}`, concatenated
into fixtures of ~100 KB, ~1 MB, and ~10 MB).

## Parse speed (large, 10 MB)

| library | positions? | throughput |
|---|:---:|---:|
| **scanner (in `src/scan.ts`)** | ✅ | **~180 MB/s** |
| markdown-it | ✅ | ~26 MB/s |
| mdast-util-from-markdown | ✅ | ~1 MB/s (skipped — too slow) |
| marked lexer | ❌ | >90 s on a 1 MB input (unusable) |
| md4w (WASM) | ❌ | ~42 MB/s, errors on 10 MB JSON output |

## End-to-end `mdq read` (10 MB, find a section + slice its body)

| strategy | time |
|---|---:|
| **scanner** | **55 ms** (IO-bound) |
| markdown-it | 422 ms (~7.6× slower) |
| mdast-util-from-markdown | ~60 s (~1000× slower) |

All three strategies agree on the matched section and exact body bytes —
the scanner is correct, not just fast.

## CLI cold start

| framework | cold start |
|---|---:|
| `node:util.parseArgs` (built-in) | ~16 ms |
| cac | ~16 ms |
| citty | ~23 ms |

## Why the scanner wins

`mdq`'s read-path commands (`toc`, `read`, `ls`, `grep`) only need two facts
from the markdown:

1. ATX headings — level, text, line number
2. Fenced code block boundaries (so `#` inside code doesn't become a heading)

Everything else — links, emphasis, tables, footnotes, nested lists, HTML
blocks — is irrelevant to "list the headings" and "slice the body between
line N and line M". A full CommonMark parser spends 95% of its budget on
grammar `mdq` immediately throws away. The scanner skips all of that, runs
in a single pass over character codes, and is IO-bound on 10 MB of prose.

## The final stack

- **Parsing**: hand-rolled scanner in `src/scan.ts`. Zero dependencies.
- **CLI**: `node:util.parseArgs` + a ~20-line subcommand switch. Zero
  dependencies.
- **Future write-path commands** (`set`, `insert`, `mv`, `links`, `code`)
  may add `markdown-it` as the only runtime dep when they land — it's the
  only position-preserving parser that scales.
- **Rejected**: `mdast-util-from-markdown` (25× slower than markdown-it
  despite wrapping the same micromark tokenizer), `marked` (catastrophic
  regex backtracking on prose), `md4w` (no source positions + JSON
  marshaller bug at 10 MB), `citty` (~45% slower cold start than the
  built-in for no meaningful feature we need), `cac` (same cold-start
  class as built-in but adds a dep).

## Reproducing

The raw benchmark scripts were removed to keep the repo minimal. To rerun
them, check out an earlier commit on this branch (look for `dev/bench/` in
git history) or rewrite them against the methodology above:

- Small/medium/large fixtures built by concatenating MDN markdown files.
- Per-(library, fixture) wall budgets of 4–8 s with hard iteration caps, so
  a pathological parser (we're looking at you, marked) can't hang the run.
- Trimmed mean of the fastest 50% of iterations per combo.
- Full-throughput results written incrementally so a timeout still yields
  partial data.

## Integration-test fixture

`src/__fixtures__/mdn-array.md` is a tiny (~42 KB, 1,298 lines, 112
headings) fixture committed into the repo and exercised by
`src/integration.test.ts`. It's a concatenation of 8 MDN
`Array.prototype.*` reference pages hoisted under synthetic H1 wrappers.
Small enough to commit, big enough to catch regressions the synthetic unit
fixtures can miss (Kuma macros, JSX-flavored HTML, tables, real fenced
code, nested lists).

Licensed CC BY-SA 2.5, © Mozilla Contributors. Regenerate with:

```bash
# 1. Sparse-clone the MDN Array docs (no blobs, no tree outside array/)
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/mdn/content.git /tmp/mdn
cd /tmp/mdn
git sparse-checkout set \
  files/en-us/web/javascript/reference/global_objects/array

# 2. Concatenate 8 method pages under synthetic H1s
#    (see the fixture's own header comment for the exact list)
# 3. Prepend the attribution block from the existing fixture header
```

If you change the file list or the synthetic wrappers, update the relevant
assertions in `src/integration.test.ts` — a couple of them pin exact counts
("8 matches, showing first 3") that are tied to the 8-page choice.
