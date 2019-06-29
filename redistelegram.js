const moment = require('moment')
const utc = moment.utc
const Telegram = require('node-telegram-bot-api')
const Redis = require('redis')

const telegramCommands = {
  '/start': 'emitStart',
  '/advice': 'emitAdvice',
  '/subscribe': 'emitSubscribe',
  '/unsubscribe': 'emitUnSubscribe',
  '/price': 'emitPrice',
  '/help': 'emitHelp'
}

class RedisTelegram {
  constructor () {
    this.advice = {}
    this.candle = {}
    this.subscribers = []
  }

  connectTelegram (telegramToken) {
    this.bot = new Telegram(telegramToken, { polling: true })
    this.bot.onText(/(.+)/, this.verifyQuestion.bind(this))
    this.bot.on('polling_error', this.logError.bind(this))
  }

  connectRedis (chanelPrefix, host, port) {
    this.chanelPrefix = chanelPrefix
    this.client = Redis.createClient(port, host)
    this.client.on('ready', () => {
      console.log('redis-connected-ready')

      this.client.subscribe(this.chanelPrefix + 'candle')
      this.client.subscribe(this.chanelPrefix + 'advice')
      this.client.subscribe(this.chanelPrefix + 'tradeInitiated')
      this.client.subscribe(this.chanelPrefix + 'tradeCancelled')
      this.client.subscribe(this.chanelPrefix + 'tradeAborted')
      this.client.subscribe(this.chanelPrefix + 'tradeErrored')
      this.client.subscribe(this.chanelPrefix + 'tradeCompleted')
    })
    this.client.on('message', function (channel, message) {
      console.log(channel, message)
      const msg = JSON.parse(message)
      switch (channel) {
        case chanelPrefix + 'candle'         : this.processCandle(msg); break
        case chanelPrefix + 'advice'         : this.processAdvice(msg); break
        case chanelPrefix + 'tradeInitiated' : this.processTradeInitiated(msg); break
        case chanelPrefix + 'tradeCancelled' : this.processTradeCancelled(msg); break
        case chanelPrefix + 'tradeAborted'   : this.processTradeAborted(msg); break
        case chanelPrefix + 'tradeErrored'   : this.processTradeErrored(msg); break
        case chanelPrefix + 'tradeCompleted' : this.processTradeCompleted(msg); break
        default:
          console.log('unknown channel' + channel, message)
      }
    }.bind(this))
  }

  publishMessage (message) {
    for (let chatId of this.subscribers) {
      this.bot.sendMessage(chatId, message)
    }
  }

  emitStart (chatId) {
    this.bot.sendMessage(chatId, 'Hello! How can I help you?')
  }

  emitHelp (chatId) {
    this.bot.sendMessage(chatId,
      'Possible commands are:' +
      Object.keys(telegramCommands).join(',') +
      '.'
    )
  }

  emitSubscribe (chatId) {
    if (this.subscribers.indexOf(chatId) === -1) {
      this.subscribers.push(chatId)
      this.bot.sendMessage(chatId, `Success! Got ${this.subscribers.length} subscribers.`)
    } else {
      this.bot.sendMessage(chatId, 'You are already subscribed.')
    }
  }

  emitUnSubscribe (chatId) {
    if (this.subscribers.indexOf(chatId) > -1) {
      this.subscribers.splice(this.subscribers.indexOf(chatId), 1)
      this.bot.sendMessage(chatId, 'Success!')
    } else {
      this.bot.sendMessage(chatId, 'You are not subscribed.')
    }
  }

  // sent price over to the last chat
  emitPrice (chatId) {
    let message = []
    for (let market in this.candle) {
      message.push(
        market +
        ' is ' + this.candle[market].close +
        ' from ' + moment(this.candle[market].start).fromNow() +
        ' by ' + this.candle[market].volume + '/' + this.candle[market].trades
      )
    }
    this.bot.sendMessage(chatId, 'Current price\n' + message.join('\n'))
  }

  printAdvice (market, advice) {
    return market + JSON.stringify(advice)
  }

  emitAdvice (chatId) {
    let message = []
    for (let market in this.advice) {
      message.push(
        this.printAdvice(market, this.advice[market])
      )
    }
    this.bot.sendMessage(chatId, 'Advice:\n' + message.join('\n'))
  }

  verifyQuestion (msg, text) {
    try {
      if (text[1].toLowerCase() in telegramCommands) {
        this[telegramCommands[text[1].toLowerCase()]](msg.chat.id)
      } else {
        this.emitHelp(msg.chat.id)
      }
    } catch (e) {
      console.log(e)
      throw e
    }
  }

  processCandle (msg) {
    const candle = msg.data
    this.candle[msg.market] = candle
  }

  processAdvice (msg) {
    const advice = msg.data
    if (advice.recommendation === 'soft') return

    this.advice[msg.market] = advice

    this.publishMessage(
      'Advice:\n' +
      this.printAdvice(msg.market, advice)
    )
  }

  processTradeInitiated (msg) {
    const tradeInitiated = msg.data
    this.publishMessage(
      'Trade initiated ' + msg.market +
      '. ID: ' + tradeInitiated.id +
      '\nAction: ' + tradeInitiated.action + '\nPortfolio: ' +
      tradeInitiated.portfolio + '\nBalance: ' + tradeInitiated.balance
    )
  }

  processTradeCancelled (msg) {
    const tradeCancelled = msg.data
    this.publishMessage(
      'Trade cancelled ' + msg.market +
      '. ID: ' + tradeCancelled.id
    )
  }

  processTradeAborted (msg) {
    const tradeAborted = msg.data
    this.publishMessage(
      'Trade aborted ' + msg.market +
      '. ID: ' + tradeAborted.id +
      '\nNot creating order! Reason: ' + tradeAborted.reason
    )
  }

  processTradeErrored (msg) {
    const tradeErrored = msg.data
    this.publishMessage(
      'Trade errored ' + msg.market +
      '. ID: ' + tradeErrored.id +
      '\nReason: ' + tradeErrored.reason
    )
  }

  processTradeCompleted (msg) {
    const tradeCompleted = msg.data
    this.publishMessage(
      'Trade completed ' + msg.market +
      '. ID: ' + tradeCompleted.id +
      '\nAction: ' + tradeCompleted.action +
      '\nPrice: ' + tradeCompleted.price +
      '\nAmount: ' + tradeCompleted.amount +
      '\nCost: ' + tradeCompleted.cost +
      '\nPortfolio: ' + tradeCompleted.portfolio +
      '\nBalance: ' + tradeCompleted.balance +
      '\nFee percent: ' + tradeCompleted.feePercent +
      '\nEffective price: ' + tradeCompleted.effectivePrice
    )
  }

  logError (message) {
    console.log('Telegram ERROR:', message)
  }
}

const tl = new RedisTelegram()
tl.connectRedis('gekko.', 'localhost', 6379)
tl.connectTelegram(process.env.TELEGRAM_TOKEN)
