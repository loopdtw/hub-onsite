angular.module('HubApp')
	.controller('DuplicatesController', function($scope, $http, $interval, $q, badgeService, utilService, config) {
		var socket = io.connect();

		/*----------  VAR DECLARATIONS  ----------*/

		var predicate = null;
		var reverse = false;

		var idBadges = {};
		var macBadges = {};
		$scope.repeatedIdBadges = {};
		$scope.repeatedMacBadges = {};


		/*----------  SCOPE VAR DECLARATIONS  ----------*/
		$scope.scanTime = 5;
		$scope.badgeCommands = {};
		$scope.sortedKeys = [];

		$scope.isScanning = badgeService.isScanning;
		$scope.currentStatus = badgeService.currentStatus;
		$scope.seenBadges = badgeService.seenBadges;
		$scope.seenBadgesCount = badgeService.seenBadgesCount;
		$scope.currentBadgesCount = badgeService.currentBadgesCount;

		/*----------  FUNCTION DECLARATIONS  ----------*/

		var order = function(item) {
			predicate = item;
			reverse = ~reverse;
			$scope.sortedKeys = utilService.getSortedArrayFromObject(predicate, badgeService.seenBadges, reverse);
		}

		var reset = function() {
			badgeService.reset();
			idBadges = {};
			macBadges = {};
			$scope.repeatedIdBadges = {};
			$scope.repeatedMacBadges = {};
			$scope.$apply();
		}

		var scanForInterval = function() {
			$scope.isScanning = true;
			badgeService.scanForInterval($scope.scanTime, true)
				.then(function(isScanning) {
					$scope.isScanning = false;
				});
		}

		var compileBadgesById = function() {
			for (var key in badgeService.seenBadges) {
				var badge = badgeService.seenBadges[key];

				//detecting duplicates by id
				if (typeof idBadges[badge.identity] !== 'undefined') {
					if (!utilService.arrayContains(badge.macAddress, idBadges[badge.identity].macAddresses)) {
						idBadges[badge.identity].macAddresses.push(badge.macAddress);
						$scope.repeatedIdBadges[badge.identity] = idBadges[badge.identity];
					}
				} else {
					idBadges[badge.identity] = {
						macAddresses: [badge.macAddress]
					}
				}

				//detecting duplicates by mac
				if (typeof macBadges[badge.macAddress] !== 'undefined') {
					if (!utilService.arrayContains(badge.identity, macBadges[badge.macAddress].identities)) {
						macBadges[badge.macAddress].identities.push(badge.identity);
						$scope.repeatedMacBadges[badge.macAddress] = macBadges[badge.macAddress];
					}
				} else {
					macBadges[badge.macAddress] = {
						identities: [badge.identity]
					}
				}
			}
		}

		/*----------  INIT DECLARATIONS  ----------*/

		function getInitialData() {
			var deferred = $q.defer();
			$http({
					method: 'GET',
					url: '/initial-data'
				})
				.then(function(res) {
					$scope.currentVersion = (res.data.currentVersion);
					deferred.resolve();
				})
				.catch(function(err) {
					deferred.reject(err);
				});

			return deferred.promise;
		}

		function init() {
			getInitialData()
				.then(function() {
					console.log('init complete');
				});
		}

		init();

		/*----------  EVENT LISTENTERS  ----------*/
		$scope.$on('currentBadges', function() {
			compileBadgesById();
			console.log($scope.repeatedIdBadges);
			console.log($scope.repeatedMacBadges);
			$scope.$apply();
		});

		/*----------  EXPORTED FUNCTIONS  ----------*/
		$scope.scanForInterval = scanForInterval;
		$scope.order = order;
		$scope.reset = reset;
	});