var cluster = require('cluster');
var logger = require('../logger').getLogger();
var softwareManager = require('./software-manager');
var cloudLogging = require('./cloud-logging');
var bleWatcher = require('./ble-watcher');
var wifiWatcher = require('./wifi-watcher');
var WorkersData = {};

// To count how many times the workers can be respawn   
var respawnTimer = null;

var MAX_RESPAWN_TIMES = 5;
var CURRENT_RESPAWN_TIMES = 0;
var RESET_RESPAWN_TIMER_IN_MSECOND = 3 * 60 * 1000;
var CHECK_SYSTEM_STATUS_IN_MSECOND = 5 * 1000;
var IDLE_TIMEOUT_IN_MSECOND = 10000; // 10 seconds

exports.initWorker = function() {
	var worker = cluster.fork();
    WorkersData[worker.id] = {
        status: {},
        idleTimeout: null
    };
    
    worker.on('message', function(msg) {
        if (!exports.isMsgSupported(msg)) {
            return logger.warn('Not suppported messages sent from worker', msg);
        }
        exports.updateWorker(worker.id, msg.data);
        // check and upgrade hub software if needed 
        // if (WorkersData[worker.id].status.softwareUpgrade) {
        softwareManager.upgrade();
        // }
        // check and enable cloud logging if needed 
        return WorkersData[worker.id].status.cloudLogging ?
            cloudLogging.start():
            cloudLogging.stop();
    });

	cluster.on('exit', function (worker, code, signal) {
	    logger.warn('worker ' + worker.process.pid + ' died');	    
	    logger.warn('=================respawnWorker===================');
	    exports.initWorker();
	    clearTimeout(respawnTimer);
	    CURRENT_RESPAWN_TIMES++;
	    if(process.env.NODE_MACHINE === 'edison' && CURRENT_RESPAWN_TIMES >= MAX_RESPAWN_TIMES) {
	        logger.error('BLE Device is currently unavailable, reboot edison now');
	        return exec('reboot');
	    }
	    respawnTimer = setTimeout(function() {
	        CURRENT_RESPAWN_TIMES = 0;
	    }, RESET_RESPAWN_TIMER_IN_MSECOND);
	});
	 
	if(process.env.NODE_MACHINE === 'edison') {
	    bleWatcher.start();
	    wifiWatcher.start();
	    setInterval(function() {
	        var bleStatus = bleWatcher.getStatus().scanning ? 'scanning' : 'idle';
	        var wifiStatus = wifiWatcher.getStatus().connected ? 'connected' : 'disconnected';
	        logger.info('======== BLE is: [%s], Internet is: [%s] ========', bleStatus, wifiStatus);
	    }, CHECK_SYSTEM_STATUS_IN_MSECOND);
	}
};

exports.isInited = function(workerId) {
    return !!WorkersData[workerId];
};

exports.isMsgSupported = function(msg) {
    return (msg.type === 'status');
};

exports.destroy = function(workerId) {
    cluster.workers[workerId].kill();
    delete WorkersData[workerId];
};

exports.destroyAll = function() {
    Object.keys(cluster.workers).forEach(function(workerId) {
        exports.destroy(workerId);
    });
}

exports.updateWorker = function(workerId, data) {
    WorkersData[workerId].status = data;
};

exports.clearWorkerTimeout = function() {
    if (exports.isInited(workerId)) {
        clearTimeout(WorkersData[workerId].idleTimeout);
    }
};
