/**
 * Assembles the final [PageName].md from extracted data.
 *
 * Usage (called by the skill, not by evaluate_script):
 *   node render-md.mjs <extraction-json-path> <options-json>
 *
 * options: { name, sourceUrl, capturedAt, viewport, mode, screenshotPath, a11yTree, templatePath, outputPath }
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { processStyles } from './filter-styles.mjs'

const args = process.argv.slice(2)
if (args.length < 2) {
  console.error('Usage: node render-md.mjs <extraction.json> <options.json>')
  process.exit(1)
}

const extraction = JSON.parse(readFileSync(resolve(args[0]), 'utf8'))
const opts = JSON.parse(readFileSync(resolve(args[1]), 'utf8'))

const { tree, assets, interactions } = extraction
const { name, sourceUrl, capturedAt, viewport, mode, screenshotPath, a11yTree, outputPath } = opts

const { tree: processedTree, tokens } = processStyles(tree, mode)

// ── Design Tokens ─────────────────────────────────────────────────────────────
function formatColors(colors) {
  return colors.map((c, i) => `  - \`--color-${i + 1}: ${c}\``).join('\n')
}
function formatFonts(fonts) {
  return fonts.map(f => `  - \`${f}\``).join('\n')
}
function formatList(items) {
  return items.map(v => `  - \`${v}\``).join('\n')
}

// ── Interactions ──────────────────────────────────────────────────────────────
function formatInteractions(inter) {
  const parts = []
  if (inter.forms?.length) {
    parts.push('**Forms**:')
    for (const f of inter.forms) {
      parts.push(`  - id: \`${f.id || '(no id)'}\`, action: \`${f.action || ''}\`, method: \`${f.method || 'get'}\``)
    }
  }
  if (inter.links?.length) {
    parts.push('**Links**:')
    for (const l of inter.links.slice(0, 10)) {
      parts.push(`  - "${l.text}" → \`${l.href}\``)
    }
  }
  return parts.join('\n') || '_None detected_'
}

// ── Assets ────────────────────────────────────────────────────────────────────
function formatAssets(a) {
  const imgs = a.images?.length
    ? a.images.map(i => `  - \`${i.src}\`${i.alt ? ` (alt: "${i.alt}")` : ''}`).join('\n')
    : '  - _None_'
  const fonts = a.fonts?.length
    ? a.fonts.map(f => `  - \`${f.slice(0, 200)}\``).join('\n')
    : '  - _None_'
  return { imgs, fonts }
}

const screenshotRelative = screenshotPath
  ? `./assets/${name}.png`
  : '_not captured_'

const assetFormatted = formatAssets(assets || {})

const md = `---
name: ${name}
sourceUrl: ${sourceUrl}
capturedAt: ${capturedAt}
viewport: { width: ${viewport.width}, height: ${viewport.height} }
mode: ${mode}
screenshot: ${screenshotRelative}
schemaVersion: 1
---

# ${name}

## 1. Design Tokens

- **Colors**:
${tokens.colors?.length ? formatColors(tokens.colors) : '  - _Not extracted_'}
- **Fonts**:
${tokens.fonts?.length ? formatFonts(tokens.fonts) : '  - _Not extracted_'}
- **Spacing scale**: ${tokens.spacings?.join(', ') || '_Not extracted_'}
- **Radii**: ${tokens.radii?.join(', ') || '_Not extracted_'}
- **Shadows**: ${tokens.shadows?.join(', ') || '_Not extracted_'}

## 2. Accessibility Tree

\`\`\`
${a11yTree || '_Not captured_'}
\`\`\`

## 3. Component Tree

\`\`\`json
${JSON.stringify(processedTree, null, 2)}
\`\`\`

## 4. Assets

- **Images**:
${assetFormatted.imgs}
- **Fonts**:
${assetFormatted.fonts}

## 5. Interactions

${formatInteractions(interactions || {})}

## 6. Notes

- Captured in \`${mode}\` mode${mode === 'tokenized' ? ' — computed styles abstracted to design tokens' : ' — computed styles preserved verbatim'}
- iframes and Shadow DOM are not captured
- For auth-protected pages: ensure you are logged in before running page-capture
`

const outPath = resolve(outputPath)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, md, 'utf8')
console.log(`[render-md] Written: ${outPath}`)
