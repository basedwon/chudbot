#!/usr/bin/env node

const path = require('path')
const { execSync } = require('child_process')
const { Command } = require('commander')

const pkg = require('../package.json')
const { Chudbot } = require('../lib/chudbot')
const UpdateCheck = require('../lib/update-check')

let didAutoCheck = false

function int(v, def) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : def
}

function list(v) {
  if (!v)
    return []
  return String(v).split(',').map((x) => x.trim()).filter(Boolean)
}

function files(opts = {}) {
  const repeat = Array.isArray(opts.file) ? opts.file : []
  const csv = list(opts.files)
  return [...repeat, ...csv]
}

function pick(opts, keys) {
  const out = {}
  for (const k of keys) {
    if (opts[k] !== undefined)
      out[k] = opts[k]
  }
  return out
}

function makeBot(opts, deps = {}) {
  const Bot = deps.Chudbot || Chudbot
  const normalized = { ...opts }
  if (normalized.env && !normalized.envPath)
    normalized.envPath = normalized.env
  return new Bot(pick(normalized, [
    'userRoot',
    'chudRoot',
    'envPath',
    'debounceMs',
    'maxMessages',
    'maxTokens',
  ]))
}

function shouldAutoInstall(opts = {}) {
  const yes = !!opts.yes
  const env = String(process.env.CHUDBOT_AUTO_UPDATE || '').trim()
  return yes || env === '1' || env.toLowerCase() === 'true'
}

function installUpdate(name) {
  execSync(`npm install -g ${name}@latest`, { stdio: 'inherit' })
}

async function runUpdate(opts = {}, deps = {}) {
  const Update = deps.UpdateCheck || UpdateCheck
  const u = new Update({ pkg: pkg.name })
  const local = u.localVersion()
  const remote = await u.remoteVersion()
  if (!u.hasUpdate(local, remote)) {
    if (opts.quiet)
      return
    console.log(`up to date: ${pkg.name}@${local}`)
    return
  }

  if (opts.quiet) {
    const cmd = path.basename(process.argv[1] || 'chudbot')
    console.log(`[update] ${pkg.name} ${local} -> ${remote}. Run: ${cmd} update`)
    return
  }

  console.log(`update available: ${pkg.name} ${local} -> ${remote}`)
  if (!shouldAutoInstall(opts)) {
    console.log(`run: npm install -g ${pkg.name}@latest`)
    console.log('or set CHUDBOT_AUTO_UPDATE=1')
    console.log('or pass --yes to install now')
    return
  }

  console.log(`installing ${pkg.name}@latest...`)
  installUpdate(pkg.name)
  console.log('update complete')
}

async function maybeAutoCheck(argv, deps = {}) {
  if (didAutoCheck)
    return
  didAutoCheck = true
  if (argv.includes('update') || argv.includes('--no-update-check'))
    return
  try {
    await runUpdate({ quiet: true }, deps)
  } catch (_) {}
}

