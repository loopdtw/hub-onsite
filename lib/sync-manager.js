'use strict'

/*===============================================
=            DEPENDENCY DECLARATIONS            =
===============================================*/

var app = require('../app');
var Promise = require('bluebird');
var SocketManager = require('./socket-manager');
var Common = require('./common');
var noble = require('./noble');
var Peripheral = require('./noble/lib/peripheral');
var logger = require('loopd-logger').logger;
var path = require('path');
var appDir = path.dirname(require.main.filename);
var pjson = require('../package.json');
var async = require('async');
var conv = require('binstring');
var fs = Promise.promisifyAll(require("fs"));
var LoopdBadge = require('./loopd-badge');
var sys = require('sys')
var exec = require('child_process').exec;
var LRU = require("lru-cache");
var level = require('level');
var request = require('request');

// 1) Create our database, supply location and options.
//    This will create or open the underlying LevelDB store.
var db = level('./var/leveldb')

/*=====  End of DEPENDENCY DECLARATIONS  ======*/

/*========================================
=            VAR DECLARATIONS            =
========================================*/

/*----------  BLE UUIDs  ----------*/

var BADGE_SERVICE_UUID = "fb694b90f49e45978306171bba78f846";
var serviceUUIDs = [BADGE_SERVICE_UUID];
var LOOPD_COMMAND_CHARACTERISTICS_UUID = "1ece95eb69cb4f518d8981821bb1d077";
var characteristicsUUID = [LOOPD_COMMAND_CHARACTERISTICS_UUID];
var commandCharHandle = 0x2a;

var rssiThreshold = -60;
var serverSocket = null;

var seenPeripherals = {};
var existingBadges = {};
var connectedPeripherals = [];

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
var serviceBuffer = null;

//dictates the number of simultaneous connections our noble should try to undertake at a given time
var MAX_CON = 5;

var connectBadgeMode = {
    SYNC: 0,
    UNSYNC: 1,
    COMMAND: 2,
    ALLOCATE: 3
}

var peripheralStatus = {
    STATUS_NONE: 0,
    STATUS_ALLOCATING: 1,
    STATUS_ALLOCATED: 2,
    STATUS_SYNCING: 3,
    STATUS_SYNCED: 4,
    STATUS_COMMANDING: 5,
    STATUS_COMMANDED: 6
}

var peripheralCommandStatus = {
    STATUS_IDLE: 0,
    STATUS_COMMANDING: 1
}

var nobleStatus = {
    STATUS_IDLE: 0,
    STATUS_SCANNING: 1
}

var syncingAttendees = [];

/*----------  TIMEOUTS  ----------*/

var timeouts = {};
var timeoutDurations = {
    connection: 5,
    sync: 7,
    command: 10,
    buffer: 0.5,
    updateCurrentBadges: 1,
    scanInterval: 5
}

/*----------  LOOKUPS  ----------*/
var enableLookup = false;

/*=====  End of VAR DECLARATIONS  ======*/

/*----------  PROTOTYPES  ----------*/
Array.prototype.containsPeripheral = function(peripheralToCheck) {
    var self = this;
    for (var i = 0; i < self.length; i++) {
        if (self[i].address == peripheralToCheck.address) {
            return true;
        }
    }

    return false;
}

Array.prototype.removePeripheral = function(peripheralToDelete) {
    logger.info('removing peripheral!');
    var self = this;
    self.forEach(function(peripheral, index) {
        if (peripheral == peripheralToDelete) {
            self.splice(index, 1);
        }
    });
}

Peripheral.prototype.getIdMac = function() {
    return this.advertisement.localName + this.address;
}

Peripheral.prototype.getState = function() {
    if (this.advertisement.manufacturerData) {
        var manuString = Common.hex2bin(this.advertisement.manufacturerData.toString('hex')).toString();
        return manuString.substring(0, manuString.length - 4);
    } else {
        return null;
    }
}

/*----------  ROUTES  ----------*/
app.get('/initial-data', function(req, res) {
    //enableLookup should be disabled by default
    enableLookup = false;

    //we stop noble scanning when a new page is loaded
    var result = {
        currentVersion: pjson.version
    }

    fs.readFileAsync(appDir + '/var/current-event.txt', "utf8")
        .then(function(currentEvent) {
            result.currentEvent = currentEvent;
            return fs.readFileAsync(appDir + '/var/rssi-threshold.txt', "utf8")
        })
        .then(function(rssiThreshold) {
            result.rssiThreshold = rssiThreshold;
            return fs.readFileAsync(appDir + '/var/current-worker.txt', "utf8")
        })
        .then(function(currentWorker) {
            result.currentWorker = currentWorker;
            res.send(result);
        });
});

