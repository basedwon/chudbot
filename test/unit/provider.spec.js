const { expect } = require('chai')
const axios = require('axios')
const { Provider } = require('../../lib/provider')
const { createAxiosStub } = require('../fakes/axios-fake')

describe('Provider', () => {
  let stub
  let oldModel
  let oldDefaultModel

  beforeEach(() => {
    stub = createAxiosStub(axios)
    oldModel = process.env.OPENROUTER_MODEL
    oldDefaultModel = process.env.OPENROUTER_DEFAULT_MODEL
    delete process.env.OPENROUTER_MODEL
    delete process.env.OPENROUTER_DEFAULT_MODEL
  })

  afterEach(() => {
    stub.restore()
    if (oldModel == null)
      delete process.env.OPENROUTER_MODEL
    else
      process.env.OPENROUTER_MODEL = oldModel
    if (oldDefaultModel == null)
      delete process.env.OPENROUTER_DEFAULT_MODEL
    else
      process.env.OPENROUTER_DEFAULT_MODEL = oldDefaultModel
  })

  it('constructor requires api key', () => {
    expect(() => new Provider({ apiKey: '' })).to.throw('Missing OPENROUTER_API_KEY')
  })

  it('resolves model precedence: opts > OPENROUTER_MODEL > OPENROUTER_DEFAULT_MODEL > fallback', () => {
    process.env.OPENROUTER_MODEL = 'm-env'
    process.env.OPENROUTER_DEFAULT_MODEL = 'm-default-env'

    const withOpt = new Provider({ apiKey: 'k-test', model: 'm-opt' })
    expect(withOpt.model).to.equal('m-opt')

    const withModelEnv = new Provider({ apiKey: 'k-test' })
    expect(withModelEnv.model).to.equal('m-env')

    delete process.env.OPENROUTER_MODEL
    const withDefaultEnv = new Provider({ apiKey: 'k-test' })
    expect(withDefaultEnv.model).to.equal('m-default-env')

    delete process.env.OPENROUTER_DEFAULT_MODEL
    const withFallback = new Provider({ apiKey: 'k-test' })
    expect(withFallback.model).to.equal('openrouter/free')
  })

  it('send builds request payload and headers', async () => {
    stub.stubPost(async () => ({ data: { ok: true } }))
    const provider = new Provider({
      apiKey: 'k-test',
      baseUrl: 'https://openrouter.ai/api/v1/',
      model: 'm-default',
      timeoutMs: 1234,
      headers: { 'X-Base': 'base' },
    })

    const messages = [{ role: 'user', content: 'hi' }]
    const data = await provider.send(messages, {
      model: 'm-1',
      temperature: 0.3,
      maxTokens: 99,
      headers: { 'X-Req': 'req' },
    })

    expect(data).to.deep.equal({ ok: true })
    expect(stub.calls.post).to.have.length(1)
    const [url, payload, config] = stub.calls.post[0]
    expect(url).to.equal('https://openrouter.ai/api/v1/chat/completions')
    expect(payload).to.deep.equal({
      model: 'm-1',
      messages,
      temperature: 0.3,
      max_tokens: 99,
    })
    expect(config.timeout).to.equal(1234)
    expect(config.headers).to.deep.equal({
      Authorization: 'Bearer k-test',
      'Content-Type': 'application/json',
      'X-Base': 'base',
      'X-Req': 'req',
    })
  })

  it('extractContent returns content and fails when missing', () => {
    const provider = new Provider({ apiKey: 'k-test' })

    const got = provider.extractContent({
      choices: [{ message: { content: 'hello' } }],
    })
    expect(got).to.equal('hello')
    expect(() => provider.extractContent({ choices: [{ message: {} }] }))
      .to.throw('Missing assistant content')
  })

  it('formats OpenRouter errors from axios rejection response', async () => {
    stub.stubPost(async () => {
      const err = new Error('request failed')
      err.response = {
        status: 429,
        data: { error: { message: 'quota hit' } },
      }
      throw err
    })
    const provider = new Provider({ apiKey: 'k-test' })

    let got
    try {
      await provider.send([{ role: 'user', content: 'hi' }])
    } catch (err) {
      got = err
    }

    expect(got).to.be.instanceOf(Error)
    expect(got.message).to.equal('OpenRouter 429: quota hit')
  })
})
