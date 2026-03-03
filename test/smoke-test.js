const fs = require('fs')
const os = require('os')
const path = require('path')
const dotenv = require('dotenv')

const { Chudbot } = require('../lib/chudbot')
const { ChatParser } = require('../lib/parser')
const { ContextResolver } = require('../lib/resolver')
const { Runner } = require('../lib/runner')
const { Watcher } = require('../lib/watcher')
const { Provider } = require('../lib/provider')
const { Initializer, EnvLoader } = require('../lib/initializer')

function parserTest() {
  const p = new ChatParser()
  const raw = [
    '---',
    'model: openrouter/free',
    'memory: memory.md',
    '---',
    '',
    '# %% system',
    'You are helpful.',
    '',
    '# %% user',
    'Say hi.',
  ].join('\n')
  const parsed = p.parse(raw)
  console.log('frontMatter:', parsed.frontMatter)
  console.log('blocks:', parsed.blocks)
  console.log('runnable:', p.isRunnable(parsed))
  const a = p.formatAppendAssistant('Hello!')
  const u = p.formatAppendUser()
  console.log('append assistant:', JSON.stringify(a))
  console.log('append user:', JSON.stringify(u))

  const raw2 = raw + u
  const parsed2 = p.parse(raw2)
  console.log('runnable after empty user:', p.isRunnable(parsed2))
}
function parserFrontMatterFilesTest() {
  const assert = require('assert')
  const p = new ChatParser()
  const raw = [
    '---',
    '# comment',
    'model: openrouter/whatever',
    'max_messages: 40',
    'max_tokens: 2500',
    'files:',
    '  - @@p:src/index.js',
    '  -',
    '',
    '  - @@notes/todo.md',
    '  - @@a:Something.md',
    '---',
    '',
    '# %% user',
    'Hi',
  ].join('\n')
  const parsed = p.parse(raw)
  assert.strictEqual(parsed.frontMatter.model, 'openrouter/whatever')
  assert.strictEqual(parsed.frontMatter.max_messages, '40')
  assert.strictEqual(parsed.frontMatter.max_tokens, '2500')
  assert.deepStrictEqual(parsed.frontMatter.files, [
    '@@p:src/index.js',
    '@@notes/todo.md',
    '@@a:Something.md',
  ])

  const raw2 = [
    '---',
    'model: openrouter/free',
    'memory: memory.md',
    '---',
    '',
    '# %% user',
    'Hello',
  ].join('\n')
  const parsed2 = p.parse(raw2)
  assert.strictEqual(parsed2.frontMatter.model, 'openrouter/free')
  assert.strictEqual(parsed2.frontMatter.memory, 'memory.md')
  assert.strictEqual(parsed2.frontMatter.files, undefined)
  console.log('parserFrontMatterFilesTest: ok')
}
function resolverTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chudbot-'))
  const userRoot = path.join(tmp, 'home')
  const chudRoot = path.join(userRoot, '.chudbot')
  const cwd = path.join(tmp, 'proj')
  fs.mkdirSync(chudRoot, { recursive: true })
  fs.mkdirSync(cwd, { recursive: true })

  fs.writeFileSync(path.join(chudRoot, 'memory.md'), 'ROOT MEM', 'utf8')
  fs.writeFileSync(path.join(cwd, 'memory.md'), 'LOCAL MEM', 'utf8')
  fs.writeFileSync(path.join(cwd, 'chat.md'), '# %% user\nHi', 'utf8')

  const r = new ContextResolver({ userRoot, chudRoot })

  const chat = r.loadChat({ cwd })
  console.log('chatPath:', chat.chatPath)
  console.log('chatRaw:', JSON.stringify(chat.raw))

  const mem1 = r.loadMemory({ cwd, frontMatter: {} })
  console.log('mem merged:', JSON.stringify(mem1.raw))

  const mem2 = r.loadMemory({
    cwd,
    frontMatter: { 'memory.override': 'true' },
  })
  console.log('mem override:', JSON.stringify(mem2.raw))

  const parsed = {
    messages: [{ role: 'user', content: 'Hi' }],
  }
  const msgs = r.buildMessages(parsed, mem1.raw)
  console.log('messages:', msgs)
}
function initializerTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chudbot-init-'))
  const userRoot = path.join(tmp, 'home')
  const chudRoot = path.join(userRoot, '.chudbot')
  const cwd = path.join(tmp, 'proj')
  fs.mkdirSync(cwd, { recursive: true })

  const init = new Initializer({ userRoot, chudRoot })
  const root = init.initRoot({ makeEnv: true })
  const chat = init.initChat({ cwd, system: 'Be short.' })

  console.log('root:', root)
  console.log('chat:', chat)
  console.log('chat exists:', fs.existsSync(chat.chatPath))
  console.log('env exists:', fs.existsSync(root.envPath))

  const env = new EnvLoader({ userRoot, chudRoot })
  const load1 = env.load({ required: true })
  console.log('env load:', load1)

  const beforeKey = process.env.OPENROUTER_API_KEY
  const beforeModel = process.env.OPENROUTER_MODEL

  const rawEnv = fs.readFileSync(root.envPath, 'utf8')
  const fixed = rawEnv.replace(
    'OPENROUTER_API_KEY=REPLACE_ME',
    'OPENROUTER_API_KEY=sk_test'
  )
  fs.writeFileSync(root.envPath, fixed, 'utf8')

  env.load({ override: true, required: true })
  console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY)
  console.log('OPENROUTER_MODEL:', process.env.OPENROUTER_MODEL)

  if (beforeKey == null)
    delete process.env.OPENROUTER_API_KEY
  else
    process.env.OPENROUTER_API_KEY = beforeKey

  if (beforeModel == null)
    delete process.env.OPENROUTER_MODEL
  else
    process.env.OPENROUTER_MODEL = beforeModel
}
async function providerTest() {
  const envPath = path.join(os.homedir(), '.chudbot', '.env')
  dotenv.config({ path: envPath, quiet: true })
  const p = new Provider()
  const messages = [
    { role: 'system', content: 'Be short and practical.' },
    { role: 'user', content: 'Say hi and give me 1 tip for focus.' },
  ]
  const text = await p.complete(messages)
  console.log(text)
}
async function runnerTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chudbot-runner-'))
  const userRoot = path.join(tmp, 'home')
  const chudRoot = path.join(userRoot, '.chudbot')
  const cwd = path.join(tmp, 'proj')
  fs.mkdirSync(chudRoot, { recursive: true })
  fs.mkdirSync(cwd, { recursive: true })

  fs.writeFileSync(path.join(chudRoot, 'memory.md'), 'ROOT MEM', 'utf8')
  fs.writeFileSync(path.join(cwd, 'memory.md'), 'LOCAL MEM', 'utf8')

  const chatRaw = [
    '---',
    'model: openrouter/free',
    '---',
    '',
    '# %% system',
    'Be short.',
    '',
    '# %% user',
    'Say hi.',
  ].join('\n')
  fs.writeFileSync(path.join(cwd, 'chat.md'), chatRaw, 'utf8')

  const parser = new ChatParser()
  const resolver = new ContextResolver({ userRoot, chudRoot })

  const provider = {
    async complete(messages) {
      const u = messages[messages.length - 1]
      return 'Hello. You said: ' + (u ? u.content : '')
    },
  }

  const runner = new Runner({ parser, resolver, provider })
  const res = await runner.runOnce({ cwd })
  console.log('res:', res)

  const next = fs.readFileSync(path.join(cwd, 'chat.md'), 'utf8')
  console.log('next tail:', JSON.stringify(next.slice(-120)))

  const parsed2 = parser.parse(next)
  console.log('runnable after append:', parser.isRunnable(parsed2))
}
async function watcherTest() {
  const calls = []
  const runner = {
    resolver: { resolvePaths: () => ({ chatPath: __filename }) },
    async runOnce() {
      calls.push(Date.now())
    },
  }
  const w = new Watcher({ runner, debounceMs: 25 })
  w.onChange('x')
  w.onChange('x')
  w.onChange('x')
  await new Promise((r) => setTimeout(r, 80))
  console.log('calls:', calls.length)
  await w.stop()
}
async function facadeTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chudbot-facade-'))
  const cwd = path.join(tmp, 'proj')
  fs.mkdirSync(cwd, { recursive: true })

  const bot = new Chudbot()
  const init = bot.init({ cwd, system: 'Be short and practical.' })

  const chatPath = init.chatPath
  const raw = fs.readFileSync(chatPath, 'utf8')
  const needle = '# %% user\n'
  const repl = '# %% user\nSay hi and give 1 focus tip.\n'
  const seeded = raw.replace(needle, repl)
  fs.writeFileSync(chatPath, seeded, 'utf8')

  const res = await bot.run({ cwd })
  console.log('run:', {
    ok: res.ok,
    didRun: res.didRun,
    chatPath: res.chatPath,
  })

  const next = fs.readFileSync(chatPath, 'utf8')
  console.log('tail:', JSON.stringify(next.slice(-220)))
}

async function test() {
  parserTest()
  parserFrontMatterFilesTest()
  resolverTest()
  initializerTest()
  await providerTest()
  await runnerTest()
  await watcherTest()
  await facadeTest()
}

if (require.main === module) {
  test().catch((err) => {
    console.error(err && err.stack ? err.stack : err)
    process.exitCode = 1
  })
}

module.exports = { test }
