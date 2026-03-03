const chokidar = require('chokidar')

class Watcher {
  constructor(opts = {}) {
    this.runner = opts.runner
    this.watcher = null
    this.busy = false
    this.pending = false
    this.timer = null
    this.debounceMs = opts.debounceMs || 200
    this.onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : null
    this.quiet = opts.quiet ?? false
    if (!this.runner)
      throw new Error('Watcher requires runner')
  }
  start(opts = {}) {
    this.debounceMs = opts.debounceMs || this.debounceMs
    if (typeof opts.onEvent === 'function')
      this.onEvent = opts.onEvent
    if (this.watcher)
      return { ok: true, watching: true }

    const chatPath = this._chatPath(opts)


    this.watcher = chokidar.watch(chatPath, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 150,
        pollInterval: 25
      }
    })

    this.watcher.on('all', (evt, p) => {
      if (evt === 'add' || evt === 'change')
        this.onChange(p, opts)
    })
    this._emit('watch_start', { chatPath }, opts)

    return { ok: true, watching: true, chatPath }
  }
  async stop(opts = {}) {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.watcher) {
      const w = this.watcher
      this.watcher = null
      try { await w.close() } catch {}
    }
    this.busy = false
    this.pending = false
    this._emit('watch_stop', {}, opts)
    return { ok: true, watching: false }
  }
  _chatPath(opts = {}) {
    if (opts.chatPath)
      return String(opts.chatPath)
    if (opts.chat)
      return String(opts.chat)

    const r = this.runner.resolver
    if (!r || typeof r.resolvePaths !== 'function')
      throw new Error('Watcher requires chatPath/chat or runner.resolver.resolvePaths()')

    const out = r.resolvePaths(opts) || {}
    const chatPath = out.chatPath || null
    if (!chatPath)
      throw new Error('Missing chat path')

    return chatPath
  }
  _emit(type, payload = {}, opts = {}) {
    const fn = (opts && typeof opts.onEvent === 'function')
      ? opts.onEvent
      : this.onEvent

    if (typeof fn === 'function') {
      try {
        fn({ type, ...payload })
      } catch (e) {
        const message = e && e.message ? e.message : String(e)
        process.stderr.write('watch onEvent error: ' + message + '\n')
      }
      return
    }

    if (this.quiet)
      return

    if (type === 'watch_start') {
      if (opts && opts.suppressWatchStart)
        return
      return process.stdout.write('watching: ' + (payload.chatPath || '') + '\n')
    }

    if (type === 'signal')
      return process.stdout.write('change detected\n')

    if (type === 'pending')
      return process.stdout.write('queued\n')

    if (type === 'run_start')
      return process.stdout.write('running...\n')

    if (type === 'run_end') {
      if (payload && payload.ok)
        return process.stdout.write('done\n')
      const msg = payload && payload.error ? String(payload.error) : 'error'
      return process.stdout.write('error: ' + msg + '\n')
    }

    if (type === 'watch_stop')
      return process.stdout.write('stopped\n')
  }
  onChange(filePath, opts = {}) {
    const first = !this.timer
    if (this.timer)
      clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this._kick(opts)
    }, this.debounceMs)
    if (first)
      this._emit('signal', { filePath }, opts)
  }
  async _kick(opts = {}) {
    if (this.busy) {
      this.pending = true
      this._emit('pending', {}, opts)
      return
    }

    this.busy = true
    const start = Date.now()
    this._emit('run_start', {}, opts)

    let ok = true
    let errMsg = null

    try {
      const res = await this.runner.runOnce(opts)
      if (res && res.ok === false) {
        ok = false
        const err = res.error
        errMsg = err && err.message ? err.message : String(err || 'error')
      }
    } catch (err) {
      ok = false
      errMsg = err && err.message ? err.message : String(err)
    }

    this._emit('run_end', { ok, ms: Date.now() - start, error: errMsg }, opts)
    this.busy = false

    if (this.pending) {
      this.pending = false
      await this._kick(opts)
    }
  }
}

module.exports = { Watcher }
