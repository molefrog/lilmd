## `lilmd` - Markdown as a Database for Agents
`lilmd` is a CLI for working with large MD files designed for agents.

*Wait, but why?* Agent knowledge, docs, memory keeps growing. 
lilmd allows you to dump it all in one file and effeciently read/write/navigate its contents.

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
> lilmd
> lilmd --help
```

### Overview & table of contents

First, the agent gets file overview and table of contents.

```bash
# renders toc + stats; line ranges are inclusive, 1-indexed
# --depth=N to limit nesting, --flat for a flat list
> lilmd file.md

file.md  L1-450  12 headings
# lilmd                     L1-450
  ## Getting Started        L5-80
    ### Installation        L31-80
  ## Community              L301-450
```

### Reading sections

```bash
> lilmd read file.md "# lilmd"
> lilmd file.md "# lilmd"           # alias!
# prints the contents of the lilmd section

# descendant selector (any depth under the parent)
> lilmd file.md "lilmd > Installation"

# direct child only
> lilmd file.md "lilmd >> Installation"

# level filter (H2 only)
> lilmd file.md "##Installation"

# exact match (default is fuzzy, case-insensitive)
> lilmd file.md "=Installation"

# regex
> lilmd file.md "/install(ation)?/"

# by default no more than 25 matches are printed; if more, lilmd prints a hint
# about --max-results=N
# --max-lines=N truncates long bodies (shows "… N more lines")
# --body-only skips subsections, --no-body prints headings only
```

### For humans only

```bash
# --pretty renders the section body as syntax-highlighted terminal markdown
#   (for humans; piped output stays plain unless FORCE_COLOR is set)
> lilmd file.md --pretty "Installation"

# nicely formatted markdown
```

### Searching & extracting

```bash
> lilmd ls file.md "Getting Started"        # direct children of a section
> lilmd grep file.md "pattern"               # regex search, grouped by section
> lilmd links file.md ["selector"]           # extract links with section path
> lilmd code file.md "Install" [--lang=ts]   # extract code blocks
```

### Writing

`lilmd` treats sections as addressable records: you can replace, append,
insert, move, or rename them without rewriting the whole file. Every write
supports `--dry-run`, which prints a unified diff instead of touching disk —
perfect for agent-authored edits that a human (or another agent) reviews
before applying.

```bash
> lilmd set    file.md "Install" < body.md  # replace section body
> lilmd append file.md "Install" < body.md
> lilmd insert file.md --after "Install" < new.md
> lilmd rm     file.md "Old"
> lilmd mv     file.md "From" "To"          # re-parent, fixes heading levels
> lilmd rename file.md "Old" "New"
> lilmd promote|demote file.md "Section"    # shift heading level ±1
```

### Output

```bash
# human-readable by default; --json for machine output
# use - as filename to read from stdin
> cat big.md | lilmd - "Install"
```
