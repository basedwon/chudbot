const childProcess = require('child_process')

function loadWithExecSyncStub(modulePath, impl) {
  const original = childProcess.execSync
  childProcess.execSync = impl
  delete require.cache[require.resolve(modulePath)]
  const mod = require(modulePath)
  return {
    mod,
    restore() {
      childProcess.execSync = original
      delete require.cache[require.resolve(modulePath)]
    },
  }
}

module.exports = {
  loadWithExecSyncStub
}
