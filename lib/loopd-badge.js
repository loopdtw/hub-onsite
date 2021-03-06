'use strict'
var Common = require('./common');
var app = require('../app');
var config = app.config;
// var MongoManager = app.MongoManager;
var logger = require('loopd-logger').logger;
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));

var LoopdBadge = function(peripheral) {
	this.idMac = peripheral.advertisement.localName + peripheral.address;
	this.identity = peripheral.advertisement.localName;
	this.manufacturerData = peripheral.manufacturerData;
	this.macAddress = peripheral.address;
	this.txPowerLevel = peripheral.advertisement.txPowerLevel;
	this.firstSeen = new Date();
	this.lastSeen = new Date();
	this.lastRssi = peripheral.rssi;
	this.adCount = 0;
	this.adRate = 0;
	this.generalState = this.getState(peripheral);
	this.dataState = this.getDataState(peripheral);
	this.batteryState = this.getBatteryState(peripheral);
	this.syncTime = new Date();
}

// one byte data is sorted according to the following:
// * state * new data * battery
// * bbbb  * b        * bbb
LoopdBadge.prototype.getState = function(peripheral) {
	if (peripheral.advertisement.manufacturerData) {
		var manuString = Common.hex2bin(peripheral.advertisement.manufacturerData.toString('hex')).toString();
		return manuString.substring(0, manuString.length - 4);
	} else {
		return "n/a";
	}
}

LoopdBadge.prototype.getDataState = function(peripheral) {
	if (peripheral.advertisement.manufacturerData) {
		var manuString = Common.hex2bin(peripheral.advertisement.manufacturerData.toString('hex')).toString();
		return manuString.substring(manuString.length - 4, manuString.length - 3);
	} else {
		return "n/a";
	}
}

LoopdBadge.prototype.getBatteryState = function(peripheral) {
	if (peripheral.advertisement.manufacturerData) {
		var manuString = Common.hex2bin(peripheral.advertisement.manufacturerData.toString('hex')).toString();
		return manuString.substring(manuString.length - 3, manuString.length);
	} else {
		return "n/a";
	}
}

LoopdBadge.syncToAttendee = function(attendee, peripheral) {
	var currentDate = new Date();
	
	return new Promise(function(resolve, reject) {
		var badgeData = {
			badge: peripheral.advertisement.localName,
			syncTimeRssi: peripheral.rssi,
			macAddress: peripheral.address,
			syncTime: currentDate.toUTCString()
		};

		var requestStart = new Date().getTime() / 1000;
		request.postAsync({
				url: config.get('app.baseUrl') + '/events/' + attendee.eventId + '/eventattendees/' + attendee.id + '/badges',
				headers: {
					'Loopd-Admin-Key': '2lWYeQ1Bq3QOqzr43Swy6GMKNAX3Z07htTeqkDL4NLhLFeHFoyOYp5mIITZBAhQV',
					'loopd-source': 'Edison',
					'loopd-source-id': 'Edison'
				},
				json: badgeData
			}).then(function(res) {
				logger.info(res.body);
				logger.info('request time:', (new Date().getTime() / 1000) - requestStart + "s");
				if (res.body.errors && res.body.errors.length > 0) {
					logger.error(req.body.errors);
					var payload = JSON.stringify({
						channel: "#log-messages",
						username: "onsite-bot",
						text: "```\n" + JSON.stringify(res.body.errors[0], null, 2) + "\n```",
						icon_emoji: ":ghost:",
						"mrkdwn": true
					});

					var options = {
						uri: "https://hooks.slack.com/services/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",
						form: payload
					};

					request.postAsync(options).then(function(res) {
						logger.info(res);
					});
				} else {
					resolve(attendee);
				}
			}).catch(function(err) {
				logger.error(err);
				reject(err);
			});
	});
}

module.exports = LoopdBadge;