app.post('/enable-lookup', function(req, res) {
    logger.info('enable lookup called!');
    enableLookup = true;
});

app.post('/disable-lookup', function(req, res) {
    logger.info('disable lookup called!');
    enableLookup = false;
});

app.post('/reset', function(req, res) {
    allocatedPeripherals.reset();
    res.send('OK');
});

app.post('/command-badge', function(req, res) {
    var badge = req.body.badge;
    var badgeCommand = new Buffer(req.body.badgeCommand, 'hex');
    logger.info('command for badge ' + badge.identity + ' called with', badgeCommand);
    badgeCommands[badge.identity + badge.macAddress] = badgeCommand;
    if (seenPeripherals[badge.identity + badge.macAddress].commandStatus !== peripheralCommandStatus.STATUS_COMMANDING) {
        SocketManager.broadcast('currentStatus', {
            status: 'Connecting to badge ' + badge.identity
        });
        commandStart = new Date().getTime() / 1000;
        seenPeripherals[badge.identity + badge.macAddress].commandStatus = peripheralCommandStatus.STATUS_COMMANDING;
        connect(seenPeripherals[badge.identity + badge.macAddress], connectBadgeMode.COMMAND);
        noble.stopScanning();
    } else {
        logger.info('already commanding!');
    }

    res.send("OK");
});

app.post('/signup', function(req, res) {
    var attendee = req.body.attendee;
    logger.info(attendee);
    request.post({
        url: 'https://developer.loopd.com/api/v1/onsite/attendees?access_key=12345',
        headers: {
            'Content-Type': 'application/json'
        },
        json: {
            "eventId": parseInt(attendee.eventId),
            "email": attendee.email,
            "provider": attendee.provider,
            "providerAttendeeId": attendee.providerAttendeeId,
            "firstname": attendee.firstname,
            "lastname": attendee.lastname,
            "organization": attendee.organization,
            "title": attendee.title
        }
    }, function(error, response, body) {
        logger.info(body);
        var checkinData = {
            "eventId": attendee.eventId,
            "kioskId": attendee.checkInWorker,
            "isCheckIn": true,
            "providerAttendeeId": attendee.providerAttendeeId
        }

        logger.warn(checkinData);

        request.post({
            url: 'https://developer.loopd.com/api/v1/onsite/attendees/checkin?access_key=12345',
            headers: {
                'Content-Type': 'application/json'
            },
            json: checkinData
        }, function(error, response, body) {
            if (error) logger.error(error);
            logger.info(body);
            res.send('OK');
        });
    });
});

app.post('/sync-badge', function(req, res) {
    syncNextAvailableBadge(req.body.attendee);
    res.send("OK");
});

app.post('/update-existing-badges', function(req, res) {
    existingBadges = req.body.existingBadges;
    res.send("OK");
});

app.post('/unsync-badge', function(req, res) {
    var badge = req.body.badge;
    delete existingBadges[badge.idMac];

    if (seenPeripherals[badge.identity + badge.macAddress]) {
        allocatedPeripherals.del(badge.macAddress);
        seenPeripherals[badge.identity + badge.macAddress].status = peripheralStatus.STATUS_NONE;
        db.del(badge.macAddress, function(err) {
            if (err) {
                logger.error(err);
            }
        });
    }

    res.send("OK");
});

app.get('/reset-bluetooth', function(req, res) {
    exec("rfkill block bluetooth", puts);
    exec("rfkill unblock bluetooth", puts);
    exec("hciconfig hci0 up", puts);
});

function puts(error, stdout, stderr) {
    sys.puts(stdout)
}

/*----------  BADGE STATE  ----------*/
function init() {
    fs.readFileAsync(appDir + '/var/rssi-threshold.txt', "utf8")
        .then(function(rssiThreshold) {
            rssiThreshold = rssiThreshold;
            noble.startScanning(serviceUUIDs, true);
            updateCurrentBadges();
        });
}

var syncNextAvailableBadge = function(attendee) {
    logger.info('trying to sync the next available badge');
    syncStart = new Date().getTime() / 1000.0;

    var allocatedPeripheralsArray = allocatedPeripherals.values();
    if (allocatedPeripheralsArray.length > 0) {
        //we have available badges to connect to
        allocatedPeripheralsArray[0].status = peripheralStatus.STATUS_SYNCING;
        syncingAttendees[allocatedPeripheralsArray[0].advertisement.localName] = attendee;
        noble.stopScanning();
        connect(allocatedPeripheralsArray[0], connectBadgeMode.SYNC);
    }
}

noble.on('stateChange', function(state) {
    logger.info("central state: " + state);
    if (state == "poweredOn") {
        init();
    } else {
        noble.stopScanning();
    }
});

