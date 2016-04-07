angular.module('HubApp')
	.controller('PresyncController', function($scope, $http, $interval, $q, $timeout, badgeService, attendeeService, settingsService) {

		var existingBadges = [];
		var lightBadges = [];

		$scope.currentlyUnsyncing = false;
		$scope.currentBadges = [];

		$scope.currentEvent = null;
		$scope.eventLoading = true;
		$scope.timeThreshold = 2;
		$scope.currentAttendee = null;
		$scope.attendees = [];
		$scope.seenBadges = {};
		$scope.filterSeen = false;

		/*----------  Variables to control UI state (i.e. buttons)  ----------*/
		$scope.syncingAttendee = null;
		$scope.lightingAttendee = null;
		$scope.isCurrentlySyncing = false;

		/*----------  AUTOSYNC  ----------*/
		$scope.autoSync = false;
		$scope.countDownConstant = 5;
		$scope.countDownValue = 0;
		$scope.countDownTimer;

		$scope.syncedAttendees = [];
		$scope.unsyncedAttendees = [];

		/*----------  APPLIED METHODS  ----------*/

		function sortAttendees(attendees) {
			$scope.syncedAttendees = [];
			$scope.unsyncedAttendees = [];

			attendees.forEach(function(attendee) {
				attendee.eventId = $scope.currentEvent;

				if (attendee.badges.length == 0) {
					$scope.unsyncedAttendees.push(attendee);
				} else {
					var hasActiveBadge = false;
					attendee.badges.forEach(function(badge) {
						if (badge.isActive) {
							hasActiveBadge = true;
							attendee.currentBadge = badge;
						}
					});

					if (hasActiveBadge) {
						$scope.syncedAttendees.push(attendee);
					} else {
						$scope.unsyncedAttendees.push(attendee);
					}
				}
			});

			var existingAttendeeBadges = {};
			$scope.attendees.forEach(function(attendee) {
				if (attendee.currentBadge) {
					var uniqueId = attendee.currentBadge.identity + attendee.currentBadge.macAddress;
					existingAttendeeBadges[uniqueId] = attendee.currentBadge;
				}
			});
			badgeService.updateExistingAttendeeBadges(existingAttendeeBadges);

			$scope.currentAttendee = $scope.unsyncedAttendees[0];
		}

		function countDown() {
			$scope.countDownValue--;
			if ($scope.countDownValue > 0) {
				$scope.countDownTimer = $timeout(function() {
					countDown();
				}, 1000);
			} else {
				$scope.syncBadge($scope.currentAttendee);
			}
		}

		$scope.export = function() {
			var csvContent = "data:text/csv;charset=utf-8,";
			csvContent += "#, Event, Attendee Id, First Name, Last Name, Email, Sync Time (UTC), Badge, Sync Source, Badge Order\n";
			$scope.attendees.forEach(function(attendee, index) {
				console.log(attendee);
				csvContent += index + 1 + ",";
				csvContent += $scope.currentEvent + ",";
				csvContent += attendee.id + ",";
				csvContent += attendee.firstname + ",";
				csvContent += attendee.lastname + ",";
				csvContent += attendee.email + ",";

				if (attendee.badges.length > 0) {
					csvContent += attendee.currentBadge.syncTime + ",";
					csvContent += attendee.currentBadge.identity + ",";
					csvContent += attendee.currentBadge.syncSource + ",";
					csvContent += attendee.badgeOrder + ",";
				} else {
					csvContent += ",";
					csvContent += ",";
					csvContent += ",";
					csvContent += ",";
				}

				csvContent += "\n";
			});
			var encodedUri = encodeURI(csvContent);
			window.open(encodedUri);
		}

		$scope.predicate = 'id';
		$scope.reverse = false;
		$scope.order = function(predicate) {
			$scope.reverse = ($scope.predicate === predicate) ? !$scope.reverse : false;
			$scope.predicate = predicate;
		}

		$scope.setCurrentAttendee = function(attendee) {
			if (arrayContains(attendee, $scope.unsyncedAttendees)) {
				$scope.currentAttendee = attendee;
			}
		}

		$scope.setCurrentEvent = function() {
			attendeeService.setCurrentEvent($scope.currentEvent);
			init();
		}

		$scope.setRSSI = function() {
			badgeService.setRssiThreshold($scope.rssiThreshold);
		}

		$scope.toggleLastSeenFilter = function() {
			$scope.filterSeen = !$scope.filterSeen;
		}

		$scope.isSyncingAttendee = function(attendee) {
			return $scope.syncingAttendee === attendee;
		}

		$scope.sendCommand = function(attendee, command) {
			badgeService.sendCommand(attendee.currentBadge, command);
		}

		$scope.toggleAutoSync = function() {
			$scope.autoSync = !$scope.autoSync;
			$scope.countDownValue = $scope.countDownConstant;

			if ($scope.autoSync) {
				countDown();
			} else {
				$timeout.cancel($scope.countDownTimer)
					.then(function(canceled) {
						$scope.countDownValue = $scope.countDownConstant;
					});
			}
		}

		$scope.syncBadge = function(attendee) {
			$scope.isCurrentlySyncing = true;
			$scope.syncingAttendee = attendee;
			badgeService.syncBadge($scope.currentAttendee);
		}

		$scope.unsync = function(attendee) {
			if (!$scope.currentlyUnsyncing) {
				$scope.currentlyUnsyncing = true;
				badgeService.unsyncBadge(attendee, attendee.currentBadge)
					.then(function() {
						attendee.currentBadge.isActive = false;
						attendee.currentBadge = null;
						sortAttendees($scope.attendees);
						$scope.currentlyUnsyncing = false;
						$scope.$apply();
					});
			}
		}

		/*----------  INIT  ----------*/

		var init = function() {
			$scope.eventLoading = true;
			settingsService.getInitialData()
				.then(function(data) {
					$scope.currentEvent = data.currentEvent;
					$scope.rssiThreshold = data.rssiThreshold;
					$scope.currentVersion = data.currentVersion;
					$scope.rssiThreshold = data.rssiThreshold;
					return attendeeService.getAttendeesForEvent($scope.currentEvent);
				})
				.then(function(attendees) {
					$scope.attendees = attendees;
					sortAttendees($scope.attendees);
				})
				.finally(function() {
					$scope.currentStatus = badgeService.currentStatus;
					$scope.eventLoading = false;
				});
		}

		init();

		/*----------  EVENT LISTENERS  ----------*/

		$scope.$on('badgeSynced', function(event, args) {
			$scope.isCurrentlySyncing = false;
			$scope.attendees.forEach(function(attendee) {
				if (attendee.id == args.attendee.id) {
					args.badge.isActive = true;
					attendee.badges.push(args.badge);
					$scope.$apply(attendee.currentBadge = args.badge);
				}
			});

			sortAttendees($scope.attendees);

			if ($scope.autoSync) {
				$scope.countDownValue = $scope.countDownConstant;
				countDown();
			} else {
				$scope.syncingAttendee = null;
			}
		});

		$scope.$on('badgeDisconnect', function() {
			$scope.syncingAttendee = null;
			$scope.autoSync = false;
			$scope.isCurrentlySyncing = false;
			$scope.$apply();
		});

		$scope.$on('seenBadges', function() {
			$scope.$apply($scope.seenBadges = badgeService.seenBadges);
		});

		$scope.$on('currentStatus', function() {
			$scope.currentStatus = badgeService.currentStatus;
			$scope.$apply();
		});

		$scope.$on('currentBadges', function() {
			$scope.$apply($scope.currentBadges = badgeService.currentBadges);
		});

		$scope.$on('badgeNotFound', function() {
			$scope.syncingAttendee = null;
			$scope.autoSync = false;
			$scope.isCurrentlySyncing = false;
			$scope.$apply();
		});
	});