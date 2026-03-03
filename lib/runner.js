const fs = require('fs')
const path = require('path')

class Runner {
  constructor(opts = {}) {
    this.parser = opts.parser
    this.resolver = opts.resolver
    this.provider = opts.provider
    if (!this.parser) throw new Error('Runner requires parser')
    if (!this.resolver) throw new Error('Runner requires resolver')
    if (!this.provider) throw new Error('Runner requires provider')
  }
  async runOnce(opts = {}) {
    // opts.cwd: string
    // opts.chat: string
    // opts.memory: string
    // opts.model: string
    try {
      const chat = this.resolver.loadChat(opts)
      const parsed = this.parser.parse(chat.raw, opts)
      if (!this.shouldRun(parsed, opts))
        return { ok: true, didRun: false, chatPath: chat.chatPath }
      const mem = this.resolver.loadMemory({
        ...opts,
        cwd: chat.paths.cwd,
        frontMatter: parsed.frontMatter,
      })
      const messages = this.resolver.buildMessages(parsed, mem.raw, {
        ...opts,
        frontMatter: parsed.frontMatter,
      })
      const model = opts.model || (parsed.frontMatter && parsed.frontMatter.model)
      const assistantText = await this.provider.complete(messages, { model })
      const rawNext = this.buildAppend(chat.raw, assistantText, opts)
      this.writeAll(chat.chatPath, rawNext, opts)
      return { ok: true, didRun: true, chatPath: chat.chatPath }
    } catch (err) {
      return { ok: false, didRun: false, error: err }
    }
  }
  shouldRun(parsed, opts = {}) {
    return this.parser.isRunnable(parsed, opts)
  }
  buildAppend(raw, assistantText, opts = {}) {
    const base = String(raw || '').replace(/\s+$/, '')
    const a = this.parser.formatAppendAssistant(assistantText, opts)
    const u = this.parser.formatAppendUser(opts)
    return base + a + u
  }
  writeAll(filePath, rawNext, opts = {}) {
    const dirPath = path.dirname(filePath)
    const baseName = path.basename(filePath)
    const tmpPath = path.join(
      dirPath,
      `.${baseName}.tmp-${process.pid}-${Date.now()}`,
    )
    let didRename = false
    try {
      fs.writeFileSync(tmpPath, String(rawNext || ''), 'utf8')
      fs.renameSync(tmpPath, filePath)
      didRename = true
    } finally {
      if (didRename) return
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
      } catch (_err) {
        // best-effort cleanup
      }
    }
  }
}

module.exports = { Runner }
