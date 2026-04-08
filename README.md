`mdq` is a CLI for working with large MD files. Markdown is the new DB!

Principles:
- use Bun as tooling: to test, controls deps etc.
- can run in Node/Bun
- prefer speed
- Used **primarly** by AI agents, must have good AX

API
```
# both commands print help, but as a doc similar to this document
> mdq
> mdq --help
```

First, the agent gets file overview and table of contents
```
# renders toc: just all headings, optional --depth=3 
# [10L=123..1234] how many lines and span
> mdq file.md

# MDQ [123L=0...123]
  ## Getting Started [10L=123..2345]
  ## Installation 
    ### MacOS
  ## Community
```

```
> mdq read file.md "# MDQ"
> mdq file.md "# MDQ"           <- alias!
# renders the contents of MDQ section

# simple selector
> mdq file.md "# MDQ > ## Installation" 

# by default match is not exact, if multiple matched sections found, they will be printed
> mdq file.md "Installation" 

# by default, no more than 25 sections are printed if matched
# if more, mdq prints a message before search results saying that limit can be increased using
# --max-results=234

# will find all sections with Intro word that contain subscections that contain Setup
> mdq file.md "Intro>Setup"
```
