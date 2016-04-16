angular.module('HubApp')
    .controller('onsiteController', function($scope, $http, $timeout, $q, utilService, socketService, badgeService, attendeeService, config, $location) {

        /*----------  VAR DECLARATIONS  ----------*/

        var existingBadges = [];
        var allCheckIns = [];
        var alert = new Audio('/audio/alert.mp3');

        var syncTimeout = null;

        /*----------  SCOPE VAR DECLARATIONS  ----------*/

        $scope.currentEvent = null;
        $scope.currentWorker = null;
        $scope.currentCheckIn = null;
        $scope.currentSyncedCheckIn = null;
        $scope.currentlySyncing = false;
        $scope.currentlyUnsyncing = false;

        //checkin arrays
        $scope.unsyncedCheckins = [];
        $scope.syncedCheckins = [];

        //counts
        $scope.allocatedPeripheralsCount = 0;

        //menu
        $scope.checked = false;
        
        //url location
        $scope.location = $location;
        $scope.$watch('location.search()', function() {
            $scope.currentEvent = ($location.search()).currentEvent;
            $scope.currentWorker = ($location.search()).currentWorker;
        }, true);

        $scope.changeTarget = function(name) {
            $location.search('currentEvent', name);
            $location.search('currentWorker', name);
        }

        /*----------  FUNC DECLARATIONS  ----------*/
        var setCurrentCheckIn = function(checkIn) {
            if (!$scope.currentlySyncing) {
                if ($scope.currentCheckIn) {
                    if ($scope.currentCheckIn.id == checkIn.id) {
                        $scope.currentCheckIn = null;
                    } else {
                        $scope.currentCheckIn = checkIn;
                    }
                } else {
                    $scope.currentCheckIn = checkIn;
                }
            }
        }

        var setCurrentSyncedCheckIn = function(checkIn) {
            if (!$scope.currentlyUnsyncing) {
                if ($scope.currentSyncedCheckIn) {
                    if ($scope.currentSyncedCheckIn.id == checkIn.id) {
                        $scope.currentSyncedCheckIn = null;
                    } else {
                        $scope.currentSyncedCheckIn = checkIn;
                    }
                } else {
                    $scope.currentSyncedCheckIn = checkIn;
                }
            }
        }

        var sortCheckIns = function() {
            $scope.unsyncedCheckins = [];
            $scope.syncedCheckins = [];

            var allUnsyncedCheckins = [];
            var allSyncedCheckins = [];

            allCheckIns.forEach(function(checkIn) {
                if (!checkIn.badge) {
                    allUnsyncedCheckins.push(checkIn);
                } else {
                    allSyncedCheckins.push(checkIn);
                }
            });

            $scope.unsyncedCheckins = (allUnsyncedCheckins.length > 3)?allUnsyncedCheckins.slice(allUnsyncedCheckins.length-3):allUnsyncedCheckins;
            $scope.syncedCheckins = (allSyncedCheckins.length > 3)?allSyncedCheckins.slice(allSyncedCheckins.length-3):allSyncedCheckins;
        }

        var removeBadgeForCheckIn = function(checkInTemp) {
            allCheckIns.forEach(function(checkIn) {
                if (checkIn.id == checkInTemp.id) {
                    checkIn.badge = null;
                }
            });
        }

        var addBadgeForCheckIn = function(checkInTemp, badge) {
            allCheckIns.forEach(function(checkIn) {
                if (checkIn.id == checkInTemp.id) {
                    checkIn.badge = badge;
                }
            });
        }

        var toggleMenu = function() {
            $scope.checked = !$scope.checked;
        }

        var sendCommand = function(command) {
            if ($scope.currentSyncedCheckIn.badge) {
                badgeService.sendCommand($scope.currentSyncedCheckIn.badge, command);
            }
        }

        var sync = function() {
            var attendeeEmail = $scope.currentCheckIn.email;

            if ($scope.currentCheckIn && !$scope.currentlySyncing && badgeService.allocatedPeripheralsCount > 0) {
                $scope.currentlySyncing = true;
                badgeService.syncBadge($scope.currentCheckIn);
            }

            setSyncTimeout();
        }

        var unsync = function() {
            if (!$scope.currentlyUnsyncing && $scope.currentSyncedCheckIn && $scope.currentSyncedCheckIn.badge) {
                $scope.currentlyUnsyncing = true;
                console.log($scope.currentlyUnsyncing);
                badgeService.unsyncBadge($scope.currentSyncedCheckIn.eventAttendee, $scope.currentSyncedCheckIn.badge)
                    .then(function() {
                        removeBadgeForCheckIn($scope.currentSyncedCheckIn);
                        sortCheckIns();

                        var existingAttendeeBadges = {};
                        allCheckIns.forEach(function(checkIn) {
                            if (checkIn.badge) {
                                var uniqueId = checkIn.badge.identity + checkIn.badge.macAddress;
                                existingAttendeeBadges[uniqueId] = checkIn.badge;
                            }
                        });
                        badgeService.updateExistingAttendeeBadges(existingAttendeeBadges);

                        $scope.currentSyncedCheckIn = null;
                        $scope.currentlyUnsyncing = false;
                    });
            }
        }

        //we have sync timeout here to force the sync button to go back if we don't get a socket message that our badge has been synced
        var setSyncTimeout = function() {
            syncTimeout = $timeout(function() {
                console.log(attendeeEmail);
                attendeeService.getCheckInByEmail($scope.currentEvent, attendeeEmail)
                .then(function(checkIns) {
                    var checkIn = checkIns[0];
                    if(checkIn.badge) {
                       completeSync(checkIn.eventAttendee, checkIn.badge);
                    } else {
                        setSyncTimeout();
                    }
                });
            }, 5 * 1000);
        }

        var completeSync = function(attendee, badge) {
            console.log('allCheckins', allCheckIns);
            var checkIn = attendeeService.findCheckInForAttendee(attendee, allCheckIns);

            if (checkIn) {
                addBadgeForCheckIn(checkIn, badge);
                sortCheckIns();
            }

            $scope.currentlySyncing = false;
            if ($scope.unsyncedCheckins.length > 0) {
                $scope.currentCheckIn = $scope.unsyncedCheckins[0].eventAttendee;
            } else {
                $scope.currentCheckIn = null;
            }

            alert.play();
            $scope.$apply();
        }

        /*----------  INIT FUNCTION DECLARATIONS  ----------*/

        var getInitialData = function() {
            var deferred = $q.defer();
            $http({
                    method: 'GET',
                    url: '/initial-data'
                })
                .then(function(res) {
                    // $scope.currentEvent = parseInt(res.data.currentEvent);
                    // $scope.currentWorker = parseInt(res.data.currentWorker);
                    $scope.currentVersion = res.data.currentVersion;
                    $scope.allocationEnabled = res.data.allocationEnabled;
                    deferred.resolve();
                })
                .catch(function(err) {
                    deferred.reject(err);
                });

            return deferred.promise;
        }

        var init = function() {
            $scope.eventLoading = true;
            getInitialData()
                .then(function() {
                    return attendeeService.getCheckIns($scope.currentEvent, $scope.currentWorker, "")
                })
                .then(function(checkIns) {
                    console.log(checkIns.length);
                    allCheckIns = checkIns;
                    sortCheckIns();
                })
                .finally(function() {
                    var existingAttendeeBadges = {};
                    allCheckIns.forEach(function(checkIn) {
                        if (checkIn.badge) {
                            var uniqueId = checkIn.badge.identity + checkIn.badge.macAddress;
                            existingAttendeeBadges[uniqueId] = checkIn.badge;
                        }
                    });
                    badgeService.updateExistingAttendeeBadges(existingAttendeeBadges);
                    $scope.currentStatus = badgeService.currentStatus;
                });
        }

        init();

        /*----------  EVENT LISTENERS  ----------*/

        $scope.$on('badgeSynced', function(event, args) {
            if(syncTimeout) {
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

        $scope.$on('badgeNotFound', function() {
            $scope.$apply($scope.currentCheckIn = null);
            $scope.$apply($scope.currentlySyncing = false);
        });

        $scope.$on('currentBadges', function() {
            $scope.$apply($scope.allocatedPeripheralsCount = badgeService.allocatedPeripheralsCount);
        });

        $scope.$on('badgeLookup', function(event, args) {
            if(!currentlyLooking[args.identity]) {
                currentlyLooking[args.identity] = 1;

                attendeeService.getAttendeeForBadge($scope.currentEvent, args.identity)
                    .then(function(attendee) {
                        console.log(attendee);
                        delete currentlyLooking[args.identity];
                        if(attendee) {
                            $scope.lookedupAttendees[args.identity] = attendee;
                        } else {
                            alert('No attendee found for badge!');
                        }
                    });
            }
        });

        /*----------  EXPORT DECLARATIONS  ----------*/
        $scope.setCurrentCheckIn = setCurrentCheckIn;
        $scope.setCurrentSyncedCheckIn = setCurrentSyncedCheckIn;
        $scope.sendCommand = sendCommand;
        $scope.toggleMenu = toggleMenu;
        $scope.sync = sync;
        $scope.unsync = unsync;
    });