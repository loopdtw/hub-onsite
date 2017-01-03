'use strict'

var Common = require('./common');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var logger = require('loopd-logger').logger;
var path = require('path');
var conv = require('binstring');
var fs = Promise.promisifyAll(require("fs"));
var exec = require('child_process').exec;
var LRU = require("lru-cache");
var request = require('request');
var LoopdBadge = require('./loopd-badge');
var Peripheral = require('./noble/lib/peripheral');
var noble = require('./noble');
var SocketManager = require('./socket-manager');
var pjson = require('../package.json');
var router = require('express').Router();

/*----------  BLE UUIDs  ----------*/

var BADGE_SERVICE_UUID = "fb694b90f49e45978306171bba78f846";
var serviceUUIDs = [BADGE_SERVICE_UUID];
var LOOPD_COMMAND_CHARACTERISTICS_UUID = "1ece95eb69cb4f518d8981821bb1d077";
var characteristicsUUID = [LOOPD_COMMAND_CHARACTERISTICS_UUID];
var commandCharHandle = 0x2a;

var rssiThreshold = -60;
var serverSocket = null;
var existingBadges = {};
var badgeCommands = {};

/*----------  SYNC TiME TRACKER  ----------*/
var syncStart = null;
var syncEnd = null;
var commandStart = null;
var commandEnd = null;

/*----------  CURRENT BADGES  ----------*/

var allocatedPeripherals = LRU({
    maxAge: 1000 * 10
});
var seenPeripherals = LRU({
   maxAge: 1000 * 30 
});

var nobleStatus = {
    STATUS_IDLE: 0,
    STATUS_SCANNING: 1
};
var peripheralStatus = {
    STATUS_IDLE: 0,
    STATUS_SYNCING: 1,
    STATUS_COMMANDING: 2,
};
var connectBadgeMode = {
    SYNC: 0,
    COMMAND: 1
};

var syncingAttendees = [];

/*----------  TIMEOUTS  ----------*/

var timeouts = {};

/*----------  LOOKUPS  ----------*/

var enableLookup = false;
var BLINK_COUNTER = 0;
var BLINK_COUNTER_LIMIT = 14;

Peripheral.prototype.getIdMac = function() {
    return this.advertisement.localName + this.address;
}

function _allocatePeripheral(peripheral) {
    if (typeof existingBadges[peripheral.address] === 'undefined' &&
        !allocatedPeripherals.get(peripheral.address) &&
        peripheral.status === peripheralStatus.STATUS_IDLE) {
        allocatedPeripherals.set(peripheral.address, peripheral);
    }
}

function _connect(peripheral, mode) {
    var disconnected = false;
    
    noble.stopScanning();
    logger.info('========================');
    logger.info('peripheral connecting...', peripheral.advertisement.localName);
    peripheral.connect(function(error) {
        logger.info('peripheral connect callback called');
        if (!error) {
            if (mode === connectBadgeMode.COMMAND) {
                _issueCommand(peripheral);
            } else if (mode === connectBadgeMode.SYNC) {
                _syncBadge(peripheral);
            }
        } else {
            logger.error('Peripheral connect error: ' + error);
        }
    });

    timeouts.connection = setTimeout(function() {
        if (!disconnected) {
            if (peripheral.status == peripheralStatus.STATUS_SYNCING || peripheral.status = peripheralStatus.STATUS_COMMANDING) {
                SocketManager.broadcast('badgeDisconnect', {
                    'status': 'Premature disconnect.'
                });
                SocketManager.broadcastStatus('Badge ' + peripheral.advertisement.localName + ' timed out! Please try again.');
            }
            if (allocatedPeripherals.get(peripheral.address)) allocatedPeripherals.del(peripheral.address);
            peripheral.status = peripheralStatus.STATUS_IDLE;
            noble.cancelLeConn();
            noble.startScanning(serviceUUIDs, true);
        }
    }, 4 * 1000);

    peripheral.once('disconnect', function() {
        disconnected = true;

        if (peripheral.status !== peripheralStatus.STATUS_IDLE) {
            SocketManager.broadcast('Badge ' + peripheral.advertisement.localName + ' prematurely disconnected! Please try again.');
            SocketManager.broadcast('badgeDisconnect', {
                'status': 'Premature disconnect.'
            });
        }

        peripheral.status = peripheralStatus.STATUS_IDLE;
        if (peripheral.status == peripheralStatus.STATUS_SYNCED) {
            delete syncingAttendees[peripheral.advertisement.localName];
        }

        logger.info('peripheral disconnected!', peripheral.advertisement.localName);
        logger.info('========================');
        noble.startScanning(serviceUUIDs, true);

        return;
    });
}

