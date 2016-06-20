angular.module('HubApp')
	.factory('attendeeService', function($rootScope, $q, $http, utilService, socketService, config) {
		var attendeeService = {};
		var socket = socketService.socket;

		var ATTENDEE_LIMIT = 20;

		attendeeService.currentSyncingAttendee = null;
		attendeeService.existingAttendeeBadges = {};

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
					"eventId": eventId,
					"limit": ATTENDEE_LIMIT
				}
			}).
			then(function(res) {
				deferred.resolve({
					attendees: res.data,
					requestTime: requestTime
				});

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
				deferred.resolve(res.data);
			}, function(data, status, headers, config) {
				// console.log(data.meta);
			});

			return deferred.promise;
		}

		var getAttendeesForEvent = function(eventId) {
			console.log(config.baseUrl + '/events/' + eventId + '/eventattendees');
			var deferred = $q.defer();
			$http({
				method: 'GET',
				url: config.baseUrl + '/events/' + eventId + '/eventattendees',
				headers: {
					'Loopd-Admin-Key': config.authToken
				},
				params: {
					"limit": 3000,
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
		attendeeService.getCheckIns = getCheckIns;
		attendeeService.searchAttendees = searchAttendees;
		attendeeService.getAttendeesForEvent = getAttendeesForEvent;
		attendeeService.getAttendeeByEmail = getAttendeeByEmail;
		attendeeService.getAttendeeForBadge = getAttendeeForBadge;
		attendeeService.signupAttendee = signupAttendee;

		return attendeeService;
	});