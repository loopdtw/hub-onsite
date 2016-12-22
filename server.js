var express = require('express');
var app = require('express')();
var cors = require('cors');
var path = require('path');
var logger = require('loopd-logger').logger;
var bodyParser = require('body-parser');
var index = require('./routes/routes');
var syncManager = require('./lib/sync-manager');
var syncRoutes = syncManager.router;

BADGE_SERVICE_UUID = "fb694b90f49e45978306171bba78f846";

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, './frontend/_public')));
app.use(express.static(path.join(__dirname, './frontend/html')));
app.use('/', index);
app.disable('view cache');

var server = app.listen(3000, function() {
    var port = this.address().port;
    logger.info('Listening on port %s', port);
});

var io = require('socket.io')(server);
var serverSocket;

io.sockets.on('connection', function(socket) {
	logger.info('client connected!');
	serverSocket = socket;
});

var workerStatus = {
	state: 'inactive',
	cloudLogging: false,
	softwareUpgrade: false
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