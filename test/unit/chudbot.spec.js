const fs = require('fs')
const os = require('os')
const path = require('path')
const { expect } = require('chai')
const { Chudbot } = require('../../lib/chudbot')

describe('Chudbot facade', () => {
  let tmp
  let userRoot
  let chudRoot
  let cwd
  let oldKey

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chudbot-facade-spec-'))
    userRoot = path.join(tmp, 'home')
    chudRoot = path.join(userRoot, '.chudbot')
    cwd = path.join(tmp, 'proj')
    fs.mkdirSync(cwd, { recursive: true })
    oldKey = process.env.OPENROUTER_API_KEY
    process.env.OPENROUTER_API_KEY = 'sk_test'
  })

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
    if (oldKey == null)
      delete process.env.OPENROUTER_API_KEY
    else
      process.env.OPENROUTER_API_KEY = oldKey
  })

  it('init creates chat and run delegates to runner', async () => {
    const bot = new Chudbot({ userRoot, chudRoot })
    const init = bot.init({ cwd, system: 'Be short and practical.' })

    expect(fs.existsSync(init.chatPath)).to.equal(true)

    const fakeRes = { ok: true, didRun: false, chatPath: init.chatPath }
    bot.runner = {
      async runOnce(opts) {
        return { ...fakeRes, opts }
      },
    }

    const run = await bot.run({ cwd, chat: path.basename(init.chatPath) })

    expect(run.ok).to.equal(true)
    expect(run.didRun).to.equal(false)
    expect(run.opts).to.deep.equal({
      cwd,
      chat: path.basename(init.chatPath),
    })
  })
})
