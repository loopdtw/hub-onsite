var logger = require('../logger').getLogger();
var exec = require('child_process').exec;
var workerManager = require('./worker-manager');
// For edison device, we also apply another monitor mechanism
var CHECK_PERIOD_IN_MSECOND = 1300;
var MAX_BLE_IDLE_TIMES = 10;
var CURRENT_BLE_IDLE_TIMES = 0;

var lastRxValue = '';
var watchTimer = null;

var BleStatus = {
    scanning: false
};

exports.start = function () {
    watchBle();
};

exports.stop = function () {
    clearTimeout(watchTimer);
};

exports.getStatus = function() {
    return BleStatus;
};

function watchBle() {
    if (CURRENT_BLE_IDLE_TIMES >= MAX_BLE_IDLE_TIMES) {
        CURRENT_BLE_IDLE_TIMES = 0;
        workerManager.destroyAll();
        watchTimer = setTimeout(watchBle, CHECK_PERIOD_IN_MSECOND * 2);
        return resetBle();
    }
    exec('hciconfig', function (error, stdout, stderror) {
        // trigger next watch time
        watchTimer = setTimeout(watchBle, CHECK_PERIOD_IN_MSECOND);

        var rxString = 'RX bytes:';
        var strIdx = stdout.search(rxString);
        var rxValue = '';
        if (error) {
            BleStatus.scanning = false;
            CURRENT_BLE_IDLE_TIMES++;
            return logger.error('Error in watchBle', error);
        }
        if (strIdx === -1) {
            BleStatus.scanning = false;
            CURRENT_BLE_IDLE_TIMES++;
            return logger.error('Fail to get BLE related information');
        }
        for (var i = strIdx + rxString.length;; i++) {
            if (stdout[i] === ' ') break;
            rxValue += stdout[i];
        }
        BleStatus.scanning = (lastRxValue !== rxValue);
        if (BleStatus.scanning) {
            lastRxValue = rxValue;
            CURRENT_BLE_IDLE_TIMES = 0;
            logger.debug('worker is in scanning mode');
        } else {
            logger.warn('worker is currently not scanning devices!');
            CURRENT_BLE_IDLE_TIMES++;
        }
    });
}

function resetBle() {
    logger.warn('========Trying to reset BLE interface !!!========');
    var cmd = 'rfkill block bluetooth; hciconfig hci0 down;' +
        'rfkill unblock bluetooth; sleep 2; hciconfig hci0 up'; 
    exec(cmd, function (error) {
        logger.warn('Current BLE reset is done!');
        if (error) logger.error('Error in resetBle', error);
    });
}