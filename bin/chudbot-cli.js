#!/usr/bin/env node

const path = require('path')
const { Command } = require('commander')

const pkg = require('../package.json')
const { Chudbot } = require('../lib/chudbot')

function int(v, def) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : def
}

function pick(opts, keys) {
  const out = {}
  for (const k of keys) {
    if (opts[k] !== undefined)
      out[k] = opts[k]
  }
  return out
}

function makeBot(opts) {
  return new Chudbot(pick(opts, ['userRoot', 'chudRoot', 'envPath', 'debounceMs']))
}

async function main(argv) {
  const program = new Command()
  program
    .name('chudbot')
    .description('A tiny local markdown chatbot (chat.md in, replies appended)')
    .version(pkg.version)
    .option('--user-root <dir>', 'override OS home dir')
    .option('--chud-root <dir>', 'override chudbot root (default: ~/.chudbot)')
    .option('--env <path>', 'override env path (default: ~/.chudbot/.env)')

  program
    .command('init')
    .description('Create a starter chat file in a folder')
    .option('-C, --cwd <dir>', 'target folder (default: current folder)')
    .option('-f, --chat <file>', 'chat filename (default: chat.md)')
    .option('--force', 'overwrite chat file if it exists', false)
    .option('--system <text>', 'system prompt for the starter chat')
    .action((opts) => {
      const root = program.opts()
      const bot = makeBot(root)
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
    .option('-f, --chat <file>', 'chat file (default: chat.md)')
    .option('-m, --memory <file>', 'memory file (default: memory.md)')
    .option('--model <id>', 'model id (default: openrouter/free)')
    .action(async (opts) => {
      const root = program.opts()
      const bot = makeBot(root)
      const res = await bot.run({
        cwd: opts.cwd || process.cwd(),
        chat: opts.chat,
        memory: opts.memory,
        model: opts.model,
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
    .option('-f, --chat <file>', 'chat file (default: chat.md)')
    .option('-m, --memory <file>', 'memory file (default: memory.md)')
    .option('--model <id>', 'model id (default: openrouter/free)')
    .option('--debounce-ms <n>', 'debounce delay in ms (default: 200)')
    .action((opts) => {
      const root = program.opts()
      const bot = makeBot({ ...root, debounceMs: int(opts.debounceMs, 200) })

      const res = bot.watch({
        cwd: opts.cwd || process.cwd(),
        chat: opts.chat,
        memory: opts.memory,
        model: opts.model,
        debounceMs: int(opts.debounceMs, 200),
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

  await program.parseAsync(argv)
}

main(process.argv).catch((err) => {
  console.error(err && err.message ? err.message : err)
  process.exitCode = 1
})
