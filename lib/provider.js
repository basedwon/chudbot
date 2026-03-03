const axios = require('axios')

class Provider {
  constructor(opts = {}) {
    this.baseUrl = opts.baseUrl || 'https://openrouter.ai/api/v1'
    this.apiKey = opts.apiKey || process.env.OPENROUTER_API_KEY || ''
    this.model = opts.model || process.env.OPENROUTER_MODEL ||
      process.env.OPENROUTER_DEFAULT_MODEL || 'openrouter/free'
    this.timeoutMs = opts.timeoutMs || 60000
    this.headers = opts.headers || {}
    if (!this.apiKey)
      throw new Error('Missing OPENROUTER_API_KEY')
  }
  async send(messages, opts = {}) {
    // POST /chat/completions, return full JSON response.
    // opts.model, opts.temperature, opts.maxTokens, opts.headers
    const url = this.baseUrl.replace(/\/+$/, '') + '/chat/completions'
    const model = opts.model || this.model
    const payload = {
      model,
      messages,
    }
    if (opts.temperature != null)
      payload.temperature = opts.temperature
    if (opts.maxTokens != null)
      payload.max_tokens = opts.maxTokens
    const headers = {
      Authorization: 'Bearer ' + this.apiKey,
      'Content-Type': 'application/json',
      ...this.headers,
      ...(opts.headers || {}),
    }
    try {
      const res = await axios.post(url, payload, {
        headers,
        timeout: this.timeoutMs,
      })
      return res.data
    } catch (err) {
      const r = err && err.response
      if (r && r.status)
        throw new Error('OpenRouter ' + r.status + ': ' + this._errMsg(r.data))
      throw err
    }
  }
  async complete(messages, opts = {}) {
    // send() then return assistant content string.
    const json = await this.send(messages, opts)
    return this.extractContent(json)
  }
  extractContent(json) {
    const c = json && json.choices && json.choices[0]
    const m = c && c.message
    const t = m && m.content
    const s = String(t || '')
    if (!s.trim())
      throw new Error('Missing assistant content')
    return s
  }
  _errMsg(data) {
    const e = data && (data.error || data)
    const m = e && (e.message || e.error || e)
    return String(m || 'request failed')
  }
}

module.exports = { Provider }
