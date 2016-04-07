angular.module('HubApp')
	.factory('settingsService', function($http, $q) {
		var settingsService = {};

		var setRSSI = function() {
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
				console.log(data);
			}).
			error(function(data, status, headers, config) {
				deferred.reject(data);
				console.error(data);
			});

			return deferred.promise;
		}

		var setCurrentEvent = function() {
			var deferred = $q.defer();

			$http({
				method: 'POST',
				url: '/current-event',
				headers: {
					'Content-Type': 'application/json'
				},
				data: {
					currentEvent: $scope.currentEvent,
				}
			}).
			success(function(data, status, headers, config) {
				deferred.resolve(data);
				console.log(data);
			}).
			error(function(data, status, headers, config) {
				deferred.reject(data);
				console.error(data);
			});

			return deferred.promise;
		}

		var getInitialData = function() {
			var deferred = $q.defer();
			$http({
					method: 'GET',
					url: '/initial-data'
				})
				.then(function(res) {
					deferred.resolve(res.data);
				})
				.catch(function(err) {
					deferred.reject(err);
				});

			return deferred.promise;
		}

		settingsService.getInitialData = getInitialData;

		return settingsService;
	});