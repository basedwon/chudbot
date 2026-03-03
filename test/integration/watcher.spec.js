const { expect } = require('chai')
const { Watcher } = require('../../lib/watcher')

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('Watcher integration', () => {
  it('coalesces rapid onChange calls into one debounced run', async () => {
    let runCount = 0
    const runner = {
      async runOnce() {
        runCount += 1
        await sleep(80)
        return { ok: true }
      }
    }
    const watcher = new Watcher({ runner, debounceMs: 90, quiet: true })

    watcher.onChange('/tmp/chat.md')
    await sleep(20)
    watcher.onChange('/tmp/chat.md')
    await sleep(20)
    watcher.onChange('/tmp/chat.md')

    await sleep(260)

    expect(runCount).to.equal(1)
    await watcher.stop()
  })

  it('queues only one pending rerun while busy', async () => {
    let runCount = 0
    let inFlight = 0
    let maxInFlight = 0
    const runner = {
      async runOnce() {
        runCount += 1
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await sleep(120)
        inFlight -= 1
        return { ok: true }
      }
    }
    const watcher = new Watcher({ runner, quiet: true })

    watcher._kick()
    await sleep(25)
    watcher._kick()
    watcher._kick()
    watcher._kick()

    await sleep(340)

    expect(runCount).to.equal(2)
    expect(maxInFlight).to.equal(1)
    expect(watcher.pending).to.equal(false)
    expect(watcher.busy).to.equal(false)
    await watcher.stop()
  })

  it('stop clears timer and closes watcher cleanly', async () => {
    const runner = {
      async runOnce() {
        return { ok: true }
      }
    }
    let closeCalls = 0
    const watcher = new Watcher({ runner, debounceMs: 200, quiet: true })
    watcher.watcher = {
      async close() {
        closeCalls += 1
      }
    }

    watcher.onChange('/tmp/chat.md')
    expect(watcher.timer).to.not.equal(null)

    const res = await watcher.stop()

    expect(res).to.deep.equal({ ok: true, watching: false })
    expect(closeCalls).to.equal(1)
    expect(watcher.timer).to.equal(null)
    expect(watcher.watcher).to.equal(null)
    expect(watcher.busy).to.equal(false)
    expect(watcher.pending).to.equal(false)

    await sleep(260)
    expect(watcher.busy).to.equal(false)
    expect(watcher.pending).to.equal(false)
  })
})
