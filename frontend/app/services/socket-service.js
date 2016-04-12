angular.module('HubApp')
	.factory('socketService', function() {
		var socket = io.connect();
		return {
			socket: socket
		}
	});