<p align="center">
  <img src="chud.png" width="300" />
</p>

<h1 align="center">Chudbot</h1>

<p align="center">
  Chudbot is a stupid-simple “chat in a file” bot.
</p>

<p align="center">
  <a href="https://github.com/basedwon/chudbot/actions/workflows/ci.yml">
    <img alt="ci" src="https://github.com/basedwon/chudbot/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://www.npmjs.com/package/chudbot">
    <img alt="npm" src="https://img.shields.io/npm/v/chudbot" />
  </a>
  <a href="https://www.npmjs.com/package/chudbot">
    <img alt="downloads" src="https://img.shields.io/npm/dw/chudbot" />
  </a>
</p>

You write messages in a `chat.md` file, save it, and Chudbot appends the assistant reply right into the same file.

## What you need

- A computer (Windows or Mac)
- Node.js (free)
- An OpenRouter account + API key

## Step 1: Install Node.js

### Windows

1. Go to nodejs.org
2. Download the LTS installer
3. Run it (Next, Next, Finish)
4. Open **PowerShell** (Start menu → type “PowerShell”)

### Mac

1. Go to nodejs.org
2. Download the LTS installer
3. Run it
4. Open **Terminal**

To confirm Node is installed, run:

```bash
node -v
npm -v
```

## Step 2: Install Chudbot

Install it globally:

```bash
npm install -g chudbot
```

Confirm it works:

```bash
chudbot --help
# alias also works
chud --help
```

### Optional: check for updates

```bash
chud update
```

If an update is available, Chudbot prints the exact install command. To install automatically, use `-y/--yes` or set `CHUDBOT_AUTO_UPDATE=1`.

## Step 3: Create an OpenRouter account and API key

1. Create an account:

[https://openrouter.ai](https://openrouter.ai/)

1. Create an API key:

https://openrouter.ai/settings/keys

You’ll paste that key into Chudbot’s `.env` in a minute.

## Step 4: Create a folder and open a terminal in it

Create a new folder anywhere you want, for example:

- `Desktop/chudbot-test`

Now open a terminal and make sure you’re “in” that folder.

If you already have a terminal open, you can always use `cd` to switch into the folder.

### Windows

Option A (easiest): open PowerShell directly in the folder

1. Open File Explorer and open your `chudbot-test` folder
2. Click the address bar (where the folder path is)
3. Type `powershell` and press Enter

Option B: open PowerShell first, then cd

```bash
cd $HOME
cd Desktop
cd chudbot-test
```

### Mac

Option A: open Terminal, then cd

1. Open Terminal
2. Type `cd` (with a space)
3. Drag the folder into the Terminal window
4. Press Enter

Option B (if enabled): open Terminal at the folder

- In Finder, right-click the folder → Services → New Terminal at Folder

## Step 5: Initialize the folder

This creates a starter `chat.md` in your folder.

It also creates `~/.chudbot/.env` if it doesn’t exist yet.

```bash
chudbot init
```

## Step 6: Paste your API key into Chudbot’s .env

Chudbot reads its API key from your user folder:

- Mac: `~/.chudbot/.env`
- Windows: `%USERPROFILE%\\.chudbot\\.env`

Open that file and set:

```bash
OPENROUTER_API_KEY=YOUR_KEY_HERE
OPENROUTER_MODEL=openrouter/free
OPENROUTER_DEFAULT_MODEL=openrouter/free
```

`OPENROUTER_MODEL` is the primary env var for model selection.
If set, it takes precedence.

`OPENROUTER_DEFAULT_MODEL` is also supported as a fallback when
`OPENROUTER_MODEL` is not set.

`openrouter/free` routes to a currently-free option on OpenRouter.
If it ever errors later, pick a different model.

## Step 7: Use it

Open `chat.md`, type under the last `# %% user` block, save the file, then run:

```bash
chudbot run
```

It only runs if the chat ends with a non-empty `# %% user` message.

On success it appends `# %% assistant` with the reply, then appends a fresh `# %% user` header so you can type the next message.


### Optional file context injection

You can inject one or more local files into model context without copy/paste:

```bash
chudbot run -f src/a.js -f notes/todo.md
chudbot run -files src/a.js,notes/todo.md
chudbot run -f src/a.js -files notes/todo.md,README.md
```

Paths are resolved relative to your current working directory. Files are
prepended in deterministic order: repeated `-f/--file` entries first (in the
order provided), then `-files` entries left-to-right.

You can also set files in `chat.md` front matter:

```markdown
---
files:
  - src/a.js
  - notes/todo.md
---
```

These entries are appended after CLI `-f/--file` and `-files` values.

### Optional trim limits from CLI

You can cap how much chat history is sent to the model:

```bash
chudbot run --max-messages 24
chudbot run --max-tokens 4000
chudbot run --max-messages 24 --max-tokens 4000
```

You can also pass the same limits in watch mode:

```bash
chudbot watch --max-messages 24 --max-tokens 4000
```

And you can set global defaults once per invocation:

```bash
chudbot --max-messages 24 --max-tokens 4000 run
chudbot --max-messages 24 --max-tokens 4000 watch
```

## Watch mode (auto-reply on save)

```bash
chudbot watch
```

Stop with **Ctrl+C**.

## How the chat format works

A chat file is just blocks. Each block starts with a header line:

- `# %% system`
- `# %% user`
- `# %% assistant`

Everything under that header (until the next header) is the message content.

Important rule: only type into the LAST `# %% user` block.

## Optional: create memory.md

If you create a `memory.md`, it gets injected as extra system instructions.

Example `memory.md`:

```markdown
- My name is Craig
- Keep answers short and practical
- I like humor
```

## Advanced: front matter

At the very top of `chat.md`, you can add front matter to set the model and memory file for that chat:

```markdown
---
model: openrouter/free
memory: memory.md
---
```

If you want the local memory file to override root memory instead of merging, add:

```markdown
---
memory.override: true
---
```

You can also trim long chats before model calls:

```markdown
---
max_messages: 24
max_tokens: 4000
---
```

Trimming is deterministic: system messages are kept, the first user message is
kept as seed continuity, and then the newest remaining messages are kept within
the message/token limits.

## Where files are loaded from

Chat:

- Uses `chat.md` in your current folder by default (or `--chat`)

Env:

- Mac: `~/.chudbot/.env`
- Windows: `%USERPROFILE%\\.chudbot\\.env`

Memory:

- Root memory: `~/.chudbot/memory.md` (Windows: `%USERPROFILE%\\.chudbot\\memory.md`)
- Local memory: `memory.md` next to your `chat.md`
- Default behavior is merge (root + blank line + local)
- If `memory.override: true` is set in chat front matter, local memory overrides root

## Troubleshooting

- “Missing OPENROUTER_API_KEY”
    - Put your key into `~/.chudbot/.env` (Windows: `%USERPROFILE%\\.chudbot\\.env`)
- “It didn’t reply”
    - Make sure the chat ends with a `# %% user` block that has real text
- “401 / unauthorized”
    - Your API key is missing or wrong
- “Model not found”
    - Try a different `OPENROUTER_MODEL`
    - Or set `OPENROUTER_DEFAULT_MODEL` if you want a fallback env key
    - Or set `model:` in chat front matter
- “It replied twice / weird loop”
    - Only edit the last `# %% user` block, and let the bot append assistant blocks
