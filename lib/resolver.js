const fs = require('fs')
const path = require('path')
const os = require('os')

class ContextResolver {
  constructor(opts = {}) {
    this.userRoot = opts.userRoot || os.homedir()
    this.chudRoot = opts.chudRoot || path.join(this.userRoot, '.chudbot')
    this.envPath = opts.envPath || path.join(this.chudRoot, '.env')
    this.defaultChatName = opts.defaultChatName || 'chat.md'
    this.defaultMemoryName = opts.defaultMemoryName || 'memory.md'
    this.defaultMaxMessages = this._num(opts.maxMessages)
    this.defaultMaxTokens = this._num(opts.maxTokens)
  }
  resolvePaths(opts = {}) {
    // Finds chat in cwd first, then chudRoot.
    const cwd = opts.cwd || process.cwd()
    const chatName = opts.chat || this.defaultChatName
    const chatPath = this._pickPath(chatName, [cwd, this.chudRoot])
    const chatDir = path.dirname(chatPath)
    const fm = opts.frontMatter || null
    const memName = (fm && fm.memory) || opts.memory || this.defaultMemoryName
    const rootMem = path.join(this.chudRoot, this.defaultMemoryName)
    const localMem = this._pickPath(memName, [chatDir], { allowMissing: true })
    return {
      cwd,
      userRoot: this.userRoot,
      chudRoot: this.chudRoot,
      envPath: this.envPath,
      chatPath,
      rootMemoryPath: rootMem,
      localMemoryPath: localMem,
    }
  }
  readText(filePath, opts = {}) {
    // opts.required: throw if missing
    const p = String(filePath || '')
    if (!p)
      return ''
    if (!fs.existsSync(p)) {
      if (opts.required)
        throw new Error('Missing file: ' + p)
      return ''
    }
    return fs.readFileSync(p, 'utf8')
  }
  loadChat(opts = {}) {
    const paths = this.resolvePaths(opts)
    const raw = this.readText(paths.chatPath, { required: true })
    return { chatPath: paths.chatPath, raw, paths }
  }
  loadMemory(opts = {}) {
    // Merges root + local memory unless memory.override is truthy.
    const paths = this.resolvePaths(opts)
    const fm = opts.frontMatter || null
    const over = this._truthy(fm && fm['memory.override'])
    const root = this.readText(paths.rootMemoryPath)
    const local = this.readText(paths.localMemoryPath)
    let raw = ''
    if (over)
      raw = local
    else
      raw = this._joinNonEmpty(root, local)
    return { raw, paths, over }
  }
  buildMessages(parsed, memoryRaw, opts = {}) {
    // Prepends file context + memory as system messages if present.
    const msgs = (parsed && parsed.messages) || []
    const maxMessages = this._numOr(
      opts.maxMessages,
      this._num(opts.frontMatter && opts.frontMatter.max_messages),
      this.defaultMaxMessages
    )
    const maxTokens = this._numOr(
      opts.maxTokens,
      this._num(opts.frontMatter && opts.frontMatter.max_tokens),
      this.defaultMaxTokens
    )
    const trimmed = this._trimMessages(msgs, { maxMessages, maxTokens })
    const fileContext = this._buildFileContext(opts)
    const mem = String(memoryRaw || '').trim()
    if (!mem && !fileContext)
      return trimmed
    const role = opts.memoryRole || 'system'
    const out = []
    if (fileContext)
      out.push({ role, content: fileContext })
    if (mem)
      out.push({ role, content: mem })
    return [...out, ...trimmed]
  }
  readFiles(opts = {}) {
    const cwd = opts.cwd || process.cwd()
    const cliFiles = Array.isArray(opts.files) ? opts.files : []
    const fmFiles = Array.isArray(opts.frontMatter && opts.frontMatter.files)
      ? opts.frontMatter.files
      : []
    const list = [...cliFiles, ...fmFiles]
    const out = []
    for (const entry of list) {
      const s = String(entry || '').trim()
      if (!s)
        continue
      const filePath = path.resolve(cwd, s)
      const content = this.readText(filePath, { required: true })
      out.push({
        path: filePath,
        displayPath: path.relative(cwd, filePath) || '.',
        content,
      })
    }
    return out
  }
  _buildFileContext(opts = {}) {
    const files = this.readFiles(opts)
    if (!files.length)
      return ''
    const chunks = []
    for (const file of files) {
      chunks.push(
        '-- FILE: ' + file.displayPath + ' ---\n'
        + file.content
        + '\n-- END FILE ---'
      )
    }
    return chunks.join('\n\n')
  }
  _trimMessages(msgs, opts = {}) {
    const list = Array.isArray(msgs) ? msgs : []
    const maxMessages = this._num(opts.maxMessages)
    const maxTokens = this._num(opts.maxTokens)
    const hasMaxMessages = maxMessages > 0
    const hasMaxTokens = maxTokens > 0
    if (!hasMaxMessages && !hasMaxTokens)
      return list
    const pinned = []
    const normal = []
    let seed = null
    for (const msg of list) {
      const role = String(msg && msg.role || '')
      if (role === 'system') {
        pinned.push(msg)
        continue
      }
      if (!seed && role === 'user') {
        seed = msg
        continue
      }
      normal.push(msg)
    }
    let budgetMessages = maxMessages
    if (hasMaxMessages)
      budgetMessages = Math.max(0, budgetMessages - pinned.length - (seed ? 1 : 0))
    let budgetTokens = maxTokens
    if (hasMaxTokens) {
      budgetTokens = Math.max(0, budgetTokens - this._estimateMessagesTokens(pinned))
      if (seed)
        budgetTokens = Math.max(0, budgetTokens - this._estimateTokens(seed))
    }
    const keptTail = []
    let usedTokens = 0
    for (let i = normal.length - 1; i >= 0; i--) {
      if (hasMaxMessages && keptTail.length >= budgetMessages)
        break
      const msg = normal[i]
      const tok = this._estimateTokens(msg)
      if (hasMaxTokens && usedTokens + tok > budgetTokens)
        break
      keptTail.push(msg)
      usedTokens += tok
    }
    keptTail.reverse()
    const out = [...pinned]
    if (seed)
      out.push(seed)
    return [...out, ...keptTail]
  }
  _estimateMessagesTokens(msgs) {
    let sum = 0
    for (const msg of msgs || [])
      sum += this._estimateTokens(msg)
    return sum
  }
  _estimateTokens(msg) {
    const content = String(msg && msg.content || '')
    const words = content.trim() ? content.trim().split(/\s+/).length : 0
    const chars = content.length
    const byWords = words * 1.3
    const byChars = chars / 4
    return Math.max(1, Math.ceil(Math.max(byWords, byChars)))
  }
  _pickPath(name, roots, opts = {}) {
    const s = String(name || '').trim()
    if (!s)
      return ''
    if (path.isAbsolute(s))
      return s
    for (const root of roots || []) {
      const p = path.join(root, s)
      if (fs.existsSync(p))
        return p
    }
    if (opts.allowMissing)
      return path.join(roots && roots[0] ? roots[0] : '', s)
    return path.join(roots && roots[0] ? roots[0] : '', s)
  }
  _truthy(v) {
    const s = String(v || '').trim().toLowerCase()
    return s === '1' || s === 'true' || s === 'yes' || s === 'y'
  }
  _joinNonEmpty(a, b) {
    const x = String(a || '').trim()
    const y = String(b || '').trim()
    if (x && y)
      return x + '\n\n' + y
    return x || y || ''
  }
  _num(v) {
    const n = parseInt(v, 10)
    if (!Number.isFinite(n) || n <= 0)
      return 0
    return n
  }
  _numOr(...vals) {
    for (const v of vals) {
      const n = this._num(v)
      if (n)
        return n
    }
    return 0
  }
}

module.exports = {
  ContextResolver,
}