noble.on('scanStart', function() {
    noble.status = nobleStatus.STATUS_SCANNING;
    logger.info('=====started scanning!=====');
    clearTimeout(timeouts.SCAN);
});

noble.on('scanStop', function() {
    noble.status = nobleStatus.STATUS_IDLE;
    logger.info('=====stopped scanning!=====');

    //timeout function in case we get stuck in peripheral
    timeouts.SCAN = setTimeout(function() {
        if (noble.status == nobleStatus.STATUS_IDLE) {
            logger.error('Stopped scanning for too long! Let\'s start scanning again!');
            noble.startScanning(serviceUUIDs, true);
        }
    }, 10 * 1000);
});

noble.on('discover', function(peripheral) {
    seenPeripherals[peripheral.getIdMac()] = peripheral;

    if (!peripheral.status) {
        peripheral.status = peripheralStatus.STATUS_NONE;
    }

    if (peripheral.rssi > -50) {
        // logger.info("Spotted badge " + peripheral.advertisement.localName + "(" + peripheral.address + ") RSSI : " + peripheral.rssi);

        if (enableLookup) {
            SocketManager.broadcast('badgeLookup', {
                identity: peripheral.advertisement.localName
            });

        } else {
            if (allocatedPeripherals.get(peripheral.address)) {
                allocatedPeripherals.set(peripheral.address, peripheral);
            } else {
                if (peripheral.status == peripheralStatus.STATUS_ALLOCATED) {
                    allocatedPeripherals.set(peripheral.address, peripheral);
                }
            }

            db.get(peripheral.address, function(err, value) {
                if (err) {
                    //since badge is not already synced to an attendee, and its not already allocated, we allocate it
                    // logger.info(connectedPeripherals.length, peripheral.status);
                    if (typeof existingBadges[peripheral.getIdMac()] === 'undefined' &&
                        !allocatedPeripherals.get(peripheral.address) &&
                        peripheral.status == peripheralStatus.STATUS_NONE) {
                        allocatedPeripherals.set(peripheral.address, peripheral);
                    }
                } else {
                    //since it already exists, we ignore it
                    logger.debug('already exists in db!');
                }
            });
        }
    }
});

function connect(peripheral, mode) {
    logger.info('========================');
    logger.info('peripheral connecting...', peripheral.advertisement.localName);

    var disconnected = false;
    peripheral.connect(function(error) {
        logger.info('peripheral connect callback called');
        if (!error) {
            if (mode === connectBadgeMode.COMMAND) {
                issueCommand(peripheral);
            } else if (mode === connectBadgeMode.SYNC) {
                syncBadge(peripheral);
            }
        } else {
            logger.error('Peripheral connect error: ' + error);
        }
    });

    timeouts.connection = setTimeout(function() {
        if (!disconnected) {
            if (peripheral.status == peripheralStatus.STATUS_SYNCING) {
                SocketManager.broadcast('badgeDisconnect', {
                    'status': 'Premature disconnect.'
                });

                SocketManager.broadcast('currentStatus', {
                    'status': 'Badge ' + peripheral.advertisement.localName + ' timed out! Please try again.'
                });
            }

            if (allocatedPeripherals.get(peripheral.address)) {
                allocatedPeripherals.del(peripheral.address);
            }

            if (peripheral.status == peripheralStatus.STATUS_SYNCING) {
                logger.warn('timed out during syncing');
                peripheral.status = peripheralStatus.STATUS_NONE;
            }

            if (peripheral.commandStatus == peripheralCommandStatus.STATUS_COMMANDING) {
                logger.warn('timed out during commanding');
                peripheral.commandStatus = peripheralCommandStatus.STATUS_IDLE;
                SocketManager.broadcast('currentStatus', {
                    'status': 'Can\'t find badge!'
                });
            }

            connectedPeripherals.splice(connectedPeripherals.indexOf(peripheral.advertisement.localName), 1);
            noble.cancelLeConn();
            noble.startScanning(serviceUUIDs, true);
        }
    }, 4 * 1000);

    peripheral.once('disconnect', function() {
        disconnected = true;

        if (peripheral.status == peripheralStatus.STATUS_SYNCING ||
            peripheral.status == peripheralStatus.STATUS_COMMANDING) {

            SocketManager.broadcast('currentStatus', {
                'status': 'Badge ' + peripheral.advertisement.localName + ' prematurely disconnected! Please try again.'
            });

            SocketManager.broadcast('badgeDisconnect', {
                'status': 'Premature disconnect.'
            });
        }

        if (peripheral.status == peripheralStatus.STATUS_SYNCING) {
            peripheral.status = peripheralStatus.STATUS_NONE;
            // syncNextAvailableBadge();
        }

        if (peripheral.status == peripheralStatus.STATUS_SYNCED) {
            delete syncingAttendees[peripheral.advertisement.localName];
        }

        peripheral.commandStatus = peripheralCommandStatus.STATUS_IDLE;
        connectedPeripherals.splice(connectedPeripherals.indexOf(peripheral.advertisement.localName), 1);

        logger.info('peripheral disconnected!', peripheral.advertisement.localName);
        logger.info('========================');
        noble.startScanning(serviceUUIDs, true);

        return;
    });
}

