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
    // Prepends memory as a system message if present.
    const msgs = (parsed && parsed.messages) || []
    const mem = String(memoryRaw || '').trim()
    if (!mem)
      return msgs
    const role = opts.memoryRole || 'system'
    return [{ role, content: mem }, ...msgs]
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
}

module.exports = {
  ContextResolver,
}
