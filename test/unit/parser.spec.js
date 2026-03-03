const fs = require('fs')
const path = require('path')
const { expect } = require('chai')
const { ChatParser } = require('../../lib/parser')

const fixture = (name) => {
  const p = path.join(__dirname, '../fixtures/parser', name)
  return fs.readFileSync(p, 'utf8')
}

describe('ChatParser', () => {
  describe('parseFrontMatter', () => {
    it('parses simple key/value pairs, files list, comments and quotes', () => {
      const parser = new ChatParser()
      const raw = fixture('frontmatter-basic.md')
      const fm = parser.parseFrontMatter(raw)
      expect(fm).to.be.an('object')
      expect(fm.data).to.deep.equal({
        model: 'openrouter/free',
        memory: 'memory file.md',
        project: 'chudbot',
        files: ['docs/spec.md', 'notes.md', 'src/app.js'],
      })
      expect(fm.body).to.equal(
        '# %% system\nFollow rules\n# %% user\nHello parser\n'
      )
    })
    it('returns null when front matter is missing', () => {
      const parser = new ChatParser()
      const fm = parser.parseFrontMatter(fixture('no-front-matter.md'))
      expect(fm).to.equal(null)
    })
    it('returns null when front matter is malformed', () => {
      const parser = new ChatParser()
      const fm = parser.parseFrontMatter(fixture('malformed-front-matter.md'))
      expect(fm).to.equal(null)
    })
    it('falls back safely in parse() without valid front matter', () => {
      const parser = new ChatParser()
      const noFm = parser.parse(fixture('no-front-matter.md'))
      const malformed = parser.parse(fixture('malformed-front-matter.md'))
      expect(noFm.frontMatter).to.deep.equal({})
      expect(malformed.frontMatter).to.deep.equal({})
      expect(noFm.blocks).to.have.length(1)
      expect(noFm.blocks[0]).to.deep.equal({
        role: 'user',
        content: 'No front matter here',
      })
      expect(malformed.blocks).to.have.length(1)
      expect(malformed.blocks[0]).to.deep.equal({
        role: 'user',
        content: 'still parse blocks',
      })
    })
    it('parses front matter files while ignoring empty list entries', () => {
      const parser = new ChatParser()
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

      const parsed = parser.parse(raw)

      expect(parsed.frontMatter).to.deep.equal({
        model: 'openrouter/whatever',
        max_messages: '40',
        max_tokens: '2500',
        files: ['@@p:src/index.js', '@@notes/todo.md', '@@a:Something.md'],
      })
    })
    it('detects closing marker as a full line across newline styles', () => {
      const parser = new ChatParser()
      const raw = [
        '---\r',
        'model: openrouter/free\r',
        'note: alpha---beta\r',
        '---\r',
        '# %% user\r',
        'Hi\r',
      ].join('\n')

      const parsed = parser.parse(raw)

      expect(parsed.frontMatter).to.deep.equal({
        model: 'openrouter/free',
        note: 'alpha---beta',
      })
      expect(parsed.blocks).to.deep.equal([
        { role: 'user', content: 'Hi' },
      ])
    })
    it('does not close front matter on embedded --- inside a line', () => {
      const parser = new ChatParser()
      const raw = [
        '---',
        'note: before --- after',
        'model: openrouter/free',
        '---',
        '# %% user',
        'Hi',
      ].join('\n')

      const parsed = parser.parse(raw)

      expect(parsed.frontMatter).to.deep.equal({
        note: 'before --- after',
        model: 'openrouter/free',
      })
      expect(parsed.blocks).to.deep.equal([
        { role: 'user', content: 'Hi' },
      ])
    })
  })

  describe('parseBlocks', () => {
    it('parses user, assistant, system and maps agent alias', () => {
      const parser = new ChatParser()
      const blocks = parser.parseBlocks(fixture('blocks-all-roles.md'))
      expect(blocks).to.deep.equal([
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User says hi' },
        { role: 'assistant', content: 'Assistant says hi' },
        { role: 'assistant', content: 'Agent alias text' },
      ])
    })
    it('throws on unknown role by default', () => {
      const parser = new ChatParser()
      expect(() => parser.parseBlocks(fixture('blocks-unknown-role.md')))
        .to.throw('Unknown role: robot')
    })
  })

  describe('isRunnable and getLastBlock', () => {
    it('returns true only for non-empty trailing user content', () => {
      const parser = new ChatParser()
      const ok = { blocks: [{ role: 'user', content: '  hi  ' }] }
      const empty = { blocks: [{ role: 'user', content: '   ' }] }
      const assistant = { blocks: [{ role: 'assistant', content: 'done' }] }
      const none = { blocks: [] }
      expect(parser.getLastBlock(ok)).to.deep.equal(ok.blocks[0])
      expect(parser.getLastBlock(none)).to.equal(null)
      expect(parser.isRunnable(ok)).to.equal(true)
      expect(parser.isRunnable(empty)).to.equal(false)
      expect(parser.isRunnable(assistant)).to.equal(false)
      expect(parser.isRunnable(none)).to.equal(false)
    })
  })

  describe('append formatting helpers', () => {
    it('formats assistant append and trims by default', () => {
      const parser = new ChatParser()
      const out = parser.formatAppendAssistant('  hello\n')
      expect(out).to.equal('\n\n# %% assistant\nhello')
    })
    it('supports trim=false for assistant append', () => {
      const parser = new ChatParser()
      const out = parser.formatAppendAssistant('  hello\n', { trim: false })
      expect(out).to.equal('\n\n# %% assistant\n  hello\n')
    })
    it('formats user append header', () => {
      const parser = new ChatParser()
      expect(parser.formatAppendUser()).to.equal('\n\n# %% user\n')
    })
  })
})
