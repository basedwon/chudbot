const fs = require('fs')
const os = require('os')
const path = require('path')

class TestHelpers {
  constructor(prefix = 'chudbot-test-') {
    this.prefix = prefix
    this.tempDirs = new Set()
  }
  async makeTempDir(name = '') {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), this.prefix))
    const dir = name ? path.join(root, name) : root
    if (name) await fs.promises.mkdir(dir, { recursive: true })
    this.tempDirs.add(root)
    return dir
  }
  async readFile(filePath) {
    return fs.promises.readFile(filePath, 'utf8')
  }
  async writeFile(filePath, contents) {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    await fs.promises.writeFile(filePath, contents, 'utf8')
    return filePath
  }
  async cleanup() {
    const dirs = Array.from(this.tempDirs)
    this.tempDirs.clear()
    for (const dir of dirs) {
      await fs.promises.rm(dir, { recursive: true, force: true })
    }
  }
}

module.exports = {
  TestHelpers
}
