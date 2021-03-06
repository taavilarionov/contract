const StakeableTokenStub = artifacts.require('StakeableTokenStub')

const {
  getCurrentBlockTime,
  accounts,
  warpBufferTime,
  shuffleArray,
  origin
} = require('../../test/helpers/general')
const {
  warpThroughBonusWeeks,
  timeWarpRelativeToLaunchTime
} = require('../../test/helpers/urt')
const { getDefaultLaunchTime } = require('../../test/helpers/bhx')
const {
  bitcoinRootHash: defaultRootUtxoMerkleHash
} = require('../../test/helpers/mkl')
const chalk = require('chalk')
const BN = require('bignumber.js')
const BigNumber = require('bignumber.js')

const setupStakeableToken = async (
  defaultCirculationAtFork,
  defaultMaximumRedeemable
) => {
  const launchTime = await getDefaultLaunchTime()
  const skt = await StakeableTokenStub.new(
    origin,
    launchTime,
    defaultRootUtxoMerkleHash,
    defaultCirculationAtFork,
    defaultMaximumRedeemable
  )

  await timeWarpRelativeToLaunchTime(skt, 60, true)

  return skt
}

const tryStakeClaimRound = async (skt, stakers, timeToStake) => {
  let stakeTime
  for (const staker of stakers) {
    const balance = await skt.balanceOf(staker)
    stakeTime = await getCurrentBlockTime()
    const unlockTime = stakeTime + timeToStake

    // eslint-disable-next-line no-console
    console.log(chalk.magenta(`staking ${balance.toString()} for ${staker}`))
    await skt.startStake(balance, unlockTime, {
      from: staker
    })
  }

  await warpThroughBonusWeeks(skt, stakeTime + timeToStake)

  await Promise.all(stakers.map(staker => skt.claimAllStakingRewards(staker)))
}

const stressTestStakes = async (
  skt,
  maxRedeemable,
  circulationAtFork,
  timeToStake,
  randomizeStakes
) => {
  const amountToMintPerUser = new BigNumber('35.1e24').div(accounts.length)
  const totalRedeemed = new BigNumber('17.1e24').mul(20).div(100)
  const redeemedCount = accounts.length

  await Promise.all(
    accounts.map(staker => skt.mintTokens(staker, amountToMintPerUser))
  )

  await skt.setMaxRedeemable(maxRedeemable)
  await skt.setRedeemedCount(redeemedCount)
  await skt.setTotalRedeemed(totalRedeemed)

  let overflowed = false
  let elapsedTime = 0
  let attempts = 0
  let stakingAccounts
  let previousTotalSupply = await skt.totalSupply()

  while (!overflowed) {
    try {
      if (randomizeStakes) {
        stakingAccounts = shuffleArray(accounts)
      } else {
        stakingAccounts = accounts
      }

      await tryStakeClaimRound(skt, stakingAccounts, timeToStake)
      elapsedTime += timeToStake + warpBufferTime

      const elapsedTimeInYears = elapsedTime / (60 * 60 * 24 * 365)
      const totalSupply = await skt.totalSupply()
      const safeTotalSupply = new BN(totalSupply.toString())
      const inflationOverPeriod = safeTotalSupply
        .div(previousTotalSupply)
        .sub(1)
        .mul(100)
        .floor(2)
        .toString()

      /* eslint-disable no-console */
      console.log(chalk.yellow(`elapsed time: ${elapsedTimeInYears} years`))

      console.log(
        chalk.yellow(
          `inflation over ${timeToStake /
            (60 * 60 * 24 * 365)} years: ${inflationOverPeriod}%`
        )
      )
      /* eslint-enable no-console */

      previousTotalSupply = safeTotalSupply
    } catch (err) {
      if (attempts > 4) {
        const totalSupply = await skt.totalSupply()
        const balances = await Promise.all(
          stakingAccounts.map(account => skt.balanceOf(account))
        )
        // need to use bn.js rather than bignumber.js in order to avoid hitting 15 sig dig limit
        const maxBalance = balances.reduce((prevValue, currValue) => {
          return new BN(prevValue.toString()).lt(new BN(currValue.toString()))
            ? currValue
            : prevValue
        }, new BN(0))

        /* eslint-disable no-console */
        console.log(
          chalk.cyan(
            `overflow point reached! Max account balance: ${maxBalance}`
          )
        )
        console.log(chalk.cyan(`totalSupply: ${totalSupply.toString()}`))
        console.log(
          chalk.cyan(`elapsed time: ${elapsedTime / (60 * 60 * 24 * 365)}`)
        )
        /* eslint-enable no-console */
        overflowed = true
      } else {
        attempts++
        // eslint-disable-next-line no-console
        console.log(
          chalk.red(
            `error occurred: ${err.message}. Trying attempt: ${attempts}...`
          )
        )
      }
    }
  }
}

module.exports = {
  setupStakeableToken,
  tryStakeClaimRound,
  stressTestStakes
}
