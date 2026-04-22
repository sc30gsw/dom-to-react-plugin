/**
 * Parses a [PageName].md file (produced by page-capture) into structured data
 * for the React generator.
 *
 * Usage: node parse-md.mjs <path/to/PageName.md>
 * Outputs parsed JSON to stdout.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

const CURRENT_SCHEMA_VERSION = 1

export function parseMd(filePath) {
  const raw = readFileSync(resolve(filePath), 'utf8')
  return parse(raw, filePath)
}

function parse(raw, filePath) {
  // ── Frontmatter ──────────────────────────────────────────────────────────────
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) throw new Error(`[parse-md] No YAML frontmatter found in ${filePath}`)

  const fm = parseFrontmatter(fmMatch[1])

  if (!fm.schemaVersion || fm.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `[parse-md] schemaVersion mismatch in ${filePath}: ` +
      `found ${fm.schemaVersion}, expected ${CURRENT_SCHEMA_VERSION}. ` +
      `Please re-capture the page or migrate the MD file.`
    )
  }

  // ── Sections ─────────────────────────────────────────────────────────────────
  const body = raw.slice(fmMatch[0].length)
  const sections = extractSections(body)

  const componentTreeRaw = extractFencedBlock(sections['Component Tree'] || sections['3. Component Tree'] || '')
  if (!componentTreeRaw) {
    throw new Error(`[parse-md] No Component Tree JSON found in ${filePath}`)
  }

  let componentTree
  try {
    componentTree = JSON.parse(componentTreeRaw)
  } catch (e) {
    throw new Error(`[parse-md] Invalid JSON in Component Tree of ${filePath}: ${e.message}`)
  }

  const tokens = parseDesignTokens(sections['Design Tokens'] || sections['1. Design Tokens'] || '')
  const assets = parseAssets(sections['Assets'] || sections['4. Assets'] || '')
  const interactions = sections['Interactions'] || sections['5. Interactions'] || ''
  const notes = sections['Notes'] || sections['6. Notes'] || ''

  return {
    frontmatter: fm,
    componentTree,
    tokens,
    assets,
    interactions: interactions.trim(),
    notes: notes.trim(),
  }
}

function parseFrontmatter(raw) {
  const result = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/)
    if (!m) continue
    const [, key, val] = m
    if (val === 'null') { result[key] = null; continue }
    // viewport: { width: 1440, height: 900 }
    if (val.startsWith('{')) {
      const wm = val.match(/width:\s*(\d+)/)
      const hm = val.match(/height:\s*(\d+)/)
      if (wm && hm) {
        result[key] = { width: parseInt(wm[1]), height: parseInt(hm[1]) }
        continue
      }
    }
    const numVal = Number(val)
    result[key] = isNaN(numVal) ? val : numVal
  }
  return result
}

function extractSections(body) {
  const sections = {}
  const headerRe = /^##\s+(.+)$/gm
  let match
  let last = null
  let lastIndex = 0

  while ((match = headerRe.exec(body)) !== null) {
    if (last !== null) {
      sections[last] = body.slice(lastIndex, match.index)
    }
    last = match[1].trim().replace(/^\d+\.\s+/, '')
    lastIndex = match.index + match[0].length
  }
  if (last !== null) {
    sections[last] = body.slice(lastIndex)
  }
  return sections
}

function extractFencedBlock(text) {
  const m = text.match(/```(?:json)?\n([\s\S]*?)```/)
  return m ? m[1].trim() : null
}

function parseDesignTokens(text) {
  const tokens = { colors: [], fonts: [], spacings: [], radii: [], shadows: [] }
  let current = null
  for (const line of text.split('\n')) {
    if (/colors/i.test(line)) { current = 'colors'; continue }
    if (/fonts/i.test(line)) { current = 'fonts'; continue }
    if (/spacing/i.test(line)) {
      const m = line.match(/:\s*(.+)/)
      if (m) tokens.spacings = m[1].split(',').map(s => s.trim()).filter(Boolean)
      current = null; continue
    }
    if (/radii/i.test(line)) {
      const m = line.match(/:\s*(.+)/)
      if (m) tokens.radii = m[1].split(',').map(s => s.trim()).filter(Boolean)
      current = null; continue
    }
    if (/shadows/i.test(line)) {
      const m = line.match(/:\s*(.+)/)
      if (m) tokens.shadows = m[1].split(',').map(s => s.trim()).filter(Boolean)
      current = null; continue
    }
    if (current && line.includes('`')) {
      const vals = line.match(/`([^`]+)`/g)?.map(v => v.replace(/`/g, '')) || []
      tokens[current].push(...vals)
    }
  }
  return tokens
}

function parseAssets(text) {
  const assets = { images: [], fonts: [] }
  let current = null
  for (const line of text.split('\n')) {
    if (/images/i.test(line)) { current = 'images'; continue }
    if (/fonts/i.test(line)) { current = 'fonts'; continue }
    if (current && line.includes('`')) {
      const m = line.match(/`([^`]+)`/)
      if (m) assets[current].push(m[1])
    }
  }
  return assets
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const filePath = process.argv[2]
  if (!filePath) { console.error('Usage: node parse-md.mjs <file.md>'); process.exit(1) }
  const result = parseMd(filePath)
  console.log(JSON.stringify(result, null, 2))
}
