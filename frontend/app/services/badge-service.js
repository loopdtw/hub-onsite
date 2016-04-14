angular.module('HubApp')
	.factory('badgeService', function($rootScope, $q, $http, utilService, socketService, attendeeService, config) {
		var badgeService = {};
		var socket = socketService.socket;

		/*----------  VAR DECLARATIONS  ----------*/

		badgeService.currentStatus = 'Waiting for command...';
		badgeService.seenBadgesCount = 0;
		badgeService.currentBadges = [];
		badgeService.currentAvailableBadges = [];
		badgeService.seenBadges = {};
		badgeService.attendeesWaitingToSync = {};
		badgeService.badgesWaitingForCommand = {};
		badgeService.existingAttendeeBadges = {};
		badgeService.rssiThreshold = "...";
		badgeService.isScanning = false;
		badgeService.bulkCommanding = false;

		//peripheral counts
		badgeService.availablePeripheralsCount = 0;
		badgeService.allocatedPeripheralsCount = 0;

		/*----------  FUNC DECLARATIONS  ----------*/

		//resets the count of seenbadges
		var reset = function() {
			var deferred = $q.defer();

			$http({
				method: 'POST',
				url: '/reset',
				headers: {
					'Content-Type': 'application/json'
				}
			}).
			success(function(data, status, headers, config) {
				badgeService.seenBadges = {};
				deferred.resolve(data);
			}).
			error(function(data, status, headers, config) {
				deferred.reject(data);
			});

			return deferred.promise;
		}

		//toggles allocation of badges where speed is increased if nearby
		var allocate = function() {
			var deferred = $q.defer();

			$http({
				method: 'GET',
				url: '/allocate',
				headers: {
					'Content-Type': 'application/json'
				}
			}).
			success(function(data, status, headers, config) {
				deferred.resolve(data);
			}).
			error(function(data, status, headers, config) {
				deferred.reject(data);
			});

			return deferred.promise;
		}

		var scanForInterval = function(scanTime, detectDuplicates) {
			var deferred = $q.defer();

			$http({
				method: 'POST',
				url: '/scan',
				headers: {
					'Content-Type': 'application/json'
				},
				data: {
					scanTime: scanTime,
					detectDuplicates: detectDuplicates
				}
			}).
			success(function(data, status, headers, config) {
				deferred.resolve(data);
			}).
			error(function(data, status, headers, config) {
				deferred.reject(data);
			});

			return deferred.promise;
		}

		var scanForAvailable = function(scanTime) {
			var deferred = $q.defer();

			$http({
				method: 'POST',
				url: '/scan',
				headers: {
					'Content-Type': 'application/json'
				},
				data: {
					scanTime: scanTime,
					onlyAvailable: true
				}
			}).
			success(function(data, status, headers, config) {
				deferred.resolve(data);
			}).
			error(function(data, status, headers, config) {
				deferred.reject(data);
			});

			return deferred.promise;
		}

		//sends a designated command to the badge
		var sendCommand = function(badge, command) {
			var uniqueId = badge.identity + badge.macAddress;
			var deferred = $q.defer();

			$http({
				method: 'POST',
				url: '/command-badge',
				headers: {
					'Content-Type': 'application/json'
				},
				data: {
					badge: badge,
					badgeCommand: command
				}
			}).
			success(function(data, status, headers, config) {
				deferred.resolve(data);
			}).
			error(function(data, status, headers, config) {
				delete badgeService.badgesWaitingForCommand[uniqueId];
				deferred.reject(data);
			});

			return deferred.promise;
		}

		//sends a designated command to the badge
		var sendBulkCommand = function(state, command) {
			var deferred = $q.defer();

			$http({
				method: 'POST',
				url: '/bulk-command',
				headers: {
					'Content-Type': 'application/json'
				},
				data: {
					state: state,
					bulkBadgeCommand: command
				}
			}).
			success(function(data, status, headers, config) {
				badgeService.bulkCommanding = true;
				deferred.resolve(data);
			}).
			error(function(data, status, headers, config) {
				deferred.reject(data);
			});

			return deferred.promise;
		}

		var cancelBulkCommand = function() {
			var deferred = $q.defer();

			$http({
				method: 'POST',
				url: '/cancel-bulk-command',
				headers: {
					'Content-Type': 'application/json'
				}
			}).
			success(function(data, status, headers, config) {
				badgeService.bulkCommanding = false;
				deferred.resolve(data);
			}).
			error(function(data, status, headers, config) {
				deferred.reject(data);
			});

			return deferred.promise;
		}

		//tells the backend to communicate with the server to tie the badge id to attendee
		var syncBadge = function(attendee) {
			var deferred = $q.defer();

			$http({
				method: 'POST',
				url: '/sync-badge',
				headers: {
					'Content-Type': 'application/json'
				},
				data: {
					attendee: attendee
				}
			}).
			success(function(data, status, headers, config) {
				deferred.resolve(data);
			}).
			error(function(data, status, headers, config) {
				delete badgeService.badgesWaitingForCommand[attendee.id];
				deferred.reject(data);
			});

			return deferred.promise;
		}

		//sets the rssi threshold in which commands/synchronizations can be sent
		var setRssiThreshold = function(value) {
			var deferred = $q.defer();

			$http({
				method: 'POST',
				url: '/set-rssi',
				headers: {
					'Content-Type': 'application/json'
				},
				data: {
					rssiThreshold: $scope.rssiThreshold
				}
			}).
			success(function(data, status, headers, config) {
				deferred.resolve(data);
			}).
			error(function(data, status, headers, config) {
				deferred.reject(data);
				console.error(data);
			});

			return deferred.promise;
		}

		//takes in an object with idMac as unique key with value as badge object
		var updateExistingAttendeeBadges = function(existingAttendeeBadges) {
			var deferred = $q.defer();
			badgeService.existingAttendeeBadges = existingAttendeeBadges;

			$http({
				method: 'POST',
				url: '/update-existing-badges',
				headers: {
					'Content-Type': 'application/json'
				},
				data: {
					existingBadges: badgeService.existingAttendeeBadges,
				}
			}).
			success(function(data, status, headers, config) {
				deferred.resolve(data);
			}).
			error(function(data, status, headers, config) {
				deferred.reject(data);
				console.error(data);
			});

			return deferred.promise;
		}

		//removes the relationship between the attendee and badge
		var unsyncBadge = function(attendee, badge) {
			var deferred = $q.defer();
			var baseConfig = config;

			$http({
				method: 'POST',
				url: '/unsync-badge',
				headers: {
					'Content-Type': 'application/json'
				},
				data: {
					badge: badge
				}
			}).
			success(function(data) {
				$http({
					method: 'DELETE',
					url: config.baseUrl + '/Events/' + attendee.eventId + '/badges/' + badge.identity,
					headers: {
						'Loopd-Admin-Key': config.authToken
					},
					params: {
						"source": "WEB_E",
						"sourceId": "WE:WE:WE",
						"isReturned": true
					}
				}).
				success(function(data, status, headers, config) {
					attendee.badgeIdentity = null;
					deferred.resolve(data);
				}).
				error(function(data, status, headers, config) {
					deferred.reject(data);
				});

			}).
			error(function(data, status, headers, config) {
				deferred.reject();
			});

			return deferred.promise;
		}

		var setRssiThreshold = function(rssiThreshold) {
			var deferred = $q.defer();

			$http({
				method: 'POST',
				url: '/rssi-threshold',
				headers: {
					'Content-Type': 'application/json'
				},
				data: {
					rssiThreshold: rssiThreshold,
				}
			}).
			success(function(data, status, headers, config) {
				deferred.resolve();
			}).
			error(function(data, status, headers, config) {
				deferred.reject();
			});

			return deferred.promise;
		}

		/*----------  SOCKET LISTENERS  ----------*/

		socket.on('currentStatus', function(data) {
			badgeService.currentStatus = data.status.toString();
			console.log(data.status.toString());
			$rootScope.$broadcast('currentStatus');
		});

		socket.on('alert', function(data) {
			alert(data.message);
		});

		socket.on('logMessage', function(data) {
			console.log('%c (' + new Date().toLocaleTimeString() + ') ' + data.log, 'color: #009afd');
		});

		socket.on('currentBadges', function(data) {
			badgeService.currentBadges = data.currentBadges;
			badgeService.currentAvailableBadges = data.currentAvailableBadges;
			badgeService.allocatedPeripheralsCount = data.allocatedPeripheralsCount;
			badgeService.availablePeripheralsCount = data.availablePeripheralsCount;
			$rootScope.$broadcast('currentBadges');
		});

		socket.on('badgeCommand', function(data) {
			var uniqueId = data.badge.identity + data.badge.macAddress;
			delete badgeService.badgesWaitingForCommand[uniqueId];
		});

		socket.on('badgeConnected', function(data) {
			if (data.connected == true) {
				$scope.$apply($scope.badgeConnected = true);
			} else {
				$scope.$apply($scope.badgeConnected = false);
			}
		});

		socket.on('badgeSynced', function(data) {
			$rootScope.$broadcast('badgeSynced', {
				attendee: data.attendee,
				badge: data.badge
			});
		});

		socket.on('badgeDisconnect', function(data) {
			console.log('badge disconnect called!');
			$rootScope.$broadcast('badgeDisconnect');
		});

		socket.on('badgeNotFound', function(data) {
			alert(data.message);
			$rootScope.$broadcast('badgeNotFound');
		});

		socket.on('bulkCommandComplete', function() {
			badgeService.bulkCommanding = false;
			$rootScope.$broadcast('bulkCommandComplete');
		});

		socket.on('connect', function() {
			console.log("socket connection");
		});

		socket.on('disconnect', function() {
			console.log('socket disconnection!');
			socket.connect();
		});

		/*----------  EXPORT DECLARATIONS  ----------*/
		badgeService.reset = reset;
		badgeService.sendCommand = sendCommand;
		badgeService.sendBulkCommand = sendBulkCommand;
		badgeService.syncBadge = syncBadge;
		badgeService.unsyncBadge = unsyncBadge;
		badgeService.updateExistingAttendeeBadges = updateExistingAttendeeBadges;
		badgeService.allocate = allocate;
		badgeService.scanForInterval = scanForInterval;
		badgeService.setRssiThreshold = setRssiThreshold;

		return badgeService;
	});