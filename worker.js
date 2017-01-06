var fs = require('fs');
var path = require('path');
var appDir = path.dirname(require.main.filename);
var exec = require('child_process').exec;
var logger = require('./logger').getLogger();
var syncManager = require('./lib/sync-manager');

BADGE_SERVICE_UUID = "fb694b90f49e45978306171bba78f846";

var workerStatus = {
	state: 'inactive',
	cloudLogging: false,
	softwareUpgrade: true
};

syncManager.init();

syncManager.eventManager.on('state', function(data) {
	workerStatus.state = data.state;
	sendWorkerStatus();
});

syncManager.eventManager.on('meta', function(data) {
	workerStatus.cloudLogging = data.cloudLogging;
	workerStatus.softwareUpgrade = data.softwareUpgrade;
	sendWorkerStatus();
});

function sendWorkerStatus(status) {
	process.send({
		type: 'status',
		data: workerStatus
	});
}
