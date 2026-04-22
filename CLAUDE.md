# dom-to-react-plugin

## Overview

This plugin captures live web pages into structured `[PageName].md` files and optionally converts them to React components. The Markdown file is the primary deliverable — React generation is optional.

## Skills

| Skill | Command | Description |
|---|---|---|
| page-capture | `/page-capture` | URL → `[PageName].md` + screenshot. Standalone, no React needed. |
| md-to-react | `/md-to-react` | `[PageName].md` → React TSX. Works with any schema-conforming MD. |
| dom-react-sync | `/dom-react-sync` | Convenience: runs page-capture then md-to-react in sequence. |

## Agent

`page-scaffolder` — orchestrator. Defaults to MD-only output. Asks before generating React.

## Schema contract

All `[PageName].md` files must have `schemaVersion: 1` in frontmatter.  
Schema definition: `schemas/page-capture.schema.json`

### Updating the schema

When making breaking changes to the MD format:
1. Bump `schemaVersion` in `schemas/page-capture.schema.json` (and update `const` constraint)
2. Update `parse-md.mjs` to handle `CURRENT_SCHEMA_VERSION` and add a migration note
3. Update `page-template.md` template
4. Update this CLAUDE.md with the change log

### Schema version history

| Version | Changes |
|---|---|
| 1 | Initial release |

## Chrome DevTools MCP dependency

This plugin requires the `chrome-devtools` MCP server to be running:
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

## Known limitations

- iframes and Shadow DOM are not captured
- Dynamic state (SPA route-level state) reflects current page state at capture time
- `take_snapshot` returns a11y tree only — all DOM/style data comes from `evaluate_script`
- Tailwind arbitrary values not generated (unmapped → inline style)
- SVGs inlined via `dangerouslySetInnerHTML` — extract for production use

## Plugin registration

To register for user-level access (all projects):
1. Add to `~/.claude/plugins/installed_plugins.json` under the `"plugins"` key:
   ```json
   "dom-to-react@local": [{
     "scope": "user",
     "installPath": "<plugin-install-path>",
     "version": "1.0.0",
     "installedAt": "2026-04-22T00:00:00Z",
     "lastUpdated": "2026-04-22T00:00:00Z"
   }]
   ```
2. Restart Claude Code
3. Skills will be available as `/page-capture`, `/md-to-react`, `/dom-react-sync`