function _issueCommand(peripheral) {
    var index = peripheral.advertisement.localName + peripheral.address;
    if (badgeCommands[index]) {
        SocketManager.broadcastStatus("Blinking badge " + peripheral.advertisement.localName);
        _blinkLEDs(peripheral, true);
    } else {
        //for some reason our command isn't defined so we disconnect and issue error message
        peripheral.writeHandle(0x2a, new Buffer([0x11]), false);
        SocketManager.broadcast('alert', {
            'message': "Something went wrong with badge " + peripheral.advertisement.localName
        });
    }
}

function _syncBadge(peripheral) {
    peripheral.writeHandle(0x2a, new Buffer([0x07]), false, function(error) {
        if (!error) {
            _blinkLEDs(peripheral, false);
            SocketManager.broadcastStatus('Syncing badge ' + peripheral.advertisement.localName);
            clearTimeout(timeouts.sync);
            clearTimeout(timeouts.connection);
            _updateInfoForBadge(peripheral);
            allocatedPeripherals.del(peripheral.address);
            peripheral.status = peripheralStatus.STATUS_SYNCED;
        } else {
            logger.error(error);
        }
    });
}

function _updateInfoForBadge(peripheral) {
    var currentAttendee = syncingAttendees[peripheral.advertisement.localName];
    var badge = new LoopdBadge(peripheral);
    var uploadStart = new Date().getTime() / 1000;
    var syncEnd = new Date().getTime() / 1000.0;
    var syncDuration = syncEnd - syncStart;
    
    logger.info('syncing badge to attendee!');
    SocketManager.broadcast('Uploading data for attendee: ' + currentAttendee.firstname);
    LoopdBadge.syncToAttendee(currentAttendee, peripheral).then(function(attendee) {
        var uploadEnd = new Date().getTime() / 1000;
        var uploadDuration = uploadEnd - uploadStart;
        existingBadges[badge.macAddress] = badge;
        SocketManager.broadcast('Successfully synced attendee ' + attendee.firstname + ' for badge ' + peripheral.advertisement.localName + ' (BLE Sync: ' + syncDuration.toFixed(2) + 's, Upload: ' + uploadDuration.toFixed(2) + 's)');
        SocketManager.broadcast('badgeSynced', {
            'attendee': attendee,
            'badge': badge
        });
    }).catch(function(err) {
        logger.error(err);
        SocketManager.broadcast('Error syncing badge ' + err);
        SocketManager.broadcast('badgeSyncError', {
            'attendee': attendee,
            'badge': badge
        });
    });
}

function _blinkLEDs(peripheral, withConfirmation) {
    peripheral.writeHandle(0x2a, new Buffer([0xFF]), false);
    setTimeout(function() {
        peripheral.writeHandle(0x2a, new Buffer([0x00]), false);
        BLINK_COUNTER++;
        setTimeout(function() {
            if (BLINK_COUNTER <= BLINK_COUNTER_LIMIT) {
                _blinkLEDs(peripheral, withConfirmation);
            } else {
                BLINK_COUNTER = 0;
                if (withConfirmation) {
                    SocketManager.broadcast('badgeBlinked', {
                        badge: peripheral.advertisement.localName
                    });
                    SocketManager.broadcastStatus('Successfully blinked ' + peripheral.advertisement.localName);
                    clearTimeout(timeouts.connection);
                }
                peripheral.status = peripheralStatus.STATUS_IDLE;
                peripheral.writeHandle(0x2a, new Buffer([0x11]), false);
            }
        }, 50);
    }, 100);
}

