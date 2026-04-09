## `mdq` - Markdown as a Database for Agents
`mdq` is a CLI for working with large MD files designed for agents.

*Wait, but why?* Agent knowledge, docs, memory keeps growing. 
MDQ allows you to dump it all in one file and effeciently read/write/navigate its contents.

Features:
- fast navigation, complex read selectors, link extraction
- complex section selectors 
- designed to save as much context as possible
- can write, append, remove entire sections
- can run in Node/Bun
- optimized for speed
- can be used by humans and **agents**
- uses Bun as tooling: to test, control deps etc.

### Help

```bash
# start here!
# both commands print short documentation for the agent
> mdq
> mdq --help
```

### Overview & table of contents

First, the agent gets file overview and table of contents.

```bash
# renders toc + stats; line ranges are inclusive, 1-indexed
# --depth=N to limit nesting, --flat for a flat list
> mdq file.md

file.md  L1-450  12 headings
# MDQ                       L1-450
  ## Getting Started        L5-80
    ### Installation        L31-80
  ## Community              L301-450
```

### Reading sections

```bash
> mdq read file.md "# MDQ"
> mdq file.md "# MDQ"           # alias!
# prints the contents of the MDQ section

# descendant selector (any depth under the parent)
> mdq file.md "MDQ > Installation"

# direct child only
> mdq file.md "MDQ >> Installation"

# level filter (H2 only)
> mdq file.md "##Installation"

# exact match (default is fuzzy, case-insensitive)
> mdq file.md "=Installation"

# regex
> mdq file.md "/install(ation)?/"

# by default no more than 25 matches are printed; if more, mdq prints a hint
# about --max-results=N
# --max-lines=N truncates long bodies (shows "… N more lines")
# --body-only skips subsections, --no-body prints headings only
```

### For humans only

```bash
# --pretty renders the section body as syntax-highlighted terminal markdown
#   (for humans; piped output stays plain unless FORCE_COLOR is set)
> mdq file.md --pretty "Installation"

# nicely formatted markdown
```

### Searching & extracting

```bash
> mdq ls file.md "Getting Started"        # direct children of a section
> mdq grep file.md "pattern"              # regex search, grouped by section
> mdq links file.md ["selector"]          # extract links with section path
> mdq code file.md "Install" [--lang=ts]  # extract code blocks
```

### Writing

`mdq` treats sections as addressable records: you can replace, append,
insert, move, or rename them without rewriting the whole file. Every write
supports `--dry-run`, which prints a unified diff instead of touching disk —
perfect for agent-authored edits that a human (or another agent) reviews
before applying.

```bash
> mdq set    file.md "Install" < body.md  # replace section body
> mdq append file.md "Install" < body.md
> mdq insert file.md --after "Install" < new.md
> mdq rm     file.md "Old"
> mdq mv     file.md "From" "To"          # re-parent, fixes heading levels
> mdq rename file.md "Old" "New"
> mdq promote|demote file.md "Section"    # shift heading level ±1
```

### Output

```bash
# human-readable by default; --json for machine output
# use - as filename to read from stdin
> cat big.md | mdq - "Install"
```
