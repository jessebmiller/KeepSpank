const { SpankBank,
        Token,
        setSpankBankLogger } = require('@spankdev/spankbank-web3')
const Web3 = require('web3')
const Tx = require('ethereumjs-tx')

// provider must manage the delegate key
const web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"))

const passwords = {}
passwords[process.env.DELEGATE_KEY] = process.env.PASSWORD

const address = "0xe9cC9e8C9E211Ef645D1a39b11Ba6b1c0b5ecd30"
const bank = new SpankBank(address, web3)
bank.callOptions = {gas: 41000}

// maintain checks in and extends by one period idempotently
const maintain = async (bank, delegateKey) => {
  console.log("maintaining", delegateKey)
  const currentPeriod = await bank.currentPeriod()
  const spankPoints = await bank.getSpankPoints(delegateKey, currentPeriod + 1)
  if (spankPoints !== "0") {
    console.log(
      `${delegateKey} has ${spankPoints} points next period.`,
      "Already checked in. skipping."
    )
    return
  }

  const stakerAddress = await bank.stakerByDelegateKey(delegateKey)
  if (parseInt(stakerAddress, 16) === 0) {
    console.warn(
      `${stakerAddress} staker, has ${delegateKey} been delegated yet?`,
      'skipping.'
    )
    return
  }
  const staker = await bank.stakers(stakerAddress)

  if (!(staker.delegateKey === delegateKey)) {
    console.error(
      `Unexpected delegate key ${delegateKey}. Expected ${staker.delegateKey}`,
      "skipping"
    )
    return
  }
  bank.web3.eth.defaultAccount = delegateKey
  await bank.web3.personal.unlockAccount(delegateKey, passwords[delegateKey])
  const tx = await bank.checkIn(staker.endingPeriod + 1)
  console.log(tx)
}

const maintainAll = () => {
  bank.web3.eth.accounts.forEach((a) => {
    maintain(bank, a)
  })
}

const second = 1000
const minute = second * 60
const hour = minute * 60
const day = hour * 24

const interval = process.env.INTERVAL_SECONDS
      ? parseInt(process.env.INTERVAL_SECONDS, 10) * 1000
      : day

const logWaiting = () => {console.log(`Waiting ${interval / 1000} seconds`)}

const main = () => {
  maintainAll()
  logWaiting()
  const timeout = setInterval(
    () => {
      maintainAll()
      logWaiting()
    },
    interval
  )
  process.on("SIGINT", () => {
    clearTimeout(timeout)
    process.exit()
  })

}

main()

