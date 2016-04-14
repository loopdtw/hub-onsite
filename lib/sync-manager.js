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
var level = require('level')
 
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
var characteristicsUUID = [];

var rssiThreshold = -60;
var serverSocket = null;

var seenPeripherals = {};
var existingBadges = {};

var badgeCommands = {};
var badgesWaitingToSync = {};

var allocationEnabled = false;

/*----------  SYNC-RELATED  ----------*/
var availablePeripherals = [];

/*----------  SYNC TiME TRACKER  ----------*/
var syncStart = null;
var syncEnd = null;
var commandStart = null;
var commandEnd = null;

/*----------  CURRENT BADGES  ----------*/
var allocatedPeripherals = LRU({
    maxAge: 1000 * 10
});
var currentAvailableBadges = [];
var currentBadges = [];

var serviceBuffer = null;

//the badge buffer allows us to only connect to one badge within 500ms
var badgeBuffer = [];

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

var syncingAttendee = null;

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
var badgeLookup = false;

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
    //badgeLookup should be disabled by default
    badgeLookup = false;

    //we stop noble scanning when a new page is loaded
    var result = {
        currentVersion: pjson.version,
        allocationEnabled: allocationEnabled
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

app.get('/allocate', function(req, res) {
    availablePeripherals.forEach(function(peripheral) {
        if (!allocatedPeripherals.get(peripheral.address) &&
            peripheral.status == peripheralStatus.STATUS_NONE) {
            peripheral.status = peripheralStatus.STATUS_ALLOCATING;
            connect(peripheral, connectBadgeMode.ALLOCATE);
        } else {
            logger.info(peripheral.advertisement.localName + ' not allowed for allocation!', peripheral.status);
        }
    });

    res.send("OK");
});

app.post('/current-event', function(req, res) {
    var eventId = req.body.eventId;
    fs.writeFileAsync(appDir + '/var/current-event.txt', eventId)
        .then(function() {
            res.send("OK");
        })
        .catch(function(err) {
            console.log(err);
        });
});

app.post('/rssi-threshold', function(req, res) {
    var rssiThreshold = req.body.rssiThreshold;
    fs.writeFileAsync(appDir + '/var/rssi-threshold.txt', rssiThreshold)
        .then(function() {
            res.send("OK");
        })
        .catch(function(err) {
            console.log(err);
        });
});

app.post('/scan', function(req, res) {
    logger.info('started scanning!');
    noble.startScanning(serviceUUIDs, req.body.detectDuplicates);
    var scanTimeout = setTimeout(function() {
        logger.info('stopped scanning!');
        noble.stopScanning();
        res.send("OK");
    }, req.body.scanTime * 1000);
});

app.post('/trigger-lookup', function(req, res) {
    badgeLookup = true;
});

app.get('/start-scan', function(req, res) {
    noble.stopScanning();
    res.sendStatus(200);
});

app.get('/stop-scan', function(req, res) {
    noble.stopScanning();
    res.sendStatus(200);
});

app.post('/reset', function(req, res) {
    availablePeripherals = [];
    allocatedPeripherals.reset();
    res.send('OK');
});

app.post('/command-badge', function(req, res) {
    var badge = req.body.badge;
    var badgeCommand = new Buffer(req.body.badgeCommand, 'hex');
    logger.info('command for badge ' + badge.identity + ' called with', badgeCommand);
    logger.info(badge.identity, badge.macAddress);
    badgeCommands[badge.identity + badge.macAddress] = badgeCommand;
    logger.warn(seenPeripherals[badge.identity+badge.macAddress].commandStatus);
    if (seenPeripherals[badge.identity+badge.macAddress].commandStatus !== peripheralCommandStatus.STATUS_COMMANDING) {
        noble.stopScanning();
        SocketManager.broadcast('currentStatus', {
            status: 'Connecting to badge ' + badge.identity
        });
        commandStart = new Date().getTime() / 1000;
        seenPeripherals[badge.identity+badge.macAddress].commandStatus = peripheralCommandStatus.STATUS_COMMANDING;
        connect(seenPeripherals[badge.identity+badge.macAddress], connectBadgeMode.COMMAND);
    } else {
        logger.info('already commanding!');
    }

    res.send("OK");
});

app.post('/bulk-command', function(req, res) {
    var state = req.body.state;
    var bulkBadgeCommand = new Buffer(req.body.bulkBadgeCommand, 'hex');
    commandStart = new Date().getTime() / 1000;
    logger.info('bulk command for states ' + state + ' called with', bulkBadgeCommand);

    var bulkPendingPeripherals = [];
    for (var key in seenPeripherals) {
        if (seenPeripherals[key].getState() == state) {
            badgeCommands[seenPeripherals[key].getIdMac()] = bulkBadgeCommand;
            bulkPendingPeripherals.push(seenPeripherals[key]);
        }
    }
    processBulkCommands(bulkPendingPeripherals);

    res.send(200);
});

app.post('/cancel-bulk-command', function(req, res) {
    if (timeouts.bulkCommand) {
        clearTimeout(timeouts.bulkCommand);
    }

    res.send(200);
});

app.post('/sync-badge', function(req, res) {
    syncingAttendee = req.body.attendee;
    syncNextAvailableBadge();
    res.send("OK");
});

app.post('/unsync-badge', function(req, res) {
    var badge = req.body.badge;
    delete existingBadges[badge.idMac];

    if(seenPeripherals[badge.identity + badge.macAddress]) {
        logger.info('seen badge found');
        allocatedPeripherals.del(badge.macAddress);
        seenPeripherals[badge.identity + badge.macAddress].status = peripheralStatus.STATUS_NONE;
        //move back to allocated badges
        connect(seenPeripherals[badge.identity + badge.macAddress], connectBadgeMode.UNSYNC);
        db.del(badge.macAddress, function (err) {
            if (err) {
                logger.error(err);
            }
        });
    }

    res.send("OK");
});

app.post('/update-existing-badges', function(req, res) {
    existingBadges = req.body.existingBadges;
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

noble.on('stateChange', function(state) {
    log("central state: " + state);
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

var allocationEnabled = true;
var counter = 0;

noble.on('discover', function(peripheral) {
    // logger.info(getState(peripheral), getDataState(peripheral), getBatteryState(peripheral));
    var badge = new LoopdBadge(peripheral);
    seenPeripherals[badge.idMac] = peripheral;
    if(!peripheral.status) {
        peripheral.status = peripheralStatus.STATUS_NONE;
    }

    if (peripheral.rssi > -50) {
        // log("Spotted badge " + peripheral.advertisement.localName + "(" + peripheral.address + ") RSSI : " + peripheral.rssi);
        // logger.info(peripheral.advertisement.localName, peripheral.status);
        // if (typeof existingBadges[badge.idMac] === 'undefined' && !availablePeripherals.containsPeripheral(peripheral)) {
        //     availablePeripherals.push(peripheral);
        // }

        if(allocatedPeripherals.get(peripheral.address)) {
            allocatedPeripherals.set(peripheral.address, peripheral);
        } else {
            if(peripheral.status == peripheralStatus.STATUS_ALLOCATED) {
                allocatedPeripherals.set(peripheral.address, peripheral);
            }
        }

        db.get(peripheral.address, function (err, value) {
            if (err) {
                //since badge is not already synced to an attendee, and its not already allocated, we allocate it
                if (allocationEnabled &&
                    typeof existingBadges[badge.idMac] === 'undefined' &&
                    !allocatedPeripherals.get(peripheral.address) &&
                    peripheral.status == peripheralStatus.STATUS_NONE &&
                    badgeBuffer.length == 0) {

                    noble.stopScanning();
                    badgeBuffer.push(peripheral);
                    connect(peripheral, connectBadgeMode.ALLOCATE);

                    //we add a timeout here to remove badge from buffer
                    setTimeout(function() {
                        badgeBuffer = [];
                    }, 1 * 1000);
                }
            } else {
                //since it already exists, we ignore it
                logger.debug('already exists in db!');
            }
        });
    }

    if(badgeLookup && peripheral.rssi > -20) {
        logger.info('looking up badge!');
        SocketManager.broadcast('badgeLookup', {
            identity: peripheral.advertisement.localName
        });
    }
});

var count = 0;

function processBulkCommands(bulkPendingPeripherals) {
    logger.info('length', bulkPendingPeripherals.length);
    var max_connections = (MAX_CON < bulkPendingPeripherals.length) ? MAX_CON : bulkPendingPeripherals.length;

    SocketManager.broadcast('currentStatus', {
        status: 'Connecting to remaining ' + bulkPendingPeripherals.length + ' badges'
    });

    for (var i = 0; i < max_connections; i++) {
        connect(bulkPendingPeripherals[i], connectBadgeMode.COMMAND);
    }

    bulkPendingPeripherals.splice(0, max_connections);

    if (bulkPendingPeripherals.length > 0) {
        timeouts.bulkCommand = setTimeout(function() {
            processBulkCommands(bulkPendingPeripherals);
        }, timeoutDurations.sync * 1000);
    } else {
        SocketManager.broadcast('bulkCommandComplete', {});
    }
}

var syncNextAvailableBadge = function() {
    syncStart = new Date().getTime() / 1000.0;

    var allocatedPeripheralsArray = allocatedPeripherals.values();
    if (allocatedPeripheralsArray.length > 0) {
        //we have available badges to connect to
        noble.stopScanning();
        allocatedPeripheralsArray[0].status = peripheralStatus.STATUS_SYNCING;
        connect(allocatedPeripheralsArray[0], connectBadgeMode.SYNC);
    }
}

function connect(peripheral, mode) {
    var disconnected = false;
    var loopdCharacteristic;

    logger.info('1. Connecting to ' + peripheral.advertisement.localName);
    peripheral.connect(function(error) {
        if (!error) {
            logger.info('2. Discovering services for peripheral ' + peripheral.advertisement.localName);
            peripheral.discoverServices(serviceUUIDs, function(error, services) {
                if (services) {
                    logger.info('3. Discovering characteristics for peripheral ' + peripheral.advertisement.localName);
                    var loopdService = services[0];
                    if(loopdService) {
                        loopdService.discoverCharacteristics(characteristicsUUID, function(error, characteristics) {
                            loopdCharacteristic = characteristics[0];
                            loopdCharacteristic.notify(true, function(error) {
                                if (mode === connectBadgeMode.COMMAND) {
                                    issueCommand(peripheral, loopdCharacteristic);
                                } else if (mode === connectBadgeMode.SYNC) {
                                    syncBadge(peripheral, loopdCharacteristic);
                                } else if (mode === connectBadgeMode.ALLOCATE) {
                                    allocateBadge(peripheral, loopdCharacteristic);
                                } else if (mode === connectBadgeMode.UNSYNC) {
                                    unsyncBadge(peripheral, loopdCharacteristic);
                                }
                            });
                        });
                    }
                } else {
                    logger.error('Permaturely disconnected ' + peripheral.advertisement.localName);
                }
            });
        } else {
            logger.error('Peripheral connect error: ' + error);
        }
    });

    timeouts.connection = setTimeout(function() {
        if(!disconnected) {
            if(peripheral.status == peripheralStatus.STATUS_SYNCING) {
                SocketManager.broadcast('badgeDisconnect', {
                    'status': 'Premature disconnect.'
                });

                SocketManager.broadcast('currentStatus', {
                    'status': 'Badge ' + peripheral.advertisement.localName + ' timed out! Please try again.'
                });
            }

            if(allocatedPeripherals.get(peripheral.address)) {
                allocatedPeripherals.del(peripheral.address);
            }

            logger.warn(peripheral.status, peripheral.commandStatus);

            if (peripheral.status == peripheralStatus.STATUS_ALLOCATING) {
                logger.warn('timed out during allocation');
                peripheral.status = peripheralStatus.STATUS_NONE;
            }

            if (peripheral.status == peripheralStatus.STATUS_SYNCING) {
                logger.warn('timed out during syncing');
                syncNextAvailableBadge();
                peripheral.status = peripheralStatus.STATUS_NONE;
            }

            if (peripheral.commandStatus == peripheralCommandStatus.STATUS_COMMANDING) {
                logger.warn('timed out during commanding');
                peripheral.commandStatus = peripheralStatus.STATUS_IDLE;
                SocketManager.broadcast('currentStatus', {
                    'status': 'Can\'t find badge!'
                });
            }

            logger.warn('peripheral connection timeout!');
            noble.cancelLeConn();
            peripheral.commandStatus = peripheralCommandStatus.STATUS_IDLE;
            noble.startScanning(serviceUUIDs, true);
        }
    }, 4 * 1000);

    peripheral.once('disconnect', function() {
        disconnected = true;

        if (peripheral.status == peripheralStatus.STATUS_SYNCING ||
            peripheral.status == peripheralStatus.STATUS_COMMANDING ||
            peripheral.status == peripheralStatus.STATUS_ALLOCATING) {
            SocketManager.broadcast('currentStatus', {
                'status': 'Badge ' + peripheral.advertisement.localName + ' prematurely disconnected! Please try again.'
            });

            SocketManager.broadcast('badgeDisconnect', {
                'status': 'Premature disconnect.'
            });
        }

        // if(peripheral.status == peripheralStatus.STATUS_SYNCING) {
        //     connect(peripheral, connectBadgeMode.SYNC);
        // }

        if (peripheral.status == peripheralStatus.STATUS_SYNCED) {
            syncingAttendee = null;
        }

        peripheral.commandStatus = peripheralCommandStatus.STATUS_IDLE;

        log('========================');
        log('peripheral disconnected!');
        log('========================');

        //restart scanning if scanning stopped
        if(noble.status == nobleStatus.STATUS_IDLE) {
            noble.startScanning(serviceUUIDs, true);
        }

        return;
    });
}

function issueCommand(peripheral, loopdCharacteristic) {
    var index = peripheral.advertisement.localName + peripheral.address;

    if (badgeCommands[index]) {
        SocketManager.broadcast('currentStatus', {
            // 'status': "Issuing command " + badgeCommands[index].toString('hex') + " for badge " + peripheral.advertisement.localName
            'status': "Blinking badge " + peripheral.advertisement.localName
        });

        loopdCharacteristic.write(badgeCommands[index], true);
        loopdCharacteristic.on('write', function(error) {
            commandEnd = new Date().getTime() / 1000;
            var commandDuration = commandEnd - commandStart;

            peripheral.status = peripheralStatus.STATUS_COMMANDED;

            SocketManager.broadcast('currentStatus', {
                'status': "Successfully issued command " + badgeCommands[index].toString('hex') + " for badge " + peripheral.advertisement.localName + " (" + commandDuration.toFixed(2) + " s)"
            });

            SocketManager.broadcast('badgeCommand', {
                'badge': {
                    'identity': peripheral.advertisement.localName,
                    'macAddress': peripheral.address
                }
            });

            clearTimeout(timeouts.command);
            clearTimeout(timeouts.connection);
            loopdCharacteristic.write(new Buffer([0x11]), true);
        });

        loopdCharacteristic.notify(true, function(error) {
            logger.info('set characteristic notify to true');
        });

        loopdCharacteristic.on('notify', function(state) {
            logger.info('notifying: ' + state);
        });

        loopdCharacteristic.on('data', function(data, isNotification) {
            logger.info("notified raw data: ", data);
            // logger.info("notified data: " + data.toString('utf8').replace(/[^ -~]+/g, ""));

            // SocketManager.broadcast('alert', {
            //     'message': "Alerted message from badge " + peripheral.advertisement.localName + ": " + data.toString('hex')
            // });
        });
    } else {
        //for some reason our command isn't defined so we disconnect and issue error message
        loopdCharacteristic.write(new Buffer([0x11]), true);

        SocketManager.broadcast('alert', {
            'message': "Something went wrong with badge " + peripheral.advertisement.localName
        });
    }
}

function syncBadge(peripheral, loopdCharacteristic) {
    SocketManager.broadcast('currentStatus', {
        'status': "Syncing badge " + peripheral.advertisement.localName
    });

    loopdCharacteristic.write(new Buffer([0xd5]), true); //setting to in-event mode
    loopdCharacteristic.write(new Buffer([0x07]), true); //clearing contacts
    loopdCharacteristic.write(new Buffer([0xf7, 0x03, 0x03]), true); //blinking the LEDs
    availablePeripherals.removePeripheral(peripheral);
    allocatedPeripherals.del(peripheral.address);

    loopdCharacteristic.on('data', function(data, isNotification) {
        var testData = new Buffer([0xc8, 0xd5]);

        if (data[1] == 0xd5) {
            logger.info("notified raw data: ", data);
            logger.info("notified data: " + data.toString('utf8').replace(/[^ -~]+/g, ""));
            SocketManager.broadcast('badgeSync', {
                'identity': peripheral.advertisement.localName,
                'macAddress': peripheral.address
            });

            clearTimeout(timeouts.sync);
            clearTimeout(timeouts.connection);

            var badge = new LoopdBadge(peripheral);
            badge.syncTime = new Date();
            syncEnd = new Date().getTime() / 1000.0;
            var syncDuration = syncEnd - syncStart;

            //do one last check to see if syncingAttendee is defined
            if (syncingAttendee) {
                var uploadStart = new Date().getTime() / 1000;
                SocketManager.broadcast('currentStatus', {
                    'status': "Uploading data for attendee: " + syncingAttendee.firstname
                });

                LoopdBadge.syncToAttendee(syncingAttendee, peripheral)
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
                            logger.error(error);
                        });

                        existingBadges[badge.identity + badge.macAddress] = badge;
                    });
            }

            peripheral.status = peripheralStatus.STATUS_SYNCED;
            delete badgesWaitingToSync[badge.idMac];
            loopdCharacteristic.write(new Buffer([0x11]), true);
        }
    });
}

function unsyncBadge(peripheral, loopdCharacteristic) {
    loopdCharacteristic.write(new Buffer([0xd2]), true); //setting to in-event mode
    loopdCharacteristic.write(new Buffer([0xa008]), true); //clearing contacts

    loopdCharacteristic.on('data', function(data, isNotification) {
        var testData = new Buffer([0xc8, 0xd5]);
        if (data[1] == 0xd2) {
            logger.info('peripheral successfully unsynced');
            loopdCharacteristic.write(new Buffer([0x11]), true);
        }
    });
}

function allocateBadge(peripheral, loopdCharacteristic) {
    peripheral.status = peripheralStatus.STATUS_ALLOCATED;
    loopdCharacteristic.write(new Buffer([0xa0, 0x08]), true);
    loopdCharacteristic.write(new Buffer([0x11]), true);
    logger.info('allocated peripherals', allocatedPeripherals.length);

    loopdCharacteristic.on('data', function(data, isNotification) {
        logger.info("notified raw data: ", data);
        // logger.info("notified data: " + data.toString('utf8').replace(/[^ -~]+/g, ""));
        if (data[1] == 0xa0) {
            allocatedPeripherals.set(peripheral.address, peripheral);
            logger.info(peripheral.advertisement.localName + ' allocated!');
        }
    });
}

/*----------  GENERAL METHODS  ----------*/
var log = function(message) {
    logger.info(message);
}

function updateCurrentBadges() {
    // log('updating available badges');
    allocatedPeripherals.prune();

    SocketManager.broadcast('currentBadges', {
        currentBadges: [],
        currentAvailableBadges: [],
        availablePeripheralsCount: availablePeripherals.length,
        allocatedPeripheralsCount: allocatedPeripherals.length
    });

    currentBadges = [];
    currentAvailableBadges = [];

    timeouts.updateBadgeCount = setTimeout(function() {
        updateCurrentBadges();
    }, timeoutDurations.updateCurrentBadges * 1000);
}
