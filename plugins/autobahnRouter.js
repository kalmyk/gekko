var log = require('../core/log.js')
var util = require('../core/util')
var config = util.getConfig()
var cfgAutobahn = config.autobahnRouter
var watch = config.watch

var subscriptions = require('../subscriptions');
var _ = require('lodash');

var autobahn = require("autobahn")

var connection = new autobahn.Connection({
  url: cfgAutobahn.server,
  realm: cfgAutobahn.realm,
  authmethods: ['ticket', 'wampcra']
  // authid: user,
  // authextra: {extra1:1},
  // tlsConfiguration: {},
  // onchallenge: onchallenge
})

var Actor = function(done) {
  _.bindAll(this);

  this.market = [
    watch.exchange,
    watch.currency,
    watch.asset
  ].join('.')

  this.init(done)
}

var proto = {};
_.each(cfgAutobahn.broadcast, function(e) {
  // grab the corresponding subscription
  var subscription = _.find(subscriptions, function(s) { return s.event === e });

  if(!subscription)
    util.die('Gekko does not know this event:' + e);

  var channel = cfgAutobahn.channelPrefix + subscription.event

  proto[subscription.handler] = function(message, cb) {
    if(!_.isFunction(cb))
      cb = _.noop;

    this.emit(channel + '.' + this.market, {
      market: this.market,
      data: message
    }, cb);
  };

}, this)

let autobahnSession
Actor.prototype = proto;

Actor.prototype.init = function (done) {
  connection.onopen = function (session) {
    autobahnSession = session
    _.once(done)()
  }
  connection.open()
}

Actor.prototype.emit = function (channel, message, cb) {
  log.debug('PUB AUTOBAHN:', channel)
  autobahnSession.publish(channel, [], message, { acknowledge: true }).then(cb())
}

module.exports = Actor
