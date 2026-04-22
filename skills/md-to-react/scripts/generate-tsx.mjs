/**
 * Converts parsed page-capture data into a React TSX component.
 *
 * Usage:
 *   node generate-tsx.mjs <parsed.json> <options.json>
 *
 * options: { name, styling: 'tailwind'|'css-modules', outDir, mode }
 *
 * Outputs <outDir>/<Name>.tsx and optionally <outDir>/<Name>.module.css
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'

const args = process.argv.slice(2)
if (args.length < 2) {
  console.error('Usage: node generate-tsx.mjs <parsed.json> <options.json>')
  process.exit(1)
}

const parsed = JSON.parse(readFileSync(resolve(args[0]), 'utf8'))
const opts = JSON.parse(readFileSync(resolve(args[1]), 'utf8'))

const { name, styling, outDir, mode } = opts
const { componentTree, tokens, frontmatter } = parsed

// ── Tailwind value mapping ────────────────────────────────────────────────────
// Maps common computed style values to approximate Tailwind v4 classes.
// Unmapped values fall back to inline style={{ }}.
const PX_TO_TAILWIND_SPACING = {
  '0px': '0', '2px': '0.5', '4px': '1', '8px': '2', '12px': '3',
  '16px': '4', '20px': '5', '24px': '6', '28px': '7', '32px': '8',
  '36px': '9', '40px': '10', '48px': '12', '56px': '14', '64px': '16',
  '80px': '20', '96px': '24', '128px': '32',
}
const DISPLAY_TO_TAILWIND = {
  'flex': 'flex', 'inline-flex': 'inline-flex', 'grid': 'grid',
  'inline-grid': 'inline-grid', 'block': 'block', 'inline-block': 'inline-block',
  'inline': 'inline', 'none': 'hidden',
}
const FLEX_DIRECTION = { 'row': 'flex-row', 'column': 'flex-col', 'row-reverse': 'flex-row-reverse', 'column-reverse': 'flex-col-reverse' }
const JUSTIFY = { 'flex-start': 'justify-start', 'flex-end': 'justify-end', 'center': 'justify-center', 'space-between': 'justify-between', 'space-around': 'justify-around', 'space-evenly': 'justify-evenly' }
const ALIGN = { 'flex-start': 'items-start', 'flex-end': 'items-end', 'center': 'items-center', 'stretch': 'items-stretch', 'baseline': 'items-baseline' }

function pxToTailwind(prefix, val) {
  const tw = PX_TO_TAILWIND_SPACING[val]
  return tw !== undefined ? `${prefix}-${tw}` : null
}

function styleToTailwind(computed) {
  const classes = []
  const inline = {}

  if (computed.display) {
    const tw = DISPLAY_TO_TAILWIND[computed.display]
    tw ? classes.push(tw) : (inline.display = computed.display)
  }
  if (computed.flexDirection) {
    const tw = FLEX_DIRECTION[computed.flexDirection]
    tw ? classes.push(tw) : (inline.flexDirection = computed.flexDirection)
  }
  if (computed.justifyContent) {
    const tw = JUSTIFY[computed.justifyContent]
    tw ? classes.push(tw) : (inline.justifyContent = computed.justifyContent)
  }
  if (computed.alignItems) {
    const tw = ALIGN[computed.alignItems]
    tw ? classes.push(tw) : (inline.alignItems = computed.alignItems)
  }
  if (computed.gap) {
    const tw = pxToTailwind('gap', computed.gap)
    tw ? classes.push(tw) : (inline.gap = computed.gap)
  }

  // Padding (compound → individual)
  const padMap = { padding: 'p', paddingTop: 'pt', paddingRight: 'pr', paddingBottom: 'pb', paddingLeft: 'pl' }
  for (const [prop, prefix] of Object.entries(padMap)) {
    if (computed[prop]) {
      const tw = pxToTailwind(prefix, computed[prop])
      tw ? classes.push(tw) : (inline[prop] = computed[prop])
    }
  }

  // Margin
  const marginMap = { margin: 'm', marginTop: 'mt', marginRight: 'mr', marginBottom: 'mb', marginLeft: 'ml' }
  for (const [prop, prefix] of Object.entries(marginMap)) {
    if (computed[prop]) {
      const tw = pxToTailwind(prefix, computed[prop])
      tw ? classes.push(tw) : (inline[prop] = computed[prop])
    }
  }

  // Width/Height
  if (computed.width && computed.width !== 'auto') {
    const tw = pxToTailwind('w', computed.width)
    tw ? classes.push(tw) : (inline.width = computed.width)
  }
  if (computed.height && computed.height !== 'auto') {
    const tw = pxToTailwind('h', computed.height)
    tw ? classes.push(tw) : (inline.height = computed.height)
  }

  // Pass-through for complex values (colors, fonts, shadows, gradients)
  for (const prop of ['color', 'backgroundColor', 'background', 'backgroundImage',
    'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
    'borderRadius', 'border', 'boxShadow', 'opacity', 'position',
    'top', 'right', 'bottom', 'left', 'overflow', 'transform', 'transition',
    'filter', 'backdropFilter', 'zIndex', 'textAlign', 'textTransform',
    'textDecoration', 'whiteSpace', 'textOverflow']) {
    if (computed[prop]) inline[prop] = computed[prop]
  }

  return { classes, inline }
}

// ── CSS Modules style generation ──────────────────────────────────────────────
let cssModuleIndex = 0
const cssModuleRules = [] // [{ className, styles }]

function styleToModuleClass(computed) {
  const className = `node${++cssModuleIndex}`
  const rules = Object.entries(computed)
    .map(([k, v]) => `  ${kebab(k)}: ${v};`)
    .join('\n')
  cssModuleRules.push({ className, rules })
  return className
}

function kebab(camel) {
  return camel.replace(/([A-Z])/g, '-$1').toLowerCase()
}

// ── TSX node renderer ─────────────────────────────────────────────────────────
function renderNode(node, depth = 0, stylingMode = 'tailwind') {
  if (!node) return ''
  const indent = '  '.repeat(depth + 1)
  const { tag, id, classes = [], attrs = {}, text, computed = {}, children = [], svgOuterHTML, hasOnClick } = node

  // SVG: embed as dangerouslySetInnerHTML wrapper if present
  if (tag === 'svg' && svgOuterHTML) {
    return `${indent}<div${id ? ` id="${id}"` : ''} dangerouslySetInnerHTML={{ __html: \`${svgOuterHTML.replace(/`/g, '\\`')}\` }} />`
  }

  // Attributes
  const attrParts = []
  if (id) attrParts.push(`id="${id}"`)

  // Classes from original DOM
  const domClasses = classes.join(' ')

  let styleAttr = ''
  let classAttr = domClasses ? `className="${domClasses}"` : ''

  if (Object.keys(computed).length > 0) {
    if (stylingMode === 'tailwind') {
      const { classes: twClasses, inline } = styleToTailwind(computed)
      const allClasses = [...(domClasses ? [domClasses] : []), ...twClasses].join(' ')
      if (allClasses) classAttr = `className="${allClasses}"`
      if (Object.keys(inline).length > 0) {
        const inlineStr = Object.entries(inline)
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join(', ')
        styleAttr = `style={{ ${inlineStr} }}`
      }
    } else {
      // css-modules
      const modClass = styleToModuleClass(computed)
      const allClasses = [...(domClasses ? [domClasses] : []), `styles.${modClass}`].join(' ')
      classAttr = `className={\`${allClasses}\`}`
    }
  }

  if (classAttr) attrParts.push(classAttr)
  if (styleAttr) attrParts.push(styleAttr)

  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null) continue
    // map HTML attrs to JSX
    const jsxKey = k === 'for' ? 'htmlFor' : k === 'class' ? 'className' : k
    attrParts.push(`${jsxKey}="${v}"`)
  }
  if (hasOnClick) attrParts.push('onClick={() => {}}')

  const attrStr = attrParts.length ? ' ' + attrParts.join(' ') : ''

  // Self-closing tags
  const VOID = ['img', 'input', 'br', 'hr', 'meta', 'link']
  if (VOID.includes(tag)) {
    return `${indent}<${tag}${attrStr} />`
  }

  // Leaf node
  if (!children?.length && !text) {
    return `${indent}<${tag}${attrStr} />`
  }

  const childLines = []
  if (text && !children?.length) {
    // Wrap text in JSX expression if it contains angle brackets to avoid being parsed as JSX tags
    const safeText = /[<>]/.test(text) ? `{'${text.replace(/'/g, "\\'")}'}` : text
    childLines.push(`${indent}  ${safeText}`)
  }
  for (const child of children || []) {
    const rendered = renderNode(child, depth + 1, stylingMode)
    if (rendered) childLines.push(rendered)
  }

  if (childLines.length === 0) {
    return `${indent}<${tag}${attrStr} />`
  }
  return `${indent}<${tag}${attrStr}>\n${childLines.join('\n')}\n${indent}</${tag}>`
}

// ── Component assembly ────────────────────────────────────────────────────────
const stylingMode = styling || 'tailwind'
cssModuleIndex = 0
cssModuleRules.length = 0

const bodyJSX = renderNode(componentTree, 0, stylingMode)

const importLine = stylingMode === 'css-modules'
  ? `import styles from './${name}.module.css'`
  : ''

const tsxContent = `${importLine ? importLine + '\n\n' : ''}export default function ${name}() {
  return (
${bodyJSX}
  )
}
`

// ── Write output ──────────────────────────────────────────────────────────────
const out = resolve(outDir)
mkdirSync(out, { recursive: true })

const tsxPath = `${out}/${name}.tsx`
writeFileSync(tsxPath, tsxContent, 'utf8')
console.log(`[generate-tsx] Written: ${tsxPath}`)

if (stylingMode === 'css-modules' && cssModuleRules.length > 0) {
  const cssContent = cssModuleRules
    .map(({ className, rules }) => `.${className} {\n${rules}\n}`)
    .join('\n\n')
  const cssPath = `${out}/${name}.module.css`
  writeFileSync(cssPath, cssContent, 'utf8')
  console.log(`[generate-tsx] Written: ${cssPath}`)
}
