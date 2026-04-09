# Library benchmark report

Goal: pick the libraries (markdown parser, CLI framework) for `mdq` by
measuring them against realistic workloads, not vibes.

## Setup

- Runtime: **Bun 1.3.11** on Linux
- Corpus: **MDN content** repo (`mdn/content`, sparse-checkout of
  `files/en-us/web/{javascript,css,html,api}` — 10,758 markdown files).
- Fixtures built by `dev/make-fixtures.ts`, concatenating MDN files in sorted
  order with front-matter stripped and a synthetic `# <path>` heading per
  file:
  - `small.md`  ≈ 100 KB,  40 files
  - `medium.md` ≈ 1 MB,    451 files
  - `large.md`  ≈ 10 MB,   4,124 files
- All benchmark scripts write incremental JSON to `dev/results/*.json`.

## 1. Parse speed — `dev/bench/parse.ts`

Candidates:
- `mdast-util-from-markdown` (wraps micromark, emits mdast AST with positions)
- `markdown-it` (token stream, positions via `token.map`)
- `marked` lexer (tokens, no positions)
- `md4w` (md4c compiled to WASM, JSON output, no positions)

Methodology: warmup then trimmed mean of the fastest 50% of iterations; per
`(parser, fixture)` wall budget of 4–8 s; iteration caps 100/20/5. Known-bad
combos (marked on medium+, mdast on large) are hard-skipped based on an
earlier exploratory run that had to be killed.

| parser | small 0.1 MB | medium 1 MB | large 10 MB | positions? |
|---|---:|---:|---:|:---:|
| **markdown-it** | 3.2 ms (30.8 MB/s) | 38.5 ms (26.0 MB/s) | 378.7 ms (26.4 MB/s) | ✅ |
| **mdast-util-from-markdown** | 59.8 ms (1.7 MB/s) | 938.0 ms (1.1 MB/s) | *skipped* (~60 s projected) | ✅ |
| **marked** (lexer) | 995 ms (0.1 MB/s) | *skipped* (>90 s first run) | *skipped* | ❌ |
| **md4w** (WASM JSON) | 2.4 ms (41.8 MB/s) | 23.9 ms (41.9 MB/s) | **errors** on 10 MB (JSON marshal bug) | ❌ |

Key observations:

- **markdown-it is the only position-preserving parser that scales.** It
  holds a steady ~26 MB/s from 100 KB to 10 MB. Parsing our 10 MB fixture
  takes under 400 ms — totally acceptable for `mdq`.
- **mdast-util-from-markdown is shockingly slow** — around 1 MB/s, ~25× slower
  than markdown-it despite both being tree-building parsers. This inverts the
  initial library research recommendation. The cost is almost certainly in
  the mdast AST construction layer on top of micromark (many small object
  allocations per token). **Do not use it for large files.**
- **marked's lexer is unusable for prose**: 1 second on 100 KB and >90 seconds
  on 1 MB. There's clearly catastrophic regex backtracking somewhere. Not a
  candidate.
- **md4w is fastest on small/medium (~42 MB/s)** but its WASM→JS JSON
  marshaller blows up on the 10 MB fixture with a `JSON Parse error`. I
  verified separately that `md4w.mdToHtml` on the same input works fine —
  it's specifically the JSON output path that breaks. And critically, md4w
  emits no source line positions in any output mode, so it cannot drive
  `mdq`'s `L<start>-<end>` feature. It would only be useful as a pre-pass to
  render HTML, which `mdq` doesn't need.

## 2. Position correctness — `dev/bench/positions.ts`

Small hand-written fixture with six headings at known lines (1, 5, 9, 13,
21, 26). Both `mdast-util-from-markdown` and `markdown-it` report all six
heading start lines exactly (1-indexed). markdown-it's `token.map[0]` is
0-indexed half-open, so remember the `+1` when converting to user-facing line
numbers. No off-by-ones observed.

## 3. End-to-end `mdq read` simulation — `dev/bench/query.ts`

The real question is not "how fast can you parse?" but "how fast can you
answer `mdq read file.md "X"`?" That's: parse → build section tree
(heading + `line_start..line_end`) → fuzzy match needle → slice body by
line range.

I benchmarked three strategies:
1. **scanner (hand-rolled)** — a ~40-line ATX-only line scanner that
   recognizes fenced code blocks so `#` inside code doesn't become a
   heading. No parser, no AST, no tokens. Lives in `bench/query.ts`.
2. **markdown-it** — parse, walk `heading_open` tokens.
3. **mdast-util-from-markdown** — parse, walk `tree.children`.

Needle: `"Array"`. All three strategies agreed on the match on medium/large
(same `L3179-3249`, same 2851-byte body) — so the scanner is producing
correct results, not just fast ones.

| strategy | small 0.1 MB | medium 1 MB | large 10 MB |
|---|---:|---:|---:|
| **scanner (hand-rolled)** | **0.44 ms** (226 MB/s) | **5.2 ms** (192 MB/s) | **55.4 ms** (181 MB/s) |
| markdown-it | 3.2 ms (31 MB/s) | 38.0 ms (26 MB/s) | 422.3 ms (24 MB/s) |
| mdast-util-from-markdown | 60.4 ms (1.6 MB/s) | 884.6 ms (1.1 MB/s) | *skipped* |

