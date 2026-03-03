const { expect } = require('chai')
const axios = require('axios')
const UpdateCheck = require('../../lib/update-check')
const { createAxiosStub } = require('../fakes/axios-fake')
const { loadWithExecSyncStub } = require('../fakes/exec-sync-stub')

describe('UpdateCheck', () => {
  let stub

  beforeEach(() => {
    stub = createAxiosStub(axios)
  })

  afterEach(() => {
    stub.restore()
  })

  it('_parse and hasUpdate compare versions correctly', () => {
    const checker = new UpdateCheck({ pkg: 'chudbot' })

    expect(checker._parse('1.2.3')).to.deep.equal([1, 2, 3])
    expect(checker._parse('2.5')).to.deep.equal([2, 5])
    expect(checker._parse('')).to.deep.equal([0])
    expect(checker.hasUpdate('1.2.3', '1.2.4')).to.equal(true)
    expect(checker.hasUpdate('1.2.3', '1.2.3')).to.equal(false)
    expect(checker.hasUpdate('2.0.0', '1.9.9')).to.equal(false)
  })

  it('remoteVersion uses axios success path', async () => {
    stub.stubGet(async () => ({ data: { latest: '9.9.9' } }))
    const checker = new UpdateCheck({ pkg: 'chudbot', timeoutMs: 321 })

    const remote = await checker.remoteVersion()

    expect(remote).to.equal('9.9.9')
    expect(stub.calls.get).to.have.length(1)
    const [url, config] = stub.calls.get[0]
    expect(url).to.equal('https://registry.npmjs.org/-/package/chudbot/dist-tags')
    expect(config).to.deep.equal({ timeout: 321 })
  })

  it('remoteVersion falls back to npm view when axios fails', async () => {
    stub.stubGet(async () => {
      throw new Error('network down')
    })
    const calls = []
    const loaded = loadWithExecSyncStub('../../lib/update-check', (cmd, opts) => {
      calls.push([cmd, opts])
      return Buffer.from('1.4.0\n', 'utf8')
    })
    try {
      const UpdateCheckWithStub = loaded.mod
      const checker = new UpdateCheckWithStub({ pkg: 'chudbot' })

      const remote = await checker.remoteVersion()

      expect(remote).to.equal('1.4.0')
      expect(calls).to.have.length(1)
      expect(calls[0][0]).to.equal('npm view chudbot version')
      expect(calls[0][1]).to.deep.equal({
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } finally {
      loaded.restore()
    }
  })
})
