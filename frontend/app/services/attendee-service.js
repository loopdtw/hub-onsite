angular.module('HubApp')
	.factory('attendeeService', function($rootScope, $q, $http, utilService, socketService, config) {
		var attendeeService = {};
		var socket = socketService.socket;

		const ATTENDEE_LIMIT = 20;

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
			var url = config.baseUrl + '/checkins/providers/' + checkInService;
			if (workerId) {
				url += '/workers/' + workerId;
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
			var url = "";

			var deferred = $q.defer();
			var requestTime = new Date();

			if (workerId) {
				url = config.baseUrl + '/onsite/attendees?checkInWorker=' + workerId;
			} else {
				url = config.baseUrl + '/onsite/attendees';
			}

			$http({
				method: 'GET',
				url: url,
				params: {
					"eventId": eventId
				}
			}).
			then(function(res) {
				deferred.resolve(res.data, requestTime);
			}, function(data, status, headers, config) {
				// console.log(data.meta);
			});

			return deferred.promise;
		}

		var searchAttendees = function(eventId, keyword) {
			var deferred = $q.defer();
			var url = config.baseUrl + '/onsite/attendees/search';
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
			var requestTime = new Date();
			console.log('defined', requestTime);
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
				console.log('callback', requestTime);
				deferred.resolve(res.data, requestTime);
			}, function(data, status, headers, config) {
				// console.log(data.meta);
			});

			return deferred.promise;
		}

		var getAttendeeByEmail = function(eventId, email) {
			var deferred = $q.defer();
			var url = config.baseUrl + '/onsite/attendees/search';
			$http({
				method: 'GET',
				url: url,
				params: {
					"eventId": eventId,
					"q": email
				}
			}).
			then(function(res) {
				console.log(res);
				deferred.resolve(res.data);
			}, function(data, status, headers, config) {
				// console.log(data.meta);
			});

			return deferred.promise;
		}

		var getAttendeeForBadge = function(eventId, identity) {
			var deferred = $q.defer();
			var url = config.baseUrl + '/Events/' + eventId + '/eventattendees';
			console.log(url);
			$http({
				method: 'GET',
				url: url,
				headers: {
					'Loopd-Admin-Key': config.authToken
				},
				params: {
					"requestFrom": "WEB",
					"requestFromId": 123,
					"badge": identity
				}
			}).
			then(function(res) {
				if (res.data.length > 0) {
					deferred.resolve(res.data[0]);
				} else {
					deferred.resolve(null);
				}
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
			for (var x = 0; x < checkIns.length; x++) {
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

		var signupAttendee = function(eventId, attendee) {
			var deferred = $q.defer();

			var signupAttendee = {
				eventId: eventId,
				firstname: attendee.firstname,
				lastname: attendee.lastname,
				email: attendee.email,
				title: attendee.title,
				organization: attendee.organization,
				provider: attendee.provider,
				providerAttendeeId: attendee.providerAttendeeId,
				checkInWorker: attendee.checkInWorker
			};

			console.log(signupAttendee);

			$http({
				method: 'POST',
				url: '/signup',
				headers: {
					'Content-Type': 'application/json'
				},
				data: {
					attendee: signupAttendee
				}
			}).
			success(function(data, status, headers, config) {
				console.log(data);
				deferred.resolve(data);
			}).
			error(function(data, status, headers, config) {
				console.log(data);
				deferred.reject(data);
			});

			return deferred.promise;
		}

		/*----------  EXPORT DECLARTIONS  ----------*/
		attendeeService.getOnsiteCheckIns = getOnsiteCheckIns;
		attendeeService.getOnsiteWalkups = getOnsiteWalkups;
		attendeeService.getCheckIns = getCheckIns;
		attendeeService.getCheckInRecords = getCheckInRecords;
		attendeeService.findCheckInForAttendee = findCheckInForAttendee;
		attendeeService.searchAttendees = searchAttendees;
		attendeeService.getAttendeesForEvent = getAttendeesForEvent;
		attendeeService.setCurrentEvent = setCurrentEvent;
		attendeeService.getAttendeeByEmail = getAttendeeByEmail;
		attendeeService.getAttendeeForBadge = getAttendeeForBadge;
		attendeeService.signupAttendee = signupAttendee;

		return attendeeService;
	});