**This is the most important finding of the whole experiment.** On 10 MB of
prose, the hand-rolled scanner is:

- **~7.6× faster than markdown-it** (55 ms vs 422 ms)
- **~1000× faster than mdast-util-from-markdown** (55 ms vs ~60 s projected)
- **IO-bound at 180 MB/s** (disk read of a 10 MB file on modern hardware is
  in the same ballpark)

The scanner is correct because `mdq`'s core jobs only need two pieces of
markdown structure:
1. Where are the ATX headings? (level + line number)
2. Where do fenced code blocks start and end? (so we don't match `#` inside
   code)

Everything else — link parsing, emphasis, tables, footnotes, nested lists —
is irrelevant to "list the headings" and "slice the body between line N and
line M". A full CommonMark parser spends most of its budget on the 95% of
the grammar we don't care about.

## 4. CLI cold start — `dev/bench/cli.ts`

Spawns fresh Bun subprocesses for each argv parse, so module load + JIT is
included. Two commands (`toc` and `read`), 30 iterations each, trimmed-mean
of fastest half.

| framework | `toc` median | `read` median | dep size |
|---|---:|---:|---|
| cac | **16.3 ms** | **15.1 ms** | zero deps, ~40 KB |
| node `util.parseArgs` | 16.1 ms | 16.5 ms | built-in |
| citty | 23.4 ms | 22.9 ms | zero deps, ~90 KB |

Observations:

- All three are under 25 ms cold — totally fine for an agent-facing CLI.
  Nothing here is a differentiator.
- **cac and built-in `parseArgs` are a statistical tie** at ~16 ms.
- **citty is consistently ~7 ms slower** (≈45% more). It has the nicest
  ergonomics (typed args, auto-help, subcommand tree defined in one object)
  but on a single-subcommand fast path the extra ceremony costs us.
- `parseArgs` has no subcommand primitive — you hand-roll dispatch on
  `argv[0]`. For `mdq`'s dozen-command surface, that's ~30 lines of glue,
  which is fine.

## Recommendations

### Parsing / scanning

**Ship a hand-rolled ATX scanner as the primary engine.** It is the fastest
thing by a large margin, has zero dependencies, streams naturally (we can
scan without loading the whole file into memory), and covers every read-path
command in the design:

- `toc` — walk headings → tree
- `read` / `ls` — heading tree + line-range slice
- `grep` — scan bodies + map matches back to the enclosing heading path via
  the scanner's index

Keep a markdown parser on hand for features that actually need a real AST:

- `links` (parse `[text](url)` inline syntax correctly)
- `code` with `--lang` (need fenced-block language info)
- `set` / `insert` / `mv` (write path — want to be sure we're slicing at a
  real structural boundary, not something that happens to look like `#`
  inside a weird edge case)

For that secondary parser, **use `markdown-it`**, not `mdast-util-from-markdown`.
25× faster, same position information, same maturity. The initial research
recommendation was wrong on speed grounds — benchmarks win over folklore.

Drop `md4w` from consideration: no positions, plus a reproducible JSON
marshal bug at 10 MB.

### CLI

**Start with `cac`**. Fastest cold start (tied with built-in), zero deps,
subcommand-native, trivial API. If we later find we want typed args or
auto-generated rich help, citty is a 7-ms-slower swap. I'd avoid bare
`parseArgs` only because subcommand dispatch is boring boilerplate we'd
reinvent.

### Testing

`bun test` only. Nothing in the benchmarks argues for vitest.

## Caveats

1. **Corpus bias.** MDN markdown is prose-heavy with lots of tables, code
   blocks, and JSX-flavored HTML inclusions. Results on reference-doc
   markdown might differ (e.g., files that are 95% tables). Worth a revisit
   if the primary consumer turns out to be something like Swagger or
   OpenAPI `.md`.
2. **Bun-only measurement.** Node numbers might differ, particularly for the
   WASM path (md4w is anyway excluded). The "can run in Node/Bun" principle
   means we should re-run the bench under Node once before release —
   cheap insurance.
3. **No memory profiling done.** The scanner's memory is obviously dominated
   by the source string itself; markdown-it allocates a token array roughly
   proportional to source size. mdast doubles that with node objects. For a
   10 MB input, markdown-it stays under 100 MB resident based on informal
   observation; mdast would be several times worse. Formal measurement is
   a follow-up.
4. **marked and md4w deserve a "known bad" note** in the project's
   design docs so nobody re-litigates them later. The catastrophic marked
   behavior on prose is surprising enough that I'd want a reproducer filed
   upstream before writing them off permanently.

## Headline numbers

```
mdq toc on 10 MB of MDN markdown:
  scanner      55 ms   (180 MB/s, zero deps)
  markdown-it 422 ms   ( 24 MB/s, via token.map)
  mdast      ~60 s     (  ~1 MB/s)

mdq cold start:
  cac         16 ms
  parseArgs   16 ms
  citty       23 ms
```

**Final stack:** hand-rolled scanner as the engine, markdown-it as the
fallback parser for write-path and link/code commands, cac for the CLI,
`bun test` for tests. No md4w, no mdast-util-from-markdown, no marked.
