const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const axios = require('axios')

class UpdateCheck {
  constructor(opts = {}) {
    this.pkg = opts.pkg || null
    this.timeoutMs = opts.timeoutMs || 5000
    if (!this.pkg)
      throw new Error('UpdateCheck requires opts.pkg')
  }
  localVersion() {
    const pkgPath = path.join(__dirname, '..', 'package.json')
    const raw = fs.readFileSync(pkgPath, 'utf8')
    const pkg = JSON.parse(raw)
    return String(pkg.version || '').trim()
  }
  async remoteVersion() {
    try {
      const url = `https://registry.npmjs.org/-/package/${this.pkg}/dist-tags`
      const res = await axios.get(url, { timeout: this.timeoutMs })
      const v = res && res.data && res.data.latest ? res.data.latest : ''
      return String(v || '').trim()
    } catch (_) {
      const out = execSync(`npm view ${this.pkg} version`, {
        stdio: ['ignore', 'pipe', 'pipe'],
      }).toString('utf8')
      return String(out || '').trim()
    }
  }
  hasUpdate(local, remote) {
    if (!local || !remote)
      return false
    const a = this._parse(local)
    const b = this._parse(remote)
    for (let i = 0; i < 3; i++) {
      if ((b[i] || 0) > (a[i] || 0))
        return true
      if ((b[i] || 0) < (a[i] || 0))
        return false
    }
    return false
  }
  _parse(v) {
    return String(v || '')
      .split('.')
      .slice(0, 3)
      .map((x) => Number(x) || 0)
  }
}

module.exports = UpdateCheck
