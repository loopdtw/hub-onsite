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

LoopdBadge.prototype.calculateAdRate = function() {
	var initEpoch = this.firstSeen.getTime() / 1000;
	var nowEpoch = new Date().getTime() / 1000;
	var duration = nowEpoch - initEpoch;
	this.adRate = Math.round((this.adCount / duration) * 100) / 100;
}

LoopdBadge.prototype.incrementAdCount = function() {
	this.adCount = this.adCount + 1;
}

// LoopdBadge.prototype.saveAdvertisement = function() {
// 	var self = this;
// 	MongoManager.getMongoDb()
// 		.then(function(mongoDb) {
// 			var collection = mongoDb.collection('benchmark_2016_11_24');
// 			collection.insert({
// 				identity: self.identity,
// 				macAddress: self.macAddress,
// 				txPowerLevel: self.txPowerLevel,
// 				manufacturerData: self.manufacturerData,
// 				generalState: self.generalState,
// 				dataState: self.dataState,
// 				batteryState: self.batteryState,
// 				rssi: self.lastRssi,
// 				created: new Date()
// 			}, function(err, result) {
// 				if (err) logger.error(err);
// 			});
// 		});
// }

LoopdBadge.syncToAttendee = function(attendee, peripheral) {
	return new Promise(function(resolve, reject) {
		var attendeeData = [{
			eventAttendeeId: attendee.id,
			badge: peripheral.advertisement.localName,
			syncTimeRssi: peripheral.rssi,
			macAddress: peripheral.address,
			syncTime: Date.now()
		}];
		
		logger.info(config.get('app.baseUrl') + '/Events/' + attendee.eventId + '/eventattendees/badges');
		var requestStart = new Date().getTime() / 1000;
		request.postAsync({
				url: config.get('app.baseUrl') + '/Events/' + attendee.eventId + '/eventattendees/badges',
				headers: {
					'Loopd-Admin-Key': '2lWYeQ1Bq3QOqzr43Swy6GMKNAX3Z07htTeqkDL4NLhLFeHFoyOYp5mIITZBAhQV',
					'Loopd-Event-Id': attendee.eventId
				},
				json: {
					eventAttendees: attendeeData,
					source: "WEB_E",
					sourceId: "WE:WE:WE:WE"
				}
			})
			.then(function(httpResponse, body) {
				logger.info('request time:', (new Date().getTime() / 1000) - requestStart + "s");
				resolve(attendee);
			})
			.catch(function(err) {
				logger.error(err);
				reject(err);
			});
	});
}

module.exports = LoopdBadge;