angular.module('HubApp')
	.factory('attendeeService', function($rootScope, $q, $http, utilService, socketService, config) {
		var attendeeService = {};
		var socket = socketService.socket;

		attendeeService.currentSyncingAttendee = null;
		attendeeService.existingAttendeeBadges = {};

		/**
		 * Description: get check-in records based on current event and check-in service
		 * 
		 * @param  {Number} eventId        , the event id
		 * @param  {String} checkInService , the check-in service name
		 * @param  {Number} workerId       , the check-in worker id (optional)
		 * @return {Array}                 , an array of check-in records
		 */
		var getCheckInRecords = function(eventId, checkInService, workerId) {
			var deferred = $q.defer();
			var url = config.baseUrl + '/checkins/providers/'+ checkInService;
			if (workerId) {
				url += '/workers/'+workerId;
			}
			$http({
				method: 'GET',
				url: url,
				params: {
					"eventId": eventId,
					"fromTime": "0"
				}
			}).then(function(res) {
				deferred.resolve(res.data);
			});
			return deferred.promise;
		};

		var getOnsiteWalkups = function(eventId, sinceTime) {
			var deferred = $q.defer();
			var url = config.baseUrl + '/onsite/attendees';
			$http({
				method: 'GET',
				url: url,
				params: {
					eventId: eventId,
					isCheckIn: 'false',
					registerFromTime: sinceTime
				}
			}).then(function(res) {
				deferred.resolve(res.data);
			});
			return deferred.promise;
		};

		var getOnsiteCheckIns = function(eventId, checkInWorker, sinceTime) {
			var deferred = $q.defer();
			var url = config.baseUrl + '/onsite/attendees';
			$http({
				method: 'GET',
				url: url,
				params: {
					eventId: eventId,
					isCheckIn: 'true',
					checkInWorker: checkInWorker,
					checkInFromTime: sinceTime ? sinceTime : 0
				}
			}).then(function(res) {
				deferred.resolve(res.data);
			});
			return deferred.promise;
		};

		var getCheckIns = function(eventId, workerId, keyword) {
			var deferred = $q.defer();
			var url = config.baseUrl + '/checkins/providers/boomset/workers/' + workerId;
			$http({
				method: 'GET',
				url: url,
				params: {
					"eventId": eventId,
					"fromTime": "0"
				}
			}).
			then(function(res) {
				deferred.resolve(res.data);
			}, function(data, status, headers, config) {
				// console.log(data.meta);
			});

			return deferred.promise;
		}

		var searchCheckIns = function(eventId, keyword) {
			var deferred = $q.defer();
			var url = config.baseUrl + '/checkins/search';
			console.log(url);
			$http({
				method: 'GET',
				url: url,
				params: {
					"eventId": eventId,
					"q": keyword
				}
			}).
			then(function(res) {
				deferred.resolve(res);
			}, function(data, status, headers, config) {
				// console.log(data.meta);
			});

			return deferred.promise;
		}

		var getAttendeesForEvent = function(eventId) {
			var deferred = $q.defer();

			$http({
				method: 'GET',
				url: config.baseUrl + '/events/' + eventId + '/eventattendees',
				headers: {
					'Loopd-Admin-Key': config.authToken
				},
				params: {
					"requestFrom": "home",
					"requestFromId": "unknown"
				}
			}).
			then(function(res) {
				deferred.resolve(res.data);
			}, function(data, status, headers, config) {
				// console.log(data.meta);
			});

			return deferred.promise;
		}

		var getAttendeeByEmail = function(email) {
			var deferred = $q.defer();
			var url = config.baseUrl + '/checkins/search';
			console.log(url);
			$http({
				method: 'GET',
				url: url,
				params: {
					"eventId": eventId,
					"q": email
				}
			}).
			then(function(res) {
				deferred.resolve(res);
			}, function(data, status, headers, config) {
				// console.log(data.meta);
			});

			return deferred.promise;
		}

		var findAvailableBadgeForAttendee = function(attendee) {
			attendeeService.currentSyncingAttendee = attendee;

			$http({
				method: 'POST',
				url: '/sync-one',
				headers: {
					'Content-Type': 'application/json'
				},
				data: {
					currentAttendee: attendee,
					rssiThreshold: $scope.rssiThreshold
				}
			}).
			success(function(data, status, headers, config) {

			}).
			error(function(data, status, headers, config) {
				console.error(data);
			});
		}

		var findCheckInForAttendee = function(attendee, checkIns) {
			for (var x = 0; x <= checkIns.length; x++) {
				if (checkIns[x].eventAttendee.id == attendee.id) {
					return checkIns[x];
				}
			}

			return null;
		}

		var setCurrentEvent = function(eventId) {
			var deferred = $q.defer();

			$http({
				method: 'POST',
				url: '/current-event',
				headers: {
					'Content-Type': 'application/json'
				},
				data: {
					eventId: eventId,
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

		/*----------  EXPORT DECLARTIONS  ----------*/
		attendeeService.getOnsiteCheckIns = getOnsiteCheckIns;
		attendeeService.getOnsiteWalkups = getOnsiteWalkups;
		attendeeService.getBoomsetCheckIns = getBoomsetCheckIns;
		attendeeService.getCheckInRecords = getCheckInRecords;
		attendeeService.findCheckInForAttendee = findCheckInForAttendee;
		attendeeService.searchBoomsetCheckIns = searchBoomsetCheckIns;
		attendeeService.getAttendeesForEvent = getAttendeesForEvent;
		attendeeService.setCurrentEvent = setCurrentEvent;
		attendeeService.getAttendeeByEmail = getAttendeeByEmail;
		
		return attendeeService;
	});