async function main(argv, deps = {}) {
  const program = new Command()
  program
    .name('chudbot')
    .description('A tiny local markdown chatbot (chat.md in, replies appended)')
    .version(pkg.version)
    .option('--user-root <dir>', 'override OS home dir')
    .option('--chud-root <dir>', 'override chudbot root (default: ~/.chudbot)')
    .option('--env <path>', 'override env path (default: ~/.chudbot/.env)')
    .option('--max-messages <n>', 'default max messages window')
    .option('--max-tokens <n>', 'default max token estimate window')
    .option('--no-update-check', 'disable npm latest update check')

  program
    .command('update')
    .description('Check npm for latest version and optionally install it')
    .option('-y, --yes', 'install update automatically if available', false)
    .action(async (opts) => {
      try {
        await runUpdate({ yes: !!opts.yes }, deps)
      } catch (err) {
        console.error(err && err.message ? err.message : err)
        process.exitCode = 1
      }
    })

  program
    .command('init')
    .description('Create a starter chat file in a folder')
    .option('-C, --cwd <dir>', 'target folder (default: current folder)')
    .option('-f, --chat <file>', 'chat filename (default: chat.md)')
    .option('--force', 'overwrite chat file if it exists', false)
    .option('--system <text>', 'system prompt for the starter chat')
    .action((opts) => {
      const root = program.opts()
      const bot = makeBot(root, deps)
      const res = bot.init({
        cwd: opts.cwd || process.cwd(),
        chat: opts.chat,
        force: !!opts.force,
        system: opts.system,
      })
      console.log('created:', res.chatPath)
    })

  program
    .command('run')
    .description('Run once and append the assistant reply (if last user block is non-empty)')
    .option('-C, --cwd <dir>', 'folder to run in (default: current folder)')
    .option('--chat <file>', 'chat file (default: chat.md)')
    .option('-f, --file <path>', 'inject file into context (repeatable)', (v, a) => [...a, v], [])
    .option('-files, --files <a,b,c>', 'inject comma-separated files into context')
    .option('-m, --memory <file>', 'memory file (default: memory.md)')
    .option('--model <id>', 'model id (default: openrouter/free)')
    .option('--max-messages <n>', 'max messages window')
    .option('--max-tokens <n>', 'max token estimate window')
    .action(async (opts) => {
      const root = program.opts()
      const bot = makeBot(root, deps)
      const res = await bot.run({
        cwd: opts.cwd || process.cwd(),
        chat: opts.chat,
        memory: opts.memory,
        model: opts.model,
        files: files(opts),
        maxMessages: int(opts.maxMessages, int(root.maxMessages, undefined)),
        maxTokens: int(opts.maxTokens, int(root.maxTokens, undefined)),
      })
      if (!res.ok) {
        console.error(res.error && res.error.message ? res.error.message : res.error)
        process.exitCode = 1
        return
      }
      if (!res.didRun) {
        console.log('no-op: chat did not end with a non-empty # %% user block')
        return
      }
      console.log('appended reply to:', res.chatPath)
    })

  program
    .command('watch')
    .description('Watch chat file and auto-append replies on save (Ctrl+C to stop)')
    .option('-C, --cwd <dir>', 'folder to run in (default: current folder)')
    .option('--chat <file>', 'chat file (default: chat.md)')
    .option('-f, --file <path>', 'inject file into context (repeatable)', (v, a) => [...a, v], [])
    .option('-files, --files <a,b,c>', 'inject comma-separated files into context')
    .option('-m, --memory <file>', 'memory file (default: memory.md)')
    .option('--model <id>', 'model id (default: openrouter/free)')
    .option('--max-messages <n>', 'max messages window')
    .option('--max-tokens <n>', 'max token estimate window')
    .option('--debounce-ms <n>', 'debounce delay in ms (default: 200)')
    .action((opts) => {
      const root = program.opts()
      const bot = makeBot({ ...root, debounceMs: int(opts.debounceMs, 200) }, deps)

      const res = bot.watch({
        cwd: opts.cwd || process.cwd(),
        chat: opts.chat,
        memory: opts.memory,
        model: opts.model,
        files: files(opts),
        debounceMs: int(opts.debounceMs, 200),
        maxMessages: int(opts.maxMessages, int(root.maxMessages, undefined)),
        maxTokens: int(opts.maxTokens, int(root.maxTokens, undefined)),
      })

      const chatPath = res && res.chatPath
        ? res.chatPath
        : path.join(opts.cwd || process.cwd(), opts.chat || 'chat.md')

      console.log('watching:', chatPath)
      console.log('tip: edit the last # %% user block, save, and wait for the reply')
      console.log('tip: press Ctrl+C to stop')

      const onStop = async () => {
        try {
          await bot.stop()
        } catch (_) {}
        process.exit(0)
      }
      process.on('SIGINT', onStop)
      process.on('SIGTERM', onStop)
    })

  program.addHelpText(
    'afterAll',
    '\nMore help: read the README in the project folder.\n'
  )

  await maybeAutoCheck(argv, deps)
  await program.parseAsync(argv)
}

if (require.main === module) {
  main(process.argv).catch((err) => {
    console.error(err && err.message ? err.message : err)
    process.exitCode = 1
  })
}

module.exports = {
  main,
  int,
  list,
  files,
  pick,
  makeBot,
  runUpdate,
  maybeAutoCheck,
  shouldAutoInstall,
}
