---
name: page-capture
description: Capture a live web page's DOM structure, computed styles, and screenshot into a structured [PageName].md file. Use when the user wants to document, archive, or later recreate a web page. The MD file is the primary deliverable — React generation is a separate optional step.
---

# page-capture

Extracts a live Chrome page's DOM structure, computed styles, assets, and accessibility tree into a structured `[PageName].md` file. This file is the single source of truth (SSoT) for any downstream use — manual reference, AI input, or React component generation.

**The MD file is the deliverable. React generation is NOT performed by this skill.**

## Usage

```
/page-capture <url> --name=<PageName> [--mode=verbatim|tokenized] [--out=<dir>]
```

| Argument | Description | Default |
|---|---|---|
| `<url>` | Page URL to capture (must be reachable in the open Chrome instance) | required |
| `--name` | Component/file name (PascalCase or kebab-case; used as filename) | inferred from URL |
| `--mode` | `verbatim` keeps computed styles as-is; `tokenized` abstracts to design tokens | `verbatim` |
| `--out` | Output directory for the `.md` file | `./pages/` |

## Requirements

- Chrome DevTools MCP server must be running and Chrome must have the page open (or Claude will open it)
- For authenticated pages: ensure you are already logged in before running this skill

## Workflow

### Step 1 — Navigate to page
If a page is not already open, use `mcp__chrome-devtools__new_page` to open the URL.
Wait for page load with `mcp__chrome-devtools__wait_for`.

### Step 2 — Screenshot
Capture a full-page screenshot:
```
mcp__chrome-devtools__take_screenshot
  → save to <out>/assets/<PageName>.png
```

### Step 3 — Accessibility tree
```
mcp__chrome-devtools__take_snapshot
  → record a11y tree text (used for Section 2 of the MD)
```

### Step 4 — DOM extraction
Inject the DOM walker script via `evaluate_script`:
```javascript
// Read the script content from:
// [plugin-root]/skills/page-capture/scripts/extract-dom.js
// Pass entire file content as the script argument to evaluate_script
mcp__chrome-devtools__evaluate_script
  → returns JSON string: { tree, assets, interactions }
```

Parse the returned JSON string.

### Step 5 — Style processing
- If `--mode=tokenized`: run `filter-styles.mjs processStyles(tree, 'tokenized')` to extract design tokens
- If `--mode=verbatim`: run `filter-styles.mjs processStyles(tree, 'verbatim')` to normalize

### Step 6 — Assemble Markdown
Write extraction JSON + options to temp files, then run:
```bash
node [plugin-root]/skills/page-capture/scripts/render-md.mjs \
  /tmp/extraction.json \
  /tmp/options.json
```

Where `options.json`:
```json
{
  "name": "PageName",
  "sourceUrl": "https://...",
  "capturedAt": "2026-04-22T08:00:00Z",
  "viewport": { "width": 1440, "height": 900 },
  "mode": "verbatim",
  "a11yTree": "... (from take_snapshot)",
  "outputPath": "./pages/PageName.md"
}
```

### Step 7 — Report
Output a summary:
- Path to generated `.md` file
- Path to screenshot
- Component Tree node count
- Design token count (tokenized mode)
- Any warnings (missing styles, large SVGs, iframe skips)

## Output structure

```
<out>/
├── <PageName>.md          ← main deliverable
└── assets/
    └── <PageName>.png     ← full-page screenshot
```

## Design Tokens (tokenized mode)

In `tokenized` mode, frequently-occurring computed style values are extracted into a Design Tokens section:
- **Colors**: top 15 unique color values by frequency
- **Fonts**: top 5 unique font stacks
- **Spacing**: top 10 recurring spacing values (padding, margin, gap, fontSize)
- **Radii**: top 8 border-radius values
- **Shadows**: top 5 box-shadow values

In `verbatim` mode, tokens are still derived (for the header section) but computed styles are preserved as-is in the Component Tree.

## Limitations

- iframes and Shadow DOM contents are not captured
- Dynamic content (SPA state after transitions) reflects current page state
- Cross-origin images may have src URLs that resolve differently in React
- `take_snapshot` provides a11y-tree only (not raw HTML) — DOM comes from `evaluate_script`

## Examples

```bash
# Capture example.com, verbatim mode
/page-capture https://example.com --name=Example

# Capture a complex page with design token abstraction
/page-capture https://app.example.com/dashboard --name=Dashboard --mode=tokenized

# Save to a specific directory
/page-capture https://example.com/landing --name=LandingPage --out=./design-specs/
```

## Next steps after capture

Once you have `[PageName].md`, you can:
- Use it as a reference document as-is
- Pass it to `/md-to-react` to generate a React component
- Edit it manually to adjust styles or remove irrelevant sections
- Use it as context for AI to understand the page's design
