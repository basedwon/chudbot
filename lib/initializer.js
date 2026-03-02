const fs = require('fs')
const path = require('path')
const os = require('os')
const dotenv = require('dotenv')

class EnvLoader {
  constructor(opts = {}) {
    this.userRoot = opts.userRoot || os.homedir()
    this.chudRoot = opts.chudRoot || path.join(this.userRoot, '.chudbot')
    this.envPath = opts.envPath || path.join(this.chudRoot, '.env')
  }
  load(opts = {}) {
    // Loads env vars from envPath into process.env.
    // opts.envPath: string (override)
    // opts.override: boolean (default false)
    // opts.required: boolean (default false)
    const envPath = opts.envPath || this.envPath
    const override = opts.override ?? false
    const required = opts.required ?? false
    if (!fs.existsSync(envPath)) {
      if (required)
        throw new Error('Missing env file: ' + envPath)
      return { ok: true, envPath, loaded: false }
    }
    const res = dotenv.config({ path: envPath, override, quiet: true })
    if (res && res.error)
      throw res.error
    return { ok: true, envPath, loaded: true }
  }
}

class Initializer {
  constructor(opts = {}) {
    this.userRoot = opts.userRoot || os.homedir()
    this.chudRoot = opts.chudRoot || path.join(this.userRoot, '.chudbot')
    this.envPath = opts.envPath || path.join(this.chudRoot, '.env')
    this.defaultChatName = opts.defaultChatName || 'chat.md'
  }
  initRoot(opts = {}) {
    // Create chudRoot and (optionally) starter .env.
    // opts.makeEnv: boolean (default true)
    const makeEnv = opts.makeEnv ?? true
    fs.mkdirSync(this.chudRoot, { recursive: true })
    const b = makeEnv
      ? this.writeIfMissing(this.envPath, this.defaultEnv(), { force: false })
      : { didWrite: false }
    return {
      ok: true,
      chudRoot: this.chudRoot,
      envPath: this.envPath,
      didWriteEnv: b.didWrite,
    }
  }
  initChat(opts = {}) {
    // Create starter chat in opts.cwd.
    // opts.cwd: string (default process.cwd())
    // opts.chat: string (default chat.md)
    // opts.force: boolean
    // opts.system: string
    const cwd = opts.cwd || process.cwd()
    const chat = opts.chat || this.defaultChatName
    const force = opts.force ?? false
    const chatPath = path.isAbsolute(chat) ? chat : path.join(cwd, chat)
    const a = this.writeIfMissing(
      chatPath,
      this.defaultChat({ system: opts.system }),
      { force }
    )
    return { ok: true, chatPath, didWriteChat: a.didWrite }
  }
  init(opts = {}) {
    // Convenience: initRoot + initChat.
    const root = this.initRoot({ makeEnv: opts.makeEnv })
    const chat = this.initChat(opts)
    return {
      ok: true,
      chudRoot: root.chudRoot,
      envPath: root.envPath,
      chatPath: chat.chatPath,
      didWriteEnv: root.didWriteEnv,
      didWriteChat: chat.didWriteChat,
    }
  }
  defaultChat(opts = {}) {
    // System + empty user header.
    const system = String(opts.system || 'You are a helpful assistant.').trim()
    return [
      '# %% system',
      system,
      '',
      '# %% user',
      '',
    ].join('\n')
  }
  defaultEnv() {
    // Minimal template.
    return [
      '# Chudbot env',
      '# Put your key here:',
      'OPENROUTER_API_KEY=REPLACE_ME',
      'OPENROUTER_MODEL=openrouter/free',
      '',
    ].join('\n')
  }
  writeIfMissing(filePath, content, opts = {}) {
    // Write only if missing unless force.
    const force = opts.force ?? false
    const p = String(filePath || '')
    if (!p)
      throw new Error('Missing filePath')
    if (fs.existsSync(p) && !force)
      return { didWrite: false }
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, String(content || ''), 'utf8')
    return { didWrite: true }
  }
}

module.exports = { EnvLoader, Initializer }
