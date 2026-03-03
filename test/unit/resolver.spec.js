const fs = require('fs')
const os = require('os')
const path = require('path')
const { expect } = require('chai')
const { ContextResolver } = require('../../lib/resolver')

describe('ContextResolver', () => {
  let tmp
  let userRoot
  let chudRoot
  let cwd

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chudbot-resolver-'))
    userRoot = path.join(tmp, 'home')
    chudRoot = path.join(userRoot, '.chudbot')
    cwd = path.join(tmp, 'proj')
    fs.mkdirSync(chudRoot, { recursive: true })
    fs.mkdirSync(cwd, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('prefers cwd chat path and front matter memory over opts.memory', () => {
    fs.writeFileSync(path.join(cwd, 'chat.md'), '# %% user\nHi', 'utf8')
    fs.writeFileSync(path.join(chudRoot, 'chat.md'), '# %% user\nRoot', 'utf8')
    fs.writeFileSync(path.join(cwd, 'local-mem.md'), 'local', 'utf8')
    const resolver = new ContextResolver({ userRoot, chudRoot })

    const paths = resolver.resolvePaths({
      cwd,
      frontMatter: { memory: 'local-mem.md' },
      memory: 'ignored.md',
    })

    expect(paths.chatPath).to.equal(path.join(cwd, 'chat.md'))
    expect(paths.localMemoryPath).to.equal(path.join(cwd, 'local-mem.md'))
  })

  it('merges root+local memory unless memory.override is truthy', () => {
    fs.writeFileSync(path.join(chudRoot, 'memory.md'), 'ROOT', 'utf8')
    fs.writeFileSync(path.join(cwd, 'memory.md'), 'LOCAL', 'utf8')
    const resolver = new ContextResolver({ userRoot, chudRoot })

    const merged = resolver.loadMemory({ cwd, frontMatter: {} })
    const overridden = resolver.loadMemory({
      cwd,
      frontMatter: { 'memory.override': 'true' },
    })

    expect(merged.raw).to.equal('ROOT\n\nLOCAL')
    expect(overridden.raw).to.equal('LOCAL')
  })

  it('injects file context using -- FILE: ... formatting', () => {
    fs.writeFileSync(path.join(cwd, 'ctx.txt'), 'hello file', 'utf8')
    const resolver = new ContextResolver({ userRoot, chudRoot })
    const parsed = { messages: [{ role: 'user', content: 'Hi' }] }

    const messages = resolver.buildMessages(parsed, '', {
      cwd,
      files: ['ctx.txt'],
    })

    expect(messages).to.have.length(2)
    expect(messages[0]).to.deep.equal({
      role: 'system',
      content: '-- FILE: ctx.txt ---\nhello file\n-- END FILE ---',
    })
  })

  it('trims messages with max_messages and max_tokens', () => {
    const resolver = new ContextResolver({ userRoot, chudRoot })
    const parsed = {
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'seed' },
        { role: 'assistant', content: 'old assistant one two three four' },
        { role: 'user', content: 'old user one two three four' },
        { role: 'assistant', content: 'keep me' },
      ],
    }

    const messages = resolver.buildMessages(parsed, '', {
      maxMessages: 4,
      maxTokens: 8,
    })

    expect(messages).to.deep.equal([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'seed' },
      { role: 'assistant', content: 'keep me' },
    ])
  })
})
