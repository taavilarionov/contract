const expectRevert = require('./helpers/expectRevert')
const {
  defaultLaunchTime,
  defaultRootUtxoMerkleHash,
  defaultMaximumRedeemable,
  defaultTotalBTCCirculationAtFork
} = require('./helpers/bhx')
const { origin } = require('./helpers/general')

const BitcoinHexStub = artifacts.require('./stubs/BitcoinHexStub.sol')

describe('when deploying BitcoinHex', () => {
  contract('BitcoinHex', () => {
    let bhx

    before('setup BitcoinHex', async () => {
      bhx = await BitcoinHexStub.new(
        origin,
        defaultLaunchTime,
        defaultRootUtxoMerkleHash,
        defaultMaximumRedeemable,
        defaultTotalBTCCirculationAtFork
      )
    })

    it('should have correct name and symbol', async () => {
      assert.equal(
        await bhx.name.call(),
        'BitcoinHex',
        'BitcoinHexStub name incorrect'
      )
      assert.equal(
        await bhx.symbol.call(),
        'BHX',
        'BitcoinHexStub symbol incorrect'
      )
    })

    it("should fail to transfer bhxs to address(0) or the bhx's address", async () => {
      await expectRevert(bhx.transfer(0, 1))
      await expectRevert(bhx.transfer(bhx.address, 1))
    })
  })
})
