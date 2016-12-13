var Logger = require('../logger');
var spawn = require('child_process').spawn;
var loggingWorker = null;
var systemLogger = Logger.getLogger();


exports.start = function () {
    if (loggingWorker) return;
    systemLogger.warn('========Start Cloud Logging========');
    loggingWorker = spawn('journalctl', ['-f', '-n 500']);
    loggingWorker.stdout.on('data', function (data) {
        // use cloud logger to logging
        Logger.getCloudLogger().info(data.toString());
    });
    loggingWorker.on('close', function () {
        systemLogger.warn('========Cloud logging has stopped!========');
    });
};


exports.stop = function () {
    if (!loggingWorker) return;
    systemLogger.warn('========Stop Cloud Logging========');
    setTimeout(function() {
        loggingWorker.kill();
        loggingWorker = null;
    }, 1500);
};