function issueCommand(peripheral) {
    var index = peripheral.advertisement.localName + peripheral.address;
    logger.info('issue command called!');

    if (badgeCommands[index]) {
        SocketManager.broadcast('currentStatus', {
            'status': "Blinking badge " + peripheral.advertisement.localName
        });
        blinkLEDs(peripheral, true);
    } else {
        //for some reason our command isn't defined so we disconnect and issue error message
        peripheral.writeHandle(0x2a, new Buffer([0x11]), false);
        SocketManager.broadcast('alert', {
            'message': "Something went wrong with badge " + peripheral.advertisement.localName
        });
    }
}

function syncBadge(peripheral) {
    peripheral.writeHandle(0x2a, new Buffer([0x07]), false, function(error) {
        if (!error) {
            blinkLEDs(peripheral, false);
            SocketManager.broadcast('currentStatus', {
                'status': "Syncing badge " + peripheral.advertisement.localName
            });

            clearTimeout(timeouts.sync);
            clearTimeout(timeouts.connection);
            syncBadgeInfo(peripheral);
            allocatedPeripherals.del(peripheral.address);
            peripheral.status = peripheralStatus.STATUS_SYNCED;
        } else {
            logger.error(error);
        }
    });
}

var blinkCounter = 0;
var blinkCounterLimit = 14;

function blinkLEDs(peripheral, withConfirmation) {
    // logger.info(blinkCounter, blinkCounterLimit);
    peripheral.writeHandle(0x2a, new Buffer([0xFF]), false);
    setTimeout(function() {
        peripheral.writeHandle(0x2a, new Buffer([0x00]), false);
        blinkCounter++;
        setTimeout(function() {
            if (blinkCounter <= blinkCounterLimit) {
                blinkLEDs(peripheral, withConfirmation);
            } else {
                blinkCounter = 0;
                if (withConfirmation) {
                    SocketManager.broadcast('badgeBlinked', {
                        badge: peripheral.advertisement.localName
                    });
                    SocketManager.broadcast('currentStatus', {
                        'status': "Successfully blinked " + peripheral.advertisement.localName
                    });
                }
                peripheral.writeHandle(0x2a, new Buffer([0x11]), false);
            }
        }, 50);
    }, 100);
}

function syncBadgeInfo(peripheral) {
    var currentAttendee = syncingAttendees[peripheral.advertisement.localName];
    logger.info('syncing badge to attendee!');
    SocketManager.broadcast('currentStatus', {
        'status': "Uploading data for attendee: " + currentAttendee.firstname
    });

    var badge = new LoopdBadge(peripheral);
    var uploadStart = new Date().getTime() / 1000;
    var syncEnd = new Date().getTime() / 1000.0;
    var syncDuration = syncEnd - syncStart;
    LoopdBadge.syncToAttendee(currentAttendee, peripheral)
        .then(function(attendee) {
            var uploadEnd = new Date().getTime() / 1000;
            var uploadDuration = uploadEnd - uploadStart;

            SocketManager.broadcast('currentStatus', {
                'status': "Successfully synced attendee " + attendee.firstname + " for badge " + peripheral.advertisement.localName + " (BLE Sync: " + syncDuration.toFixed(2) + "s, Upload: " + uploadDuration.toFixed(2) + "s)"
            });

            SocketManager.broadcast('badgeSynced', {
                'attendee': attendee,
                'badge': badge
            });

            db.put(peripheral.address, 'true', function(error) {
                if (error) {
                    logger.error(error);
                }
            });

            existingBadges[badge.identity + badge.macAddress] = badge;
        }).catch(function(err) {
            logger.error(err);
            SocketManager.broadcast('currentStatus', {
                'status': "Error syncing badge " + err
            });

            SocketManager.broadcast('badgeSyncError', {
                'attendee': attendee,
                'badge': badge
            });
        });
}

/*----------  GENERAL METHODS  ----------*/
function updateCurrentBadges() {
    allocatedPeripherals.prune();

    SocketManager.broadcast('currentBadges', {
        allocatedPeripheralsCount: allocatedPeripherals.length
    });

    timeouts.updateBadgeCount = setTimeout(function() {
        updateCurrentBadges();
    }, timeoutDurations.updateCurrentBadges * 1000);
}