---
name: md-to-react
description: Convert a [PageName].md file (produced by page-capture) into a React TSX component. Operates independently — works with any MD file that conforms to the page-capture schema, including manually edited files. Use when the user wants to generate React components from a captured page spec.
---

# md-to-react

Reads a `[PageName].md` file (page-capture schema v1) and generates a React TSX component with styles as close to the original as possible. AI does **not** reinterpret design choices — styles come verbatim from the MD's Component Tree.

**This skill requires a valid `[PageName].md` as input. It does not access Chrome or the live page.**

## Usage

```
/md-to-react <path/to/PageName.md> [--styling=tailwind|css-modules] [--out=<dir>]
```

| Argument | Description | Default |
|---|---|---|
| `<path>` | Path to the `.md` file produced by page-capture | required |
| `--styling` | `tailwind`: Tailwind v4 classes + inline style fallback; `css-modules`: pure CSS Modules | `tailwind` |
| `--out` | Output directory | same directory as input `.md` |

## Requirements

- Node.js 18+ in PATH
- Input `.md` must have `schemaVersion: 1` in frontmatter — older/different schemas will error

## Workflow

### Step 1 — Parse the MD
Run `parse-md.mjs` to extract structured data:
```bash
node [plugin-root]/skills/md-to-react/scripts/parse-md.mjs <PageName.md>
# → JSON: { frontmatter, componentTree, tokens, assets, interactions }
```

If `schemaVersion` does not match, stop and report an error with migration instructions.

### Step 2 — Generate TSX
Write parsed JSON + options to temp files, then run `generate-tsx.mjs`:
```bash
node [plugin-root]/skills/md-to-react/scripts/generate-tsx.mjs \
  /tmp/parsed.json \
  /tmp/gen-options.json
```

Where `gen-options.json`:
```json
{
  "name": "PageName",
  "styling": "tailwind",
  "outDir": "./src/components/",
  "mode": "verbatim"
}
```

### Step 3 — Report
Output:
- Path to generated `.tsx` file
- Path to `.module.css` (css-modules mode only)
- Tailwind class coverage rate (tailwind mode): `X% class, Y% inline-style fallback`
- Any unmapped style properties that required inline fallback

## Style mapping strategy

### Tailwind mode
1. Mapped values → Tailwind classes (spacing scale, display, flex, grid, alignment)
2. Unmapped values → `style={{ }}` inline (colors, fonts, gradients, complex shadows, arbitrary lengths)
3. Original DOM class names are **always preserved** — they may correspond to your project's own styles
4. Result: hybrid component that uses Tailwind where possible, inline for the rest

### CSS Modules mode
- Each DOM node gets a generated `styles.nodeN` class
- All computed styles go into the `.module.css` file verbatim
- Original DOM class names are **also preserved** (appended alongside module classes)
- Most faithful reproduction of original styles; least dependent on Tailwind configuration

## Examples

```bash
# Tailwind mode (default)
/md-to-react ./pages/Dashboard.md --out=./src/pages/

# CSS Modules mode (more faithful)
/md-to-react ./pages/Dashboard.md --styling=css-modules --out=./src/pages/

# Tailwind from a manually created MD
/md-to-react ./design-specs/LandingPage.md --styling=tailwind
```

## Output

For a page named `Dashboard` with `--styling=tailwind`:
```
./src/pages/
└── Dashboard.tsx
```

For `--styling=css-modules`:
```
./src/pages/
├── Dashboard.tsx
└── Dashboard.module.css
```

## Limitations

- SVGs are inlined via `dangerouslySetInnerHTML` — for production use, extract to separate `.svg` files
- Dynamic behavior (click handlers, form submissions) is stubbed with `onClick={() => {}}` or empty `action`
- Very complex pages may produce large files; split into sub-components manually as needed
- Tailwind arbitrary values (e.g. `w-[347px]`) are not currently generated — unmapped values fall back to inline style
