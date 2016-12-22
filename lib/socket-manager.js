var io = require('socket.io');
var logger = require('loopd-logger').logger;
var serverSocket;

function _handleConnection(socket) {
	logger.info('client connected!');
	serverSocket = socket;
}

exports.init = function(server) {
	io(server);
	io.sockets.on('connection', _handleConnection);
};

exports.broadcast = function(type, payload) {
	if (serverSocket) {
		serverSocket.emit(type, payload);
	}
};
