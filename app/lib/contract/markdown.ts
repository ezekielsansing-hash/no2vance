/**
 * A deliberately tiny Markdown renderer for contract text.
 *
 * The input is not arbitrary Markdown — it's our own template, so only the
 * handful of constructs used there are supported. What the input *does*
 * contain is renter-supplied values (name, address, on-site party), which is
 * why every character is HTML-escaped before any formatting is applied. A
 * general Markdown library would let raw HTML through and turn the address
 * field into an injection point.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Applied only after escaping, so it can never introduce a tag from input. */
function inline(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

/**
 * Headings and rules are each their own block even without a blank line around
 * them — the template opens with `# title` directly above `## subtitle`, and
 * splitting on blank lines alone would swallow the second into the first.
 */
function toBlocks(markdown: string): string[][] {
  const blocks: string[][] = []
  let current: string[] = []
  const flush = () => {
    if (current.length > 0) blocks.push(current)
    current = []
  }
  for (const raw of markdown.split('\n')) {
    const line = raw.trim()
    if (!line) {
      flush()
    } else if (/^(#{1,3} |---$)/.test(line)) {
      flush()
      blocks.push([line])
    } else {
      current.push(line)
    }
  }
  flush()
  return blocks
}

export function renderContractHtml(markdown: string): string {
  const html: string[] = []

  for (const lines of toBlocks(markdown)) {
    const block = lines.join('\n')

    if (block === '---') {
      html.push('<hr />')
      continue
    }
    if (block.startsWith('### ')) {
      html.push(`<h3>${inline(block.slice(4))}</h3>`)
      continue
    }
    if (block.startsWith('## ')) {
      html.push(`<h2>${inline(block.slice(3))}</h2>`)
      continue
    }
    if (block.startsWith('# ')) {
      html.push(`<h1>${inline(block.slice(2))}</h1>`)
      continue
    }
    if (lines.every((line) => line.startsWith('- '))) {
      const items = lines
        .map((line) => `<li>${inline(line.slice(2))}</li>`)
        .join('')
      html.push(`<ul>${items}</ul>`)
      continue
    }

    // Remaining blocks are paragraphs; a single newline inside one is a break.
    html.push(`<p>${lines.map(inline).join('<br />')}</p>`)
  }

  return html.join('\n')
}
