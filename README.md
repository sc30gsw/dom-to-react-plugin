# dom-to-react-plugin

Claude Code plugin that captures a live web page's DOM structure into a structured `[PageName].md` file, then optionally converts it to a React TSX component.

## Why

When recreating a page as a React component, AI often reinterprets styles and "improves" the design — changing fonts, colors, spacing. This plugin extracts exact computed styles from Chrome DevTools and stores them as a Markdown SSoT, giving Claude a faithful source rather than asking it to guess from a screenshot.

## Skills

### `/page-capture <url> --name=<PageName> [--mode=verbatim|tokenized]`

Captures a live page:
- Full-page screenshot
- Accessibility tree (from Chrome DevTools)
- Complete DOM structure + computed styles (via `evaluate_script`)
- Assets (images, fonts)
- Interactions (forms, links)

Output: `./pages/<PageName>.md` + `./pages/assets/<PageName>.png`

**This is the primary deliverable.** Use the MD as-is, or pass to `/md-to-react`.

### `/md-to-react <file.md> [--styling=tailwind|css-modules] [--out=<dir>]`

Converts a captured page MD to React TSX:
- `--styling=tailwind` (default): Tailwind v4 classes + inline style fallback for unmapped values
- `--styling=css-modules`: Verbatim CSS Modules for maximum fidelity

Works with any MD file that conforms to `schemas/page-capture.schema.json` (including manually written files).

### `/dom-react-sync <url> --name=<PageName> [--mode=...] [--styling=...]`

Runs both skills in sequence. If capture succeeds but React generation fails, the `.md` is preserved for manual retry.

## Setup

### Prerequisites

- Chrome browser running
- Chrome DevTools MCP server configured in Claude Code:
  ```json
  {
    "mcpServers": {
      "chrome-devtools": {
        "command": "npx",
        "args": ["-y", "chrome-devtools-mcp@latest"]
      }
    }
  }
  ```

### Plugin installation

This repository ships its own [Claude Code plugin marketplace](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces) (`.claude-plugin/marketplace.json`) named `dom-to-react-plugin`, which exposes the `dom-to-react` plugin.

#### Option 1 — Install from GitHub (recommended)

Inside a Claude Code session:

```bash
/plugin marketplace add sc30gsw/dom-to-react-plugin
/plugin install dom-to-react@dom-to-react-plugin
/reload plugin
```

Or from your shell using the non-interactive CLI:

```bash
claude plugin marketplace add sc30gsw/dom-to-react-plugin
claude plugin install dom-to-react@dom-to-react-plugin
```

To pin to a specific tag or branch, append `@<ref>` to the marketplace source:

```bash
claude plugin marketplace add sc30gsw/dom-to-react-plugin@v1.0.0
```

To install scoped to a single project (shared with your team via `.claude/settings.json`):

```bash
claude plugin marketplace add sc30gsw/dom-to-react-plugin --scope project
claude plugin install dom-to-react@dom-to-react-plugin
```

#### Option 2 — Install from a local clone

Useful while developing the plugin locally:

```bash
git clone https://github.com/sc30gsw/dom-to-react-plugin.git
cd dom-to-react-plugin

claude plugin marketplace add .
claude plugin install dom-to-react@dom-to-react-plugin
```

After editing the plugin sources, refresh the cache:

```bash
claude plugin marketplace update dom-to-react-plugin
```

#### Verify the installation

```bash
claude plugin marketplace list
claude plugin list
```

Once enabled, the skills are available as `/page-capture`, `/md-to-react`, and `/dom-react-sync`.

#### Uninstall

```bash
claude plugin uninstall dom-to-react@dom-to-react-plugin
claude plugin marketplace remove dom-to-react-plugin
```

## Example workflow

```bash
# 1. Capture a page (MD only — share as design spec or use as AI context)
/page-capture https://stripe.com/pricing --name=StripePricing

# 2. Later, generate React from the MD
/md-to-react ./pages/StripePricing.md --styling=tailwind --out=./src/pages/

# 3. Or capture + generate in one step
/dom-react-sync https://stripe.com/pricing --name=StripePricing --mode=tokenized

# 4. For maximum style fidelity
/dom-react-sync https://example.com/dashboard --name=Dashboard \
  --mode=verbatim --styling=css-modules
```

## [PageName].md format

```yaml
---
name: StripePricing
sourceUrl: https://stripe.com/pricing
capturedAt: 2026-04-22T08:15:00Z
viewport: { width: 1440, height: 900 }
mode: verbatim
screenshot: ./assets/StripePricing.png
schemaVersion: 1
---

# StripePricing

## 1. Design Tokens     ← colors, fonts, spacing, radii, shadows
## 2. Accessibility Tree  ← semantic structure from Chrome a11y tree
## 3. Component Tree    ← full DOM JSON with computed styles
## 4. Assets            ← image URLs, font declarations
## 5. Interactions      ← forms, links
## 6. Notes             ← warnings, limitations, manual annotations
```

## Limitations

- iframes and Shadow DOM not captured
- Dynamic SPA state reflects current page state at capture time
- Auth-required pages: be logged in before running
- Tailwind arbitrary values not generated (unmapped → inline style)
- SVGs inlined via `dangerouslySetInnerHTML` — extract for production use

## Schema versioning

`schemas/page-capture.schema.json` defines the contract. `schemaVersion: 1` is the current version. See `CLAUDE.md` for migration instructions when the schema changes.
