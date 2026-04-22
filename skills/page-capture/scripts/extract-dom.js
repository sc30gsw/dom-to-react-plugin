/**
 * DOM walker injected via mcp__chrome-devtools__evaluate_script.
 * Returns JSON-serializable tree of DOM nodes with computed styles.
 *
 * Usage:
 *   const result = await evaluate_script({ script: fs.readFileSync('extract-dom.js', 'utf8') })
 *
 * The function is self-invoking so evaluate_script can call it directly.
 */
(function extractDom() {
  const STYLE_WHITELIST = [
    // Layout
    'display', 'position', 'top', 'right', 'bottom', 'left',
    'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'alignSelf',
    'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'gap', 'rowGap', 'columnGap',
    'gridTemplateColumns', 'gridTemplateRows', 'gridColumn', 'gridRow', 'gridArea',
    // Box
    'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
    'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'boxSizing', 'overflow', 'overflowX', 'overflowY', 'zIndex',
    // Typography
    'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
    'textAlign', 'textTransform', 'textDecoration', 'textOverflow', 'whiteSpace',
    'color',
    // Visual
    'background', 'backgroundColor', 'backgroundImage', 'backgroundSize',
    'backgroundPosition', 'backgroundRepeat',
    'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
    'borderBottomLeftRadius', 'borderBottomRightRadius',
    'border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
    'borderColor', 'borderWidth', 'borderStyle',
    'boxShadow', 'opacity', 'filter', 'backdropFilter', 'visibility',
    // Motion
    'transition', 'transform', 'animation',
  ]

  // CSS defaults that are almost always inherited/reset — skip if unchanged from parent
  const SKIP_IF_DEFAULT = {
    display: 'inline',
    position: 'static',
    top: 'auto', right: 'auto', bottom: 'auto', left: 'auto',
    margin: '0px', marginTop: '0px', marginRight: '0px', marginBottom: '0px', marginLeft: '0px',
    padding: '0px', paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px',
    opacity: '1',
    visibility: 'visible',
    zIndex: 'auto',
    overflow: 'visible', overflowX: 'visible', overflowY: 'visible',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    flexGrow: '0',
    flexShrink: '1',
    flexBasis: 'auto',
    gap: 'normal', rowGap: 'normal', columnGap: 'normal',
    backgroundImage: 'none',
    backgroundSize: 'auto',
    backgroundPosition: '0% 0%',
    backgroundRepeat: 'repeat',
    border: '',
    borderWidth: '0px',
    borderStyle: 'none',
    borderColor: 'currentcolor',
    boxShadow: 'none',
    filter: 'none',
    backdropFilter: 'none',
    transform: 'none',
    transition: 'all 0s ease 0s',
    animation: 'none',
    textDecoration: 'none solid currentcolor',
    textOverflow: 'clip',
    textTransform: 'none',
    whiteSpace: 'normal',
    letterSpacing: 'normal',
  }

  const MAX_SVG_INLINE_BYTES = 2048
  const MAX_DEPTH = 25
  const MAX_TEXT_LENGTH = 500

  function camelToKebab(str) {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase()
  }

  function getFilteredStyles(el, parentStyles) {
    const cs = window.getComputedStyle(el)
    const result = {}
    for (const prop of STYLE_WHITELIST) {
      const val = cs[prop]
      if (!val || val === '') continue
      const defaultVal = SKIP_IF_DEFAULT[prop]
      const parentVal = parentStyles ? parentStyles[prop] : undefined
      // skip if same as default AND same as parent (or no parent)
      if (defaultVal !== undefined && val === defaultVal && (parentVal === undefined || val === parentVal)) continue
      // skip if identical to parent (inherited)
      if (parentVal !== undefined && val === parentVal) {
        // keep typography and color even if inherited — they're important for react
        const keepAlways = ['fontFamily', 'fontSize', 'fontWeight', 'color', 'lineHeight']
        if (!keepAlways.includes(prop)) continue
      }
      result[prop] = val
    }
    return result
  }

  function getAttrs(el) {
    const attrs = {}
    for (const attr of el.attributes) {
      if (['class', 'style', 'id'].includes(attr.name)) continue
      attrs[attr.name] = attr.value
    }
    return Object.keys(attrs).length > 0 ? attrs : undefined
  }

  function hasOnClick(el) {
    // detect event listeners via getEventListeners is only in devtools context
    // fallback: check onclick attribute
    return el.hasAttribute('onclick') || el.tagName === 'BUTTON' || el.tagName === 'A'
  }

  function walkNode(el, depth, parentStyles) {
    if (depth > MAX_DEPTH) return null
    if (el.nodeType === Node.TEXT_NODE) return null

    const tag = el.tagName ? el.tagName.toLowerCase() : null
    if (!tag) return null

    // skip invisible meta-elements
    if (['script', 'style', 'noscript', 'head', 'meta', 'link', 'template'].includes(tag)) return null

    const computed = getFilteredStyles(el, parentStyles)

    // SVG: inline if small enough
    if (tag === 'svg') {
      const html = el.outerHTML
      return {
        tag,
        id: el.id || undefined,
        classes: el.className && el.className.baseVal !== undefined
          ? Array.from(el.classList)
          : (el.className ? el.className.split(' ').filter(Boolean) : undefined),
        computed: Object.keys(computed).length > 0 ? computed : undefined,
        svgOuterHTML: html.length <= MAX_SVG_INLINE_BYTES
          ? html
          : `[SVG too large: ${html.length} bytes — see assets]`,
      }
    }

    // Image
    if (tag === 'img') {
      return {
        tag,
        id: el.id || undefined,
        classes: el.className ? el.className.split(' ').filter(Boolean) : undefined,
        attrs: { src: el.currentSrc || el.src, alt: el.alt, srcset: el.getAttribute('srcset') || undefined },
        computed: Object.keys(computed).length > 0 ? computed : undefined,
      }
    }

    // Text content (leaf with no interesting children)
    const directText = Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent.trim())
      .filter(Boolean)
      .join(' ')
      .slice(0, MAX_TEXT_LENGTH)

    const children = []
    for (const child of el.children) {
      const childNode = walkNode(child, depth + 1, computed)
      if (childNode) children.push(childNode)
    }

    return {
      tag,
      id: el.id || undefined,
      classes: el.className ? el.className.split(' ').filter(Boolean) : undefined,
      attrs: getAttrs(el),
      text: directText || undefined,
      computed: Object.keys(computed).length > 0 ? computed : undefined,
      hasOnClick: hasOnClick(el) || undefined,
      children: children.length > 0 ? children : undefined,
    }
  }

  function extractAssets() {
    const images = Array.from(document.querySelectorAll('img[src]'))
      .map(img => ({ src: img.currentSrc || img.src, alt: img.alt }))
    const fonts = Array.from(document.styleSheets)
      .flatMap(sheet => {
        try {
          return Array.from(sheet.cssRules || [])
            .filter(r => r instanceof CSSFontFaceRule)
            .map(r => r.cssText.slice(0, 300))
        } catch { return [] }
      })
    return { images, fonts }
  }

  function extractInteractions() {
    const forms = Array.from(document.querySelectorAll('form')).map(f => ({
      id: f.id || undefined,
      action: f.action || undefined,
      method: f.method || undefined,
    }))
    const links = Array.from(document.querySelectorAll('a[href]')).map(a => ({
      text: a.textContent.trim().slice(0, 100),
      href: a.getAttribute('href'),
    })).slice(0, 20)
    return { forms, links }
  }

  const body = document.body || document.documentElement
  const tree = walkNode(body, 0, null)
  const assets = extractAssets()
  const interactions = extractInteractions()

  return JSON.stringify({ tree, assets, interactions })
})()
