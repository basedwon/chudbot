const { expect } = require('chai')

const api = require('../../lib/chudbot')

describe('public api surface', () => {
  it('exports only Chudbot at module root', () => {
    expect(Object.keys(api)).to.deep.equal(['Chudbot'])
    expect(api.Chudbot).to.be.a('function')
  })
})
