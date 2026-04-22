---
name: dom-react-sync
description: Convenience wrapper that runs page-capture then md-to-react in sequence. Use when the user wants to go directly from a live URL to a React component in one command. If the user only wants the MD file, use page-capture instead.
---

# dom-react-sync

Runs `page-capture` → `md-to-react` in sequence, producing both `[PageName].md` and `[PageName].tsx` from a single URL. If any step fails, the partial result (`.md` or incomplete `.tsx`) is preserved for manual continuation.

## Usage

```
/dom-react-sync <url> --name=<PageName> [--mode=verbatim|tokenized] [--styling=tailwind|css-modules] [--out=<dir>]
```

Delegates all arguments to the sub-skills — see `/page-capture` and `/md-to-react` for full argument documentation.

## Workflow

1. Run `/page-capture <url> --name=<Name> --mode=<mode> --out=<out>` 
   - If this fails, stop and report error. The page was not captured.
2. Run `/md-to-react <out>/<Name>.md --styling=<styling> --out=<out>/components/`
   - If this fails, the `.md` is still intact. Report error and suggest running `/md-to-react` manually.
3. Report:
   - Path to `.md`
   - Path to `.tsx` (and `.module.css` if applicable)
   - Screenshot path
   - Tailwind class coverage (tailwind mode)

## Recovery

If step 2 fails, the `.md` file is still usable:
```bash
# Continue from the MD after fixing the issue:
/md-to-react ./pages/<Name>.md --styling=<styling>
```

## Examples

```bash
# Full pipeline, verbatim + Tailwind
/dom-react-sync https://example.com/landing --name=LandingPage

# Tokenized design tokens + CSS Modules
/dom-react-sync https://app.example.com/dashboard --name=Dashboard \
  --mode=tokenized --styling=css-modules

# Custom output directory
/dom-react-sync https://example.com --name=Example --out=./design-system/
```
