var sockets = require('socket.io');
var logger = require('loopd-logger').logger;
var serverSocket;

function _handleConnection(socket) {
	logger.info('client connected!');
	serverSocket = socket;
}

exports.CURRENT_STATUS = 'currentStatus';
exports.CURRENT_BADGES = 'currentBadges';
exports.BADGE_DISCONNECT = 'badgeDisconnect';
exports.BADGE_ERROR = 'badgeSyncError';
exports.BADGE_BLINKED = 'badgeBlinked';

exports.init = function(server) {
	var io = sockets(server);
	io.sockets.on('connection', _handleConnection);
};

exports.broadcast = function(type, payload) {
	if (serverSocket) {
		serverSocket.emit(type, payload);
	}
};

exports.broadcastStatus(message) {
	if (serverSocket) {
		serverSocket.emit(exports.CURRENT_STATUS, {
			status: message
		});
	}
};
