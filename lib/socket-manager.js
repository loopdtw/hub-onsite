var app = require('../app');
var server = require('../app').server;
var io = require('socket.io')(server);
var logger = require('loopd-logger').logger;

var serverSocket;

io.sockets.on('connection', function(socket) {
	logger.info('client connected!');
	serverSocket = socket;
});

var SocketManager = {
	broadcast: function(type, payload) {
		if (serverSocket) {
			serverSocket.emit(type, payload);
		}
	}
}

module.exports = SocketManager;