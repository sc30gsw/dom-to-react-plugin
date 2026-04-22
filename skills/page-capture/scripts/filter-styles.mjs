/**
 * Post-processor for extracted DOM JSON.
 * In tokenized mode: extracts design tokens from computed styles.
 * In verbatim mode: passes styles through with minor normalization.
 */

/**
 * @param {object} tree - Component tree from extract-dom.js
 * @param {'verbatim'|'tokenized'} mode
 * @returns {{ tree: object, tokens: object }}
 */
export function processStyles(tree, mode) {
  if (mode === 'tokenized') {
    const collector = new TokenCollector()
    const processed = collectTokens(tree, collector)
    return { tree: processed, tokens: collector.summarize() }
  }
  return { tree, tokens: deriveTokensFromTree(tree) }
}

class TokenCollector {
  constructor() {
    this.colors = new Map()      // value -> count
    this.fonts = new Map()       // value -> count
    this.spacings = new Map()    // value -> count
    this.radii = new Map()
    this.shadows = new Map()
  }

  record(prop, value) {
    if (!value) return
    const isColor = /color|background/i.test(prop) && /^(#|rgb|hsl|oklch)/.test(value.trim())
    const isFont = /fontFamily/i.test(prop)
    const isSpacing = /^(padding|margin|gap|width|height|fontSize|lineHeight)/.test(prop)
    const isRadius = /borderRadius/i.test(prop)
    const isShadow = /boxShadow/i.test(prop)

    if (isColor) this.colors.set(value, (this.colors.get(value) || 0) + 1)
    else if (isFont) this.fonts.set(value, (this.fonts.get(value) || 0) + 1)
    else if (isRadius) this.radii.set(value, (this.radii.get(value) || 0) + 1)
    else if (isShadow) this.shadows.set(value, (this.shadows.get(value) || 0) + 1)
    else if (isSpacing) this.spacings.set(value, (this.spacings.get(value) || 0) + 1)
  }

  summarize() {
    const topN = (map, n = 15) =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([v]) => v)

    return {
      colors: topN(this.colors),
      fonts: topN(this.fonts, 5),
      spacings: topN(this.spacings, 10),
      radii: topN(this.radii, 8),
      shadows: topN(this.shadows, 5),
    }
  }
}

function collectTokens(node, collector) {
  if (!node) return node
  if (node.computed) {
    for (const [prop, val] of Object.entries(node.computed)) {
      collector.record(prop, val)
    }
  }
  if (node.children) {
    return { ...node, children: node.children.map(c => collectTokens(c, collector)) }
  }
  return node
}

function deriveTokensFromTree(node) {
  const colors = new Set()
  const fonts = new Set()
  const shadows = new Set()
  const radii = new Set()

  function walk(n) {
    if (!n?.computed) return
    const c = n.computed
    if (c.color) colors.add(c.color)
    if (c.backgroundColor) colors.add(c.backgroundColor)
    if (c.background && /^(#|rgb|hsl)/.test(c.background.trim())) colors.add(c.background)
    if (c.fontFamily) fonts.add(c.fontFamily)
    if (c.boxShadow && c.boxShadow !== 'none') shadows.add(c.boxShadow)
    if (c.borderRadius) radii.add(c.borderRadius)
    n.children?.forEach(walk)
  }
  walk(node)

  return {
    colors: [...colors].slice(0, 15),
    fonts: [...fonts].slice(0, 5),
    shadows: [...shadows].slice(0, 5),
    radii: [...radii].slice(0, 8),
    spacings: [],
  }
}
