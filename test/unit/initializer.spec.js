const fs = require('fs')
const os = require('os')
const path = require('path')
const { expect } = require('chai')
const { Initializer, EnvLoader } = require('../../lib/initializer')

describe('Initializer and EnvLoader', () => {
  let tmp
  let userRoot
  let chudRoot
  let cwd

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chudbot-init-spec-'))
    userRoot = path.join(tmp, 'home')
    chudRoot = path.join(userRoot, '.chudbot')
    cwd = path.join(tmp, 'proj')
    fs.mkdirSync(cwd, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
    delete process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_MODEL
  })

  it('initRoot and initChat create starter files', () => {
    const init = new Initializer({ userRoot, chudRoot })
    const root = init.initRoot({ makeEnv: true })
    const chat = init.initChat({ cwd, system: 'Be short.' })

    expect(root.ok).to.equal(true)
    expect(root.didWriteEnv).to.equal(true)
    expect(fs.existsSync(root.envPath)).to.equal(true)
    expect(chat.ok).to.equal(true)
    expect(chat.didWriteChat).to.equal(true)
    expect(fs.existsSync(chat.chatPath)).to.equal(true)
    expect(fs.readFileSync(chat.chatPath, 'utf8')).to.equal(
      '# %% system\nBe short.\n\n# %% user\n'
    )
  })

  it('EnvLoader loads .env and supports required mode', () => {
    const init = new Initializer({ userRoot, chudRoot })
    const root = init.initRoot({ makeEnv: true })
    const envPath = root.envPath
    const raw = fs.readFileSync(envPath, 'utf8')
    fs.writeFileSync(
      envPath,
      raw.replace('OPENROUTER_API_KEY=REPLACE_ME', 'OPENROUTER_API_KEY=sk_test'),
      'utf8'
    )
    const env = new EnvLoader({ userRoot, chudRoot })

    const loaded = env.load({ required: true, override: true })
    expect(loaded).to.deep.equal({ ok: true, envPath, loaded: true })
    expect(process.env.OPENROUTER_API_KEY).to.equal('sk_test')
    expect(process.env.OPENROUTER_MODEL).to.equal('openrouter/free')

    const missingPath = path.join(chudRoot, 'missing.env')
    expect(() => env.load({ envPath: missingPath, required: true }))
      .to.throw('Missing env file: ' + missingPath)
  })
})
