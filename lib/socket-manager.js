var server = require('../server').server;
var io = require('socket.io')(server);
var logger = require('loopd-logger').logger;

console.log('server', server);
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