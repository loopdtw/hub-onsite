angular.module('HubApp')
    .controller('onsiteController', function($scope, $http, $timeout, $q, utilService, socketService, badgeService, attendeeService, $location, $window) {

        /*----------  VAR DECLARATIONS  ----------*/

        var existingBadges = [];
        var allAttendees = [];
        var alert = new Audio('/audio/alert.mp3');

        var syncTimeout = null;
        var getAttendeesTimeout = null;

        /*----------  SCOPE VAR DECLARATIONS  ----------*/

        $scope.eventId = null;
        $scope.checkInWorker = null;
        $scope.currentAttendee = null;
        $scope.currentSyncedAttendee = null;
        $scope.currentlySyncing = false;
        $scope.currentlyUnsyncing = false;

        //checkin arrays
        $scope.unsyncedAttendees = [];
        $scope.syncedAttendees = [];

        //counts
        $scope.allocatedPeripheralsCount = 0;

        //menu
        $scope.checked = false;

        //url location
        $scope.location = $location;
        $scope.$watch('location.search()', function() {
            $scope.eventId = ($location.search()).eventId;
            $scope.checkInWorker = ($location.search()).checkInWorker;
        }, true);

        $scope.changeTarget = function(name) {
            $location.search('eventId', name);
            $location.search('checkInWorker', name);
        }

        /*----------  MENU  ----------*/
        var toggleMenu = function() {
            $scope.checked = !$scope.checked;
        }

        var goToCheckIn = function() {
            $window.location.href = '/?eventId=' + $scope.eventId + '&checkInWorker=' + $scope.checkInWorker
        }

        var goToSearch = function() {
            $window.location.href = '/search?eventId=' + $scope.eventId + '&checkInWorker=' + $scope.checkInWorker
        }

        var goToLookup = function() {
            $window.location.href = '/lookup?eventId=' + $scope.eventId + '&checkInWorker=' + $scope.checkInWorker
        }

        /*----------  FUNC DECLARATIONS  ----------*/
        var setCurrentAttendee = function(attendee) {
            if (!$scope.currentlySyncing) {
                if ($scope.currentAttendee) {
                    if ($scope.currentAttendee.id == attendee.id) {
                        $scope.currentAttendee = null;
                    } else {
                        $scope.currentAttendee = attendee;
                    }
                } else {
                    $scope.currentAttendee = attendee;
                }
            }
        }

        var setCurrentSyncedAttendee = function(attendee) {
            if (!$scope.currentlyUnsyncing) {
                if ($scope.currentSyncedAttendee) {
                    if ($scope.currentSyncedAttendee.id == attendee.id) {
                        $scope.currentSyncedAttendee = null;
                    } else {
                        $scope.currentSyncedAttendee = attendee;
                    }
                } else {
                    $scope.currentSyncedAttendee = attendee;
                }
            }
        }

        var processAttendees = function() {
            $scope.unsyncedAttendees = [];
            $scope.syncedAttendees = [];

            var allUnsyncedAttendees = [];
            var allSyncedAttendees = [];

            allAttendees.forEach(function(attendee) {
                if (!attendee.badge) {
                    allUnsyncedAttendees.push(attendee);
                } else {
                    allSyncedAttendees.push(attendee);
                }
            });

            $scope.unsyncedAttendees = (allUnsyncedAttendees.length > 3) ? allUnsyncedAttendees.slice(allUnsyncedAttendees.length - 3).reverse() : allUnsyncedAttendees.reverse();
            $scope.syncedAttendees = (allSyncedAttendees.length > 3) ? allSyncedAttendees.slice(allSyncedAttendees.length - 3).reverse() : allSyncedAttendees.reverse();
        }

        var removeBadgeForCheckIn = function(attendeeTemp) {
            allAttendees.forEach(function(attendee) {
                if (attendee.id == attendeeTemp.id) {
                    attendee.badge = null;
                }
            });
        }

        var addBadgeForCheckIn = function(attendeeTemp, badge) {
            allAttendees.forEach(function(attendee) {
                if (attendee.id == attendeeTemp.id) {
                    attendee.badge = badge;
                }
            });
        }

        var sendCommand = function(command) {
            if ($scope.currentSyncedAttendee.badge) {
                badgeService.sendCommand($scope.currentSyncedAttendee.badge, command);
            }
        }

        var sync = function() {
            var attendeeEmail = $scope.currentAttendee.email;

            if ($scope.currentAttendee && !$scope.currentlySyncing && badgeService.allocatedPeripheralsCount > 0) {
                $scope.currentlySyncing = true;
                badgeService.syncBadge($scope.currentAttendee);
            }

            setSyncTimeout(attendeeEmail);
        }

        var unsync = function() {
            if (!$scope.currentlyUnsyncing && $scope.currentSyncedAttendee && $scope.currentSyncedAttendee.badge) {
                $scope.currentlyUnsyncing = true;
                badgeService.unsyncBadge($scope.currentSyncedAttendee, $scope.currentSyncedAttendee.badge)
                    .then(function() {
                        removeBadgeForCheckIn($scope.currentSyncedAttendee);
                        processAttendees();

                        var existingAttendeeBadges = {};
                        allAttendees.forEach(function(attendee) {
                            if (attendee.badge) {
                                var uniqueId = attendee.badge.identity + attendee.badge.macAddress;
                                existingAttendeeBadges[uniqueId] = attendee.badge;
                            }
                        });
                        badgeService.updateExistingAttendeeBadges(existingAttendeeBadges);

                        $scope.currentSyncedAttendee = null;
                        $scope.currentlyUnsyncing = false;
                    });
            }
        }

        //we have sync timeout here to force the sync button to go back if we don't get a socket message that our badge has been synced
        var setSyncTimeout = function(attendeeEmail) {
            syncTimeout = $timeout(function() {
                console.log('timed out, looking for record!', $scope.eventId, attendeeEmail);
                attendeeService.getAttendeeByEmail($scope.eventId, attendeeEmail)
                    .then(function(attendees) {
                        var attendee = attendees[0];
                        if (attendee.badge) {
                            completeSync(attendee, attendee.badge);
                        } else {
                            setSyncTimeout();
                        }
                    });
            }, 3 * 1000);
        }

        var completeSync = function(attendeeTemp, badge) {
            $scope.unsyncedAttendees.forEach(function(attendee) {
                if (attendee.id == attendeeTemp.id) {
                    addBadgeForCheckIn(attendee, badge);
                    processAttendees();
                }
            });

            $scope.currentlySyncing = false;
            if ($scope.unsyncedAttendees.length > 0) {
                $scope.currentAttendee = $scope.unsyncedAttendees[0];
            } else {
                $scope.currentAttendee = null;
            }

            alert.play();
        }

        /*----------  INIT FUNCTION DECLARATIONS  ----------*/

        var getInitialData = function() {
            var deferred = $q.defer();
            $http({
                    method: 'GET',
                    url: '/initial-data'
                })
                .then(function(res) {
                    $scope.currentVersion = res.data.currentVersion;
                    $scope.allocationEnabled = res.data.allocationEnabled;
                    deferred.resolve();
                })
                .catch(function(err) {
                    deferred.reject(err);
                });

            return deferred.promise;
        }

        var getAttendeeCheckIns = function() {
            attendeeService.getCheckIns($scope.eventId, $scope.checkInWorker, "")
                .then(function(attendees) {
                    allAttendees = attendees;
                    processAttendees();
                })
                .finally(function() {
                    var existingAttendeeBadges = {};
                    allAttendees.forEach(function(attendee) {
                        if (attendee.badge) {
                            var uniqueId = attendee.badge.identity + attendee.badge.macAddress;
                            existingAttendeeBadges[uniqueId] = attendee.badge;
                        }
                    });
                    badgeService.updateExistingAttendeeBadges(existingAttendeeBadges);
                    $scope.currentStatus = badgeService.currentStatus;
                    console.log(new Date(), 'updated checkins');
                });

            getAttendeesTimeout = $timeout(function() {
                getAttendeeCheckIns();
            }, 2 * 1000);
        }

        var init = function() {
            $scope.eventLoading = true;
            getInitialData()
                .then(function() {
                    getAttendeeCheckIns();
                });
        }

        init();

        /*----------  EVENT LISTENERS  ----------*/

        $scope.$on('badgeSynced', function(event, args) {
            if (syncTimeout) {
                $timeout.cancel(syncTimeout);
            }

            completeSync(args.attendee, args.badge);
        });

        $scope.$on('badgeDisconnect', function() {
            $scope.currentlySyncing = false;
            $scope.$apply();
        });

        $scope.$on('currentStatus', function() {
            $scope.currentStatus = badgeService.currentStatus;
            $scope.$apply();
        });

        $scope.$on('currentBadges', function() {
            $scope.$apply($scope.allocatedPeripheralsCount = badgeService.allocatedPeripheralsCount);
        });

        /*----------  EXPORT DECLARATIONS  ----------*/
        $scope.setCurrentAttendee = setCurrentAttendee;
        $scope.setCurrentSyncedAttendee = setCurrentSyncedAttendee;
        $scope.sendCommand = sendCommand;
        $scope.toggleMenu = toggleMenu;
        $scope.sync = sync;
        $scope.unsync = unsync;
        $scope.goToSearch = goToSearch;
        $scope.goToCheckIn = goToCheckIn;
        $scope.goToLookup = goToLookup;
    });