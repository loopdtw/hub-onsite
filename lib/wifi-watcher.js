var logger = require('../logger').getLogger();
var exec = require('child_process').exec;
var workerManager = require('./worker-manager');

// For edison device, we also apply another monitor mechanism
var MAX_RESET_TIMES = 5;
var CURRENT_RESET_TIMES = 0;
var CHECK_PERIOD_IN_MSECOND = 2000;

var MAX_WIFI_IDLE_TIMES = 10;
var CURRENT_WIFI_IDLE_TIMES = 0;

var watchTimer = null;
var wifiStatus = {
    connected: false
};

exports.start = function () {
    watchWifi();
};

exports.stop = function () {
    clearTimeout(watchTimer);
};

exports.getStatus = function() {
    return wifiStatus;
};

function watchWifi() {
    if (CURRENT_WIFI_IDLE_TIMES >= MAX_WIFI_IDLE_TIMES) {
        CURRENT_WIFI_IDLE_TIMES = 0;
        watchTimer = setTimeout(watchWifi, CHECK_PERIOD_IN_MSECOND * 2);
        return resetWifi();
    }
    exec('ping -c 5 -w 10000 google.com | grep bytes', function (error, stdout, stderror) {
        // trigger next watch time
        watchTimer = setTimeout(watchWifi, CHECK_PERIOD_IN_MSECOND);

        if (error) {
            wifiStatus.connected = false;
            CURRENT_WIFI_IDLE_TIMES++;
            return logger.error('Error in watchWifi', error);
        }
        if (stdout === '') {
            wifiStatus.connected = false;
            CURRENT_WIFI_IDLE_TIMES++;
            return logger.warn('Internet connection is temporarily unavailable');
        }
        wifiStatus.connected = true;
        CURRENT_WIFI_IDLE_TIMES = 0;
    });
}

function resetWifi() {
    logger.warn('========Trying to reset wifi interface !!!========');
    if (CURRENT_RESET_TIMES >= MAX_RESET_TIMES) {
        logger.error('Internect connection is unavailable for a period of time, reboot edison now');
        exec('reboot', function (error) {
            if (error) logger.error('Error in reboot edison for internect connection', error);
        });
    }
    exec('ifconfig wlan0 down; sleep 2; ifconfig wlan0 up; wpa_cli reconfig', function (error) {
        logger.warn('Current wifi reset is done!');
        if (error) logger.error('Error in resetWifi', error);
        CURRENT_RESET_TIMES++;
    });
}