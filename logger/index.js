'use strict';
var execSync = require('child_process').execSync;
var bunyan = require('bunyan');
var bformat = require('bunyan-format');
var formatOut = bformat({
    outputMode: 'long'
});

var winston = require('winston');

//
// Requiring `winston-papertrail` will expose
// `winston.transports.Papertrail`
//
require('winston-papertrail').Papertrail;

bunyan.DISABLE = 70;

// get current receiver identity
var ReceiverIdentity = 'node-hub-client';
// if (process.env.NODE_MACHINE === 'edison') {
//     ReceiverIdentity = execSync('cat /factory/serial_number', {
//         encoding: 'utf8'
//     });
//     ReceiverIdentity = ReceiverIdentity.slice(0, ReceiverIdentity.length - 1);
// }

/**
 * Logger instance
 */
var logger = bunyan.createLogger({
    name: ReceiverIdentity,
    env: process.env.NODE_ENV || 'unknown',
    streams: [{
        level: process.env.LOG_LEVEL || 'info',
        stream: formatOut
    }]
});

// logging into allen's account on papertrail
var winstonPapertrail = new winston.transports.Papertrail({
    hostname: ReceiverIdentity,
    host: 'logs2.papertrailapp.com',
    port: 43913
});

winstonPapertrail.on('error', function (err) {
    logger.warn('Papertrail logging error:', err);
});

var cloudLogger = new winston.Logger({
    transports: [winstonPapertrail]
});

/**
 * Utils function
 */
exports.getLogger = function () {
    return logger;
};

exports.getCloudLogger = function () {
    return (cloudLogger && cloudLogger.info) ? cloudLogger : logger;
};
