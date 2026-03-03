const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const { expect } = require('chai')

const { main } = require('../../bin/chudbot-cli')

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'chudbot-cli-'))
}

function readFixture(name) {
  return fs.readFileSync(path.join(__dirname, '../fixtures/cli', name), 'utf8')
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
}

function runCli(args, opts = {}) {
  const cliPath = path.join(__dirname, '../../bin/chudbot-cli.js')
  const env = {
    ...process.env,
    HOME: opts.home || mktemp(),
    CHUDBOT_AUTO_UPDATE: '0',
  }
  return spawnSync('node', [cliPath, ...args], {
    cwd: opts.cwd,
    env,
    encoding: 'utf8',
    timeout: opts.timeout,
    killSignal: opts.killSignal,
  })
}

describe('CLI integration', () => {
  it('init creates a chat file with the requested name', () => {
    const home = mktemp()
    const cwd = mktemp()
    const out = runCli([
      '--no-update-check',
      'init',
      '-C',
      cwd,
      '-f',
      'session.md',
    ], { home })

    expect(out.status).to.equal(0)
    expect(out.stdout).to.include('created:')

    const chatPath = path.join(cwd, 'session.md')
    const raw = fs.readFileSync(chatPath, 'utf8')
    expect(raw).to.include('# %% system')
    expect(raw).to.include('# %% user')
  })

  it('run prints no-op and does not modify file when not runnable', () => {
    const home = mktemp()
    const cwd = mktemp()
    const chatPath = path.join(cwd, 'noop.md')
    const before = readFixture('noop-assistant-tail.md')
    writeFile(chatPath, before)

    const out = runCli([
      '--no-update-check',
      'run',
      '-C',
      cwd,
      '--chat',
      'noop.md',
    ], { home })

    expect(out.status).to.equal(0)
    expect(out.stdout).to.include('no-op: chat did not end with a non-empty')
    expect(fs.readFileSync(chatPath, 'utf8')).to.equal(before)
  })

  it('run respects -C and --chat when resolving the chat file', () => {
    const home = mktemp()
    const temp = mktemp()
    const work = path.join(temp, 'work')
    const chatPath = path.join(work, 'thread.md')
    const before = readFixture('noop-assistant-tail.md')
    writeFile(chatPath, before)

    const out = runCli([
      '--no-update-check',
      'run',
      '-C',
      work,
      '--chat',
      'thread.md',
    ], { home, cwd: temp })

    expect(out.status).to.equal(0)
    expect(out.stdout).to.include('no-op: chat did not end with a non-empty')
    expect(fs.readFileSync(chatPath, 'utf8')).to.equal(before)
  })

  it('parses -f, -files, --max-messages, --max-tokens for run', async () => {
    const calls = { ctor: null, run: null }

    class FakeChudbot {
      constructor(opts) {
        calls.ctor = opts
      }
      async run(opts) {
        calls.run = opts
        return { ok: true, didRun: false, chatPath: '/tmp/chat.md' }
      }
    }

    await main([
      'node',
      'chudbot',
      '--no-update-check',
      '--max-messages',
      '41',
      '--max-tokens',
      '900',
      'run',
      '-C',
      '/tmp/room',
      '--chat',
      'thread.md',
      '-f',
      'ctx/a.md',
      '-f',
      'ctx/b.md',
      '-files',
      'ctx/c.md,ctx/d.md',
      '--max-messages',
      '7',
      '--max-tokens',
      '88',
    ], { Chudbot: FakeChudbot })

    expect(calls.run).to.deep.equal({
      cwd: '/tmp/room',
      chat: 'thread.md',
      memory: undefined,
      model: undefined,
      files: ['ctx/a.md', 'ctx/b.md', 'ctx/c.md', 'ctx/d.md'],
      maxMessages: 7,
      maxTokens: 88,
    })
  })

  it('watch prints one watching line and keeps tip output', () => {
    const home = mktemp()
    const cwd = mktemp()
    writeFile(path.join(cwd, 'chat.md'), readFixture('noop-assistant-tail.md'))

    const out = runCli([
      '--no-update-check',
      'watch',
      '-C',
      cwd,
      '--chat',
      'chat.md',
      '--debounce-ms',
      '50',
    ], { home, timeout: 400, killSignal: 'SIGTERM' })

    const lines = out.stdout.split(/\r?\n/).filter(Boolean)
    const watching = lines.filter(line => line.startsWith('watching:'))

    expect(watching).to.have.length(1)
    expect(out.stdout).to.include('tip: edit the last # %% user block')
    expect(out.stdout).to.include('tip: press Ctrl+C to stop')
  })

  it('wires --env into bot constructor opts', async () => {
    const home = mktemp()
    const cwd = mktemp()
    const chatPath = path.join(cwd, 'noop.md')
    const envPath = path.join(home, 'custom.env')
    writeFile(chatPath, readFixture('noop-assistant-tail.md'))
    writeFile(envPath, 'OPENROUTER_API_KEY=test-key\n')

    const calls = { ctor: null }
    class FakeChudbot {
      constructor(opts) {
        calls.ctor = opts
      }
      async run() {
        return { ok: true, didRun: false, chatPath }
      }
    }

    await main([
      'node',
      'chudbot',
      '--no-update-check',
      '--env',
      envPath,
      'run',
      '-C',
      cwd,
      '--chat',
      'noop.md',
    ], { Chudbot: FakeChudbot })

    expect(calls.ctor).to.include({ envPath })
  })
})
