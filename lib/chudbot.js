const os = require('os')
const path = require('path')

const { Runner } = require('./runner')
const { Watcher } = require('./watcher')
const { ChatParser } = require('./parser')
const { Provider } = require('./provider')
const { ContextResolver } = require('./resolver')
const { EnvLoader, Initializer } = require('./initializer')

const ANSI_DIM = '\x1b[2m'
const ANSI_RESET = '\x1b[0m'

class Spinner {
  constructor() {
    this.spinner = null
    this.spinnerFrame = 0
    this.spinnerFrames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']
    this.spinnerActive = false
  }
  startSpinner(label = 'thinking') {
    if (this.spinnerActive) return
    this.spinnerActive = true
    process.stdout.write(ANSI_DIM)
    this.spinner = setInterval(() => {
      const index = this.spinnerFrame++ % this.spinnerFrames.length
      const frame = this.spinnerFrames[index]
      process.stdout.write('\r' + frame + ' ' + label)
    }, 80)
  }
  stopSpinner() {
    if (!this.spinnerActive) return
    clearInterval(this.spinner)
    this.spinner = null
    this.spinnerActive = false
    process.stdout.write('\r\x1b[K')
    process.stdout.write(ANSI_RESET)
  }
}

class Chudbot {
  constructor(opts = {}) {
    this.userRoot = opts.userRoot || os.homedir()
    this.chudRoot = opts.chudRoot || path.join(this.userRoot, '.chudbot')
    this.envPath = opts.envPath || path.join(this.chudRoot, '.env')

    this.parser = new ChatParser(opts)
    this.resolver = new ContextResolver({
      ...opts,
      userRoot: this.userRoot,
      chudRoot: this.chudRoot,
      envPath: this.envPath,
    })
    this.env = new EnvLoader({
      ...opts,
      userRoot: this.userRoot,
      chudRoot: this.chudRoot,
      envPath: this.envPath,
    })
    this.initializer = new Initializer({
      ...opts,
      userRoot: this.userRoot,
      chudRoot: this.chudRoot,
      envPath: this.envPath,
    })

    this.initializer.initRoot({ makeEnv: true })
    this.env.load({ envPath: this.envPath, required: false, override: false })

    this.provider = new Provider(opts)
    this.runner = new Runner({
      parser: this.parser,
      resolver: this.resolver,
      provider: this.provider,
    })
    const spinner = new Spinner()
    this.watcher = new Watcher({
      runner: this.runner,
      debounceMs: opts.debounceMs,
      onEvent: (evt) => {
        if (evt.type === 'signal')
          spinner.startSpinner('thinking')
        if (evt.type === 'run_end')
          spinner.stopSpinner()
      },
    })
  }
  init(opts = {}) {
    // opts.cwd, opts.chat, opts.force, opts.system
    return this.initializer.initChat(opts)
  }
  async run(opts = {}) {
    // opts.cwd, opts.chat, opts.memory, opts.model
    return await this.runner.runOnce(opts)
  }
  watch(opts = {}) {
    // opts.cwd, opts.chat, opts.memory, opts.model, opts.debounceMs
    return this.watcher.start({ ...opts, suppressWatchStart: true })
  }
  async stop() {
    return await this.watcher.stop()
  }
}

module.exports = { Chudbot }
