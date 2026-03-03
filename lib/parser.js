class ChatParser {
  constructor(opts = {}) {
    this.eol = opts.eol || '\n'
    this.headerRe = opts.headerRe || /^#\s*%%\s*(\w+)\s*$/
    this.allowedRoles = opts.allowedRoles || {
      system: true,
      user: true,
      assistant: true,
      agent: true,
    }
  }
  parse(raw, opts = {}) {
    raw = String(raw || '')
    const fm = this.parseFrontMatter(raw)
    if (fm && fm.body != null)
      raw = fm.body
    const blocks = this.parseBlocks(raw, opts)
    const messages = blocks.map((b) => ({ role: b.role, content: b.content }))
    return {
      frontMatter: fm ? fm.data : {},
      blocks,
      messages,
    }
  }
  parseFile(filePath, opts = {}) {
    const raw = require('fs').readFileSync(filePath, 'utf8')
    return this.parse(raw, { ...opts, filePath })
  }
  parseFrontMatter(raw) {
    // Minimal YAML-ish front matter:
    // ---
    // model: openrouter/free
    // memory: memory.md
    // ---
    // Supports top-level key: value pairs and simple list values:
    // files:
    //   - a
    //   - b
    const s = String(raw || '')
    const open = s.match(/^---(?:\r\n|\n|\r)/)
    if (!open)
      return null
    const openEnd = open[0].length
    let i = openEnd
    let headEnd = -1
    let bodyStart = s.length
    while (i <= s.length) {
      let j = i
      while (j < s.length && s[j] !== '\n' && s[j] !== '\r')
        j += 1
      const line = s.slice(i, j)
      let next = j
      if (s[j] === '\r' && s[j + 1] === '\n')
        next += 2
      else if (s[j] === '\r' || s[j] === '\n')
        next += 1
      if (line === '---') {
        headEnd = i
        bodyStart = next
        break
      }
      if (j >= s.length)
        break
      i = next
    }
    if (headEnd === -1)
      return null
    const head = s.slice(openEnd, headEnd)
    const body = s.slice(bodyStart)
    const data = {}
    let listKey = ''
    for (const line of head.split(/\r?\n/)) {
      const rawLine = String(line || '')
      const t = rawLine.trim()
      if (!t || t.startsWith('#'))
        continue
      if (listKey) {
        const m = rawLine.match(/^\s*-\s*(.*)$/)
        if (m) {
          let item = String(m[1] || '').trim()
          if ((item.startsWith('"') && item.endsWith('"')) ||
            (item.startsWith("'") && item.endsWith("'")))
            item = item.slice(1, -1)
          if (item)
            data[listKey].push(item)
          continue
        }
        listKey = ''
      }
      const ii = t.indexOf(':')
      if (ii === -1)
        continue
      const k = t.slice(0, ii).trim()
      let v = t.slice(ii + 1).trim()
      if (k === 'files' && !v) {
        data.files = []
        listKey = 'files'
        continue
      }
      if ((v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1)
      if (k)
        data[k] = v
    }
    return { data, body }
  }
  parseBlocks(raw, opts = {}) {
    const lines = String(raw || '').split(/\r?\n/)
    const blocks = []
    let cur = null
    let buf = []
    const push = () => {
      if (!cur)
        return
      const content = buf.join(this.eol).replace(/\s+$/,'')
      blocks.push({ role: cur, content })
      buf = []
    }
    for (const line of lines) {
      const m = String(line || '').match(this.headerRe)
      if (m) {
        push()
        let role = String(m[1] || '').toLowerCase()
        if (role === 'agent')
          role = 'assistant'
        if (!this.allowedRoles[role]) {
          if (opts.allowUnknown)
            cur = role
          else
            throw new Error('Unknown role: ' + role)
        } else {
          cur = role
        }
        continue
      }
      if (cur)
        buf.push(line)
    }
    push()
    return blocks
  }
  isRunnable(parsed, opts = {}) {
    const minLen = Number(opts.minLen || 1)
    const last = this.getLastBlock(parsed)
    if (!last || last.role !== 'user')
      return false
    return String(last.content || '').trim().length >= minLen
  }
  getLastBlock(parsed) {
    const blocks = parsed && parsed.blocks
    if (!Array.isArray(blocks) || !blocks.length)
      return null
    return blocks[blocks.length - 1]
  }
  formatAppendAssistant(text, opts = {}) {
    const trim = opts.trim ?? true
    const body = trim ? String(text || '').trim() : String(text || '')
    return this.eol + this.eol + '# %% assistant' + this.eol + body
  }
  formatAppendUser() {
    return this.eol + this.eol + '# %% user' + this.eol
  }
}

module.exports = { ChatParser }
