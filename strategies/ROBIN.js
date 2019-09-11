
// let's create our own method
var method = {};

// prepare everything our method needs
method.init = function() {
  this.name = 'ROBIN';

  this.requiredHistory = this.tradingAdvisor.historySize;

  // define the indicators we need
  this.addIndicator('rsi', 'RSI', this.settings);
  this.number = 0
}

method.update = function(candle) {
  this.saveCandle = candle
  this.number++
}

method.check = function() {
  if (this.number % 100 === 0) {
    this.advice('float-short', 3)
  }

  if (this.number % 17 === 0) {
    this.advice('float-long', 2)
  }
}

method.onTrade = function(trade) {
//  console.log('onTrade', trade)
}

module.exports = method;