function _handleStateChange(state) {
    logger.info("central state: " + state);
    if(state === 'poweredOn') 
        noble.startScanning(serviceUUIDs, true);
    exports.eventManager.emit('state', {
        state: 'scanning'
    });
}

function _handleScanStart() {
    logger.info('=====started scanning!=====');
    noble.status = nobleStatus.STATUS_SCANNING;
    clearTimeout(timeouts.SCAN);
}

function _handleScanStop() {
    logger.info('=====stopped scanning!=====');
    noble.status = nobleStatus.STATUS_IDLE;
    timeouts.SCAN = setTimeout(function() {
        if (noble.status == nobleStatus.STATUS_IDLE) {
            logger.error('Stopped scanning for too long! Let\'s start scanning again!');
            noble.startScanning(serviceUUIDs, true);
        }
    }, 10 * 1000);
}

function _handleDiscover(peripheral) {
    if (!peripheral.status) peripheral.status = peripheralStatus.STATUS_IDLE;
    seenPeripherals.set(peripheral.address, peripheral);
    if (peripheral.rssi > -50) {
        return enableLookup?
            SocketManager.broadcast('badgeLookup', {
                identity: peripheral.advertisement.localName
            }):
            _allocatePeripheral(peripheral);
    }
}

function _updateCurrentBadges() {
    allocatedPeripherals.prune();
    seenPeripherals.prune();
    SocketManager.broadcast('currentBadges', {
        allocatedPeripheralsCount: allocatedPeripherals.length
    });
    timeouts.updateBadgeCount = setTimeout(function() {
        _updateCurrentBadges();
    }, 1000);
}

/**
 * Set lookup according to arg
 * @param {BOOLEAN} setLookup
 */
exports.setLookup = function(setLookup) {
    enableLookup = setLookup;
};

exports.init = function() {
    var Manager = function() {};
    util.inherits(Manager, EventEmitter); 
    exports.eventManager = new Manager();
    noble.on('stateChange', _handleStateChange);
    noble.on('scanStart', _handleScanStart);
    noble.on('scanStop', _handleScanStop);
    noble.on('discover', _handleDiscover);
    _updateCurrentBadges();
};

exports.syncNextAvailableBadge = function(attendee) {
    syncStart = new Date().getTime() / 1000.0;
    var allocatedPeripheralsArray = allocatedPeripherals.values();
    if (allocatedPeripheralsArray.length > 0) {
        allocatedPeripheralsArray[0].status = peripheralStatus.STATUS_SYNCING;
        syncingAttendees[allocatedPeripheralsArray[0].advertisement.localName] = attendee;
        _connect(allocatedPeripheralsArray[0], connectBadgeMode.SYNC);
    }
};

exports.commandBadge = function(badge, badgeCommand) {
    return Promise.try(function() {
        var currentPeripheral = seenPeripherals.get(badge.macAddress);
        
        commandStart = new Date().getTime() / 1000;
        SocketManager.broadcastStatus('Attempting to connect to badge ' + badge.identity);
        logger.info('command for badge ' + badge.identity + ' called with', badgeCommand);
        
        if(!currentPeripheral) throw Common.errorFormatter('Badge not found.', 400);
        if(currentPeripheral.status === peripheralStatus.STATUS_COMMANDING) throw Common.errorFormatter('Badge is still commanding', 400);
        
        badgeCommands[badge.identity + badge.macAddress] = badgeCommand;
        currentPeripheral.status = peripheralStatus.STATUS_COMMANDING;
        _connect(currentPeripheral, connectBadgeMode.COMMAND);
    });
};

exports.unsyncBadgeAsync = function(badge) {
    return Promise.try(function() {
        delete existingBadges[badge.macAddress];
    });
};

exports.updateExistingBadges = function(badges) {
    badges.forEach(function(badge) {
        if(existingBadges[badge.macAddress]) {
            allocatedPeripherals.del(badge.macAddress);
            existingBadges[badge.macAddress] = 1;
        }
    });
};
