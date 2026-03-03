const fs = require('fs')
const os = require('os')
const path = require('path')
const { expect } = require('chai')
const { ChatParser } = require('../../lib/parser')
const { ContextResolver } = require('../../lib/resolver')
const { Runner } = require('../../lib/runner')

describe('Runner', () => {
  let tmp
  let cwd

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chudbot-runner-spec-'))
    cwd = path.join(tmp, 'proj')
    fs.mkdirSync(cwd, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('returns didRun false for non-runnable parse with fake deps', async () => {
    const parser = {
      parse() {
        return { blocks: [{ role: 'assistant', content: 'done' }] }
      },
      isRunnable() {
        return false
      },
    }
    const resolver = {
      loadChat() {
        return {
          chatPath: path.join(cwd, 'chat.md'),
          raw: '# %% assistant\ndone',
          paths: { cwd },
        }
      },
    }
    const provider = {
      async complete() {
        throw new Error('should not call')
      },
    }
    const runner = new Runner({ parser, resolver, provider })

    const res = await runner.runOnce({ cwd })

    expect(res.ok).to.equal(true)
    expect(res.didRun).to.equal(false)
  })

  it('returns ok false on parse error and leaves chat unchanged', async () => {
    const chatPath = path.join(cwd, 'chat.md')
    const before = '# %% user\nhi'
    fs.writeFileSync(chatPath, before, 'utf8')
    const parser = {
      parse() {
        throw new Error('parse fail')
      },
      isRunnable() {
        return true
      },
    }
    const resolver = { loadChat: () => ({ chatPath, raw: before, paths: { cwd } }) }
    const provider = { complete: async () => 'x' }
    const runner = new Runner({ parser, resolver, provider })

    const res = await runner.runOnce({ cwd })
    const after = fs.readFileSync(chatPath, 'utf8')

    expect(res.ok).to.equal(false)
    expect(after).to.equal(before)
  })

  it('keeps chat unchanged on provider error', async () => {
    const chatPath = path.join(cwd, 'chat.md')
    const before = '# %% user\nhi'
    fs.writeFileSync(chatPath, before, 'utf8')
    const parser = new ChatParser()
    const resolver = {
      loadChat: () => ({ chatPath, raw: before, paths: { cwd } }),
      loadMemory: () => ({ raw: '', paths: { cwd } }),
      buildMessages: (parsed) => parsed.messages,
    }
    const provider = {
      async complete() {
        throw new Error('provider fail')
      },
    }
    const runner = new Runner({ parser, resolver, provider })

    const res = await runner.runOnce({ cwd })
    const after = fs.readFileSync(chatPath, 'utf8')

    expect(res.ok).to.equal(false)
    expect(after).to.equal(before)
  })

  it('keeps chat unchanged on load/read errors', async () => {
    const chatPath = path.join(cwd, 'chat.md')
    const before = '# %% user\nhi'
    fs.writeFileSync(chatPath, before, 'utf8')
    const parser = new ChatParser()
    const resolver = {
      loadChat() {
        throw new Error('Missing file: ' + chatPath)
      },
      loadMemory: () => ({ raw: '' }),
      buildMessages: () => [],
    }
    const provider = { complete: async () => 'x' }
    const runner = new Runner({ parser, resolver, provider })

    const res = await runner.runOnce({ cwd })
    const after = fs.readFileSync(chatPath, 'utf8')

    expect(res.ok).to.equal(false)
    expect(after).to.equal(before)
  })

  it('appends assistant block then fresh user header on success', async () => {
    const userRoot = path.join(tmp, 'home')
    const chudRoot = path.join(userRoot, '.chudbot')
    fs.mkdirSync(chudRoot, { recursive: true })
    const chatPath = path.join(cwd, 'chat.md')
    const before = '# %% user\nSay hi'
    fs.writeFileSync(chatPath, before, 'utf8')
    const parser = new ChatParser()
    const resolver = new ContextResolver({ userRoot, chudRoot })
    const provider = { complete: async () => 'Hello there' }
    const runner = new Runner({ parser, resolver, provider })

    const res = await runner.runOnce({ cwd })
    const after = fs.readFileSync(chatPath, 'utf8')

    expect(res).to.deep.include({ ok: true, didRun: true, chatPath })
    expect(after).to.equal(
      '# %% user\nSay hi\n\n# %% assistant\nHello there\n\n# %% user\n'
    )
  })
})
