`mdq` is a CLI for working with large MD files. Markdown is the new DB!

Principles:
- use Bun as tooling: to test, control deps etc.
- can run in Node/Bun
- prefer speed
- Used **primarily** by AI agents, must have good AX

API
```
# both commands print help, but as a doc similar to this document
> mdq
> mdq --help
```

First, the agent gets file overview and table of contents
```
# renders toc + stats; line ranges are inclusive, 1-indexed
> mdq file.md

file.md  L1-450  12 headings
# MDQ                       L1-450
  ## Getting Started        L5-80
    ### Installation        L31-80
  ## Community              L301-450

# --depth=N to limit nesting, --flat for a flat list
```

Reading sections
```
> mdq read file.md "# MDQ"
> mdq file.md "# MDQ"           <- alias!
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
# --pretty renders the section body as syntax-highlighted terminal markdown
#   (for humans; piped output stays plain unless FORCE_COLOR is set)
```

More commands
```
> mdq ls file.md "Getting Started"       # direct children of a section
> mdq grep file.md "pattern"              # regex search, grouped by section
> mdq links file.md ["selector"]          # extract links with section path
> mdq code file.md "Install" [--lang=ts]  # extract code blocks

# writes — MD is the new DB
> mdq set    file.md "Install" < body.md  # replace section body
> mdq append file.md "Install" < body.md
> mdq insert file.md --after "Install" < new.md
> mdq rm     file.md "Old"
> mdq mv     file.md "From" "To"          # re-parent, fixes heading levels
> mdq rename file.md "Old" "New"
> mdq promote|demote file.md "Section"    # shift heading level ±1
# all writes support --dry-run (prints a unified diff)
```

Output
```
# human-readable by default; --json for machine output
# use - as filename to read from stdin
> cat big.md | mdq - "Install"